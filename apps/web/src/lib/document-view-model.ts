import type { BusinessSettings } from './settings-api';
import type { DocumentType, SaleDocument } from './documents-api';

/**
 * The single function every document template — PDF or thermal, any of the
 * four types — consumes. Before this existed, "what payment label do we
 * show" and "how do we present the delivery line" were each implemented
 * twice (once in the A4 sheet, once in the thermal receipt), and had
 * already drifted apart: the A4 sheet's payment-label logic didn't handle
 * CARD/CREDIT while the thermal one did. Fixing or extending a field now
 * only has to happen here, once, for every format and every type.
 */

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  QUOTE: 'Quotation',
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  DELIVERY_NOTE: 'Delivery Note',
};

// Unified across every format — this is the fix for the CARD/CREDIT drift
// noted above. CREDIT reads as "On account" rather than a payment method
// name, since it isn't one.
const PAYMENT_LABEL: Record<string, string> = {
  MPESA: 'M-Pesa Paybill',
  CASH: 'Cash',
  CARD: 'Card',
  CREDIT: 'On account',
};

export interface DocumentViewModelLetterhead {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  paymentDetails: string | null;
  footerText: string;
}

export interface DocumentViewModelItem {
  id: string;
  index: number;
  description: string;
  qty: number;
  unitSymbol: string;
  /** Omitted from a delivery note's own shape — see `showPrices` below. */
  unitPrice: number;
  lineTotal: number;
}

export interface DocumentViewModel {
  type: DocumentType;
  title: string;
  number: string;
  createdAt: string;
  isDeliveryNote: boolean;
  /** False only for a delivery note — every other type always shows prices. */
  showPrices: boolean;

  letterhead: DocumentViewModelLetterhead;

  customerName: string;
  /** Billing address for most types; the delivery/site address for a note. */
  customerAddress: string | null;
  customerPhone: string | null;

  issuedByName: string | null;
  /** Delivery note only — the quote/invoice number it was generated from. */
  sourceReference: string | null;

  items: DocumentViewModelItem[];

  subtotal: number;
  transportAmount: number;
  /** Transport shown as its own line item (ITEMIZED with an amount > 0). */
  showTransportLine: boolean;
  /** Transport folded into item prices, noted rather than broken out. */
  showTransportIncludedNote: boolean;
  total: number;

  paymentMethod: string | null;
  paymentLabel: string | null;
  /** INVOICED and not yet paid — "Unpaid" badge, "payable on collection" note. */
  isUnpaid: boolean;

  notes: string | null;
}

/**
 * Normalized shape the core builder operates on. `buildDocumentViewModel`
 * (a `SaleDocument`, from the Documents list / drawer) and
 * `buildPosReceiptViewModel` (a `PosSaleResult`, printed straight off the
 * till before any `SaleDocument` fetch) each map their own record into
 * this shape — the shaping logic itself lives in exactly one place.
 */
export interface DocumentViewModelSource {
  type: DocumentType;
  status: string;
  number: string;
  createdAt: string;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  issuedByName: string | null;
  sourceReference: string | null;
  items: { id: string; description: string; qty: number; unitSymbol: string; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  transportAmount: number;
  transportMode: string;
  total: number;
  paymentMethod: string | null;
  notes: string | null;
}

function buildFromSource(source: DocumentViewModelSource, settings: BusinessSettings | null): DocumentViewModel {
  const isDeliveryNote = source.type === 'DELIVERY_NOTE';
  const showTransportLine = source.transportMode === 'ITEMIZED' && source.transportAmount > 0;
  const showTransportIncludedNote = source.transportMode === 'DISTRIBUTED' && source.transportAmount > 0;
  const paymentLabel = source.paymentMethod ? (PAYMENT_LABEL[source.paymentMethod] ?? source.paymentMethod) : null;

  return {
    type: source.type,
    title: DOCUMENT_TITLES[source.type],
    number: source.number,
    createdAt: source.createdAt,
    isDeliveryNote,
    showPrices: !isDeliveryNote,

    letterhead: {
      businessName: settings?.businessName ?? 'Pava Steel Hardware',
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      email: settings?.email ?? null,
      paymentDetails: settings?.paymentDetails ?? null,
      footerText:
        settings?.documentFooter?.trim() ||
        (isDeliveryNote ? 'Goods received in good order unless noted above.' : 'Thank you for your business.'),
    },

    customerName: source.customerName,
    customerAddress: source.customerAddress,
    customerPhone: source.customerPhone,

    issuedByName: source.issuedByName,
    sourceReference: isDeliveryNote ? source.sourceReference : null,

    items: source.items.map((item, i) => ({ ...item, index: i + 1 })),

    subtotal: source.subtotal,
    transportAmount: source.transportAmount,
    showTransportLine,
    showTransportIncludedNote,
    total: source.total,

    paymentMethod: source.paymentMethod,
    paymentLabel,
    isUnpaid: source.status === 'INVOICED',

    notes: source.notes,
  };
}

function resolveNumber(doc: SaleDocument): string {
  return (
    doc.deliveryNoteNumber ?? doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber ?? doc.id.slice(0, 8).toUpperCase()
  );
}

function resolveSourceReference(doc: SaleDocument): string | null {
  return doc.sourceDocument?.receiptNumber ?? doc.sourceDocument?.invoiceNumber ?? doc.sourceDocument?.quoteNumber ?? null;
}

export function buildDocumentViewModel(doc: SaleDocument, settings: BusinessSettings | null): DocumentViewModel {
  const isDeliveryNote = doc.type === 'DELIVERY_NOTE';
  const customerName = doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in customer';
  // A delivery note prefers the location/phone captured at creation time —
  // the dispatch site and its contact aren't always the customer's own
  // billing address and number (a site foreman, a gate guard) — falling
  // back to the customer's stored details only when none was given.
  const customerAddress = isDeliveryNote
    ? doc.deliveryLocation || doc.customer?.address || doc.customer?.location || null
    : doc.customer?.address || doc.customer?.location || null;
  const customerPhone = isDeliveryNote ? doc.deliveryPhone || doc.customer?.phone || null : (doc.customer?.phone ?? null);

  return buildFromSource(
    {
      type: doc.type,
      status: doc.status,
      number: resolveNumber(doc),
      createdAt: doc.createdAt,
      customerName,
      customerAddress,
      customerPhone,
      issuedByName: doc.createdBy?.name ?? null,
      sourceReference: resolveSourceReference(doc),
      items: doc.items.map((item) => ({
        id: item.id,
        description: item.description,
        qty: item.qty,
        unitSymbol: item.product?.unit?.symbol ?? '',
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: doc.subtotal,
      transportAmount: doc.transportAmount,
      transportMode: doc.transportMode,
      total: doc.total,
      paymentMethod: doc.paymentMethod,
      notes: doc.notes,
    },
    settings,
  );
}

/**
 * The till-side counterpart: a `PosSaleResult` comes back the instant a sale
 * completes, before there's any reason to re-fetch it as a full
 * `SaleDocument` — this is what the thermal receipt prints from at that
 * moment. Never a delivery note (a delivery note is always created from an
 * already-fetched `SaleDocument`, via `buildDocumentViewModel` above), so
 * this only ever needs to handle RECEIPT or an unpaid INVOICE.
 */
export function buildPosReceiptViewModel(sale: PosSaleResultLike, settings: BusinessSettings | null): DocumentViewModel {
  return buildFromSource(
    {
      type: (sale.type as DocumentType) ?? 'RECEIPT',
      status: sale.status,
      number: sale.receiptNumber ?? sale.invoiceNumber ?? sale.id.slice(0, 8).toUpperCase(),
      createdAt: sale.createdAt,
      customerName: sale.customer?.businessName || sale.customer?.name || sale.customerName || 'Walk-in customer',
      // A till sale has no address on hand at print time — only a name.
      customerAddress: null,
      customerPhone: null,
      issuedByName: null,
      sourceReference: null,
      items: sale.items.map((item) => ({
        id: item.id,
        description: item.description,
        qty: item.qty,
        unitSymbol: '',
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: sale.subtotal,
      transportAmount: sale.transportAmount,
      transportMode: sale.transportMode,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      notes: null,
    },
    settings,
  );
}

/** The subset of `PosSaleResult` this module actually needs — kept local so this file doesn't import `pos-api.ts` just for a type shape. */
export interface PosSaleResultLike {
  id: string;
  type: string;
  status: string;
  invoiceNumber: string | null;
  receiptNumber: string | null;
  subtotal: number;
  total: number;
  transportAmount: number;
  transportMode: string;
  paymentMethod: string | null;
  customerName: string | null;
  customer: { name: string; businessName: string | null } | null;
  items: { id: string; description: string; qty: number; unitPrice: number; lineTotal: number }[];
  createdAt: string;
}