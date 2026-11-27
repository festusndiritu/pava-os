import type { BusinessSettings } from './settings-api';
import type { DocumentType, SaleDocument } from './documents-api';
import { money } from './format';

/** The single function every document template — PDF or thermal, any of the four types — consumes. */

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  QUOTE: 'Quotation',
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  DELIVERY_NOTE: 'Delivery Note',
};

// Unified across every format — this is the fix for the CARD/CREDIT drift noted above.
const PAYMENT_LABEL: Record<string, string> = {
  MPESA: 'M-Pesa Paybill',
  CASH: 'Cash',
  CARD: 'Card',
  CREDIT: 'On account',
  STORE_CREDIT: 'Store credit',
  MIXED: 'Cash + M-Pesa',
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
  unitPrice: number;
  lineTotal: number;
}

export interface DocumentViewModel {
  type: DocumentType;
  title: string;
  number: string;
  createdAt: string;
  /** QUOTE only: the last day the quoted prices hold. */
  validUntil: string | null;
  isDeliveryNote: boolean;
  /** False only for a delivery note — every other type always shows prices. */
  showPrices: boolean;

  letterhead: DocumentViewModelLetterhead;

  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;

  issuedByName: string | null;
  /** Delivery note only — the quote/invoice number it was generated from. */
  sourceReference: string | null;

  items: DocumentViewModelItem[];

  subtotal: number;
  /** Pre-discount figure to show above a discount line; null when no subtotal row is shown. */
  subtotalLine: number | null;
  discount: number;
  transportAmount: number;
  showTransportLine: boolean;
  showTransportIncludedNote: boolean;
  total: number;

  paymentMethod: string | null;
  paymentLabel: string | null;
  changeNote: string | null;
  /** Receipts only: an earlier unpaid balance received together with this sale (not part of the total). */
  balanceNote: string | null;
  /** Receipts only: part of the bill the customer left owing on their account. */
  owingNote: string | null;
  /** INVOICED and not yet paid — "Unpaid" badge, "payable on collection" note. */
  isUnpaid: boolean;

  notes: string | null;
}

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
  discount?: number;
  transportAmount: number;
  transportMode: string;
  total: number;
  paymentMethod: string | null;
  payments?: { method: string; amount: number }[];
  changeGiven?: number;
  changeToCredit?: number;
  balanceCollected?: number;
  balanceLeft?: number;
  validUntil?: string | null;
  notes: string | null;
}

function buildFromSource(source: DocumentViewModelSource, settings: BusinessSettings | null): DocumentViewModel {
  const isDeliveryNote = source.type === 'DELIVERY_NOTE';
  const showTransportLine = source.transportMode === 'ITEMIZED' && source.transportAmount > 0;
  const showTransportIncludedNote = source.transportMode === 'DISTRIBUTED' && source.transportAmount > 0;
  const parts = (source.payments ?? []).filter((p) => p.amount > 0);
  const paymentLabel =
    source.paymentMethod === 'MIXED' && parts.length > 1
      ? parts.map((p) => `${PAYMENT_LABEL[p.method] ?? p.method} ${money(p.amount)}`).join(' + ')
      : source.paymentMethod
        ? (PAYMENT_LABEL[source.paymentMethod] ?? source.paymentMethod)
        : null;
  const changeNote = source.changeGiven
    ? `Change given ${money(source.changeGiven)}`
    : source.changeToCredit
      ? `${money(source.changeToCredit)} change kept as credit`
      : null;

  return {
    type: source.type,
    title: DOCUMENT_TITLES[source.type],
    number: source.number,
    createdAt: source.createdAt,
    validUntil: source.type === 'QUOTE' ? (source.validUntil ?? null) : null,
    isDeliveryNote,
    showPrices: !isDeliveryNote,

    letterhead: {
      businessName: settings?.businessName ?? 'Pava Steel Hardware',
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      email: settings?.email ?? null,
      paymentDetails: settings?.paymentDetails ?? null,
      footerText: isDeliveryNote ? '' : settings?.documentFooter?.trim() || 'Thank you for your business.',
    },

    customerName: source.customerName,
    customerAddress: source.customerAddress,
    customerPhone: source.customerPhone,

    issuedByName: source.issuedByName,
    sourceReference: isDeliveryNote ? source.sourceReference : null,

    items: source.items.map((item, i) => ({ ...item, index: i + 1 })),

    subtotal: source.subtotal,
    subtotalLine: !showTransportIncludedNote ? source.subtotal : (source.discount ?? 0) > 0 ? source.total + (source.discount ?? 0) : null,
    discount: source.discount ?? 0,
    transportAmount: source.transportAmount,
    showTransportLine,
    showTransportIncludedNote,
    total: source.total,

    paymentMethod: source.paymentMethod,
    paymentLabel,
    changeNote,
    balanceNote: source.balanceCollected ? `Includes ${money(source.balanceCollected)} towards an earlier balance (not part of the total)` : null,
    owingNote: source.balanceLeft ? `${money(source.balanceLeft)} left owing on account` : null,
    isUnpaid: source.status === 'INVOICED',

    notes: source.notes,
  };
}

function resolveNumber(doc: SaleDocument): string {
  return (
    doc.deliveryNoteNumber ?? doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber ?? doc.id.slice(0, 8).toUpperCase()
  );
}

function resolveSourceNumber(doc: SaleDocument): string {
  return doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber ?? doc.id.slice(0, 8).toUpperCase();
}

/** `INV-2026-000012` becomes `DN-2026-000012`: same order, its own prefix. A stored delivery note keeps its own number. */
export function deliveryNoteLabel(doc: SaleDocument, settings: BusinessSettings | null): string {
  if (doc.deliveryNoteNumber) return doc.deliveryNoteNumber;
  const prefix = settings?.deliveryNotePrefix?.trim() || 'DN';
  const source = resolveSourceNumber(doc);
  const tail = /^[A-Za-z]+-(\d{4}-\d+)$/.exec(source);
  return `${prefix}-${tail ? tail[1] : source}`;
}

function resolveSourceReference(doc: SaleDocument): string | null {
  return doc.sourceDocument?.receiptNumber ?? doc.sourceDocument?.invoiceNumber ?? doc.sourceDocument?.quoteNumber ?? null;
}

export function buildDocumentViewModel(doc: SaleDocument, settings: BusinessSettings | null): DocumentViewModel {
  const isDeliveryNote = doc.type === 'DELIVERY_NOTE';
  const customerName = doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in customer';
  // A delivery note prefers the location/phone captured at creation time — the dispatch site and
  // its contact aren't always the customer's own billing address and number (a site foreman, a gate
  // guard) — falling back to the customer's stored details only when none was given.
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
      discount: doc.discount,
      transportAmount: doc.transportAmount,
      transportMode: doc.transportMode,
      total: doc.total,
      paymentMethod: doc.paymentMethod,
      payments: doc.payments,
      changeGiven: doc.changeGiven,
      changeToCredit: doc.changeToCredit,
      balanceCollected: doc.balanceCollected,
      balanceLeft: doc.balanceLeft,
      // Quotes issued before validity existed have no stored date: work it out from today's setting.
      validUntil: doc.validUntil ?? (settings ? new Date(new Date(doc.createdAt).getTime() + settings.quoteValidityDays * 86_400_000).toISOString() : null),
      notes: doc.notes,
    },
    settings,
  );
}

/** A delivery note is never stored: it is built from the invoice or quote when needed. */
export function buildDeliveryNoteViewModel(
  doc: SaleDocument,
  settings: BusinessSettings | null,
  site: { location?: string; phone?: string } = {},
): DocumentViewModel {
  // A delivery note isn't stored, so it has no number of its own. It carries its order's reference, under the
  // delivery note prefix from Settings, instead of passing itself off as the quote or invoice it came from.
  const number = deliveryNoteLabel(doc, settings);
  const orderReference = resolveSourceNumber(doc);
  return buildFromSource(
    {
      type: 'DELIVERY_NOTE',
      status: doc.status,
      number,
      createdAt: new Date().toISOString(),
      customerName: doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in customer',
      customerAddress: site.location?.trim() || null,
      customerPhone: site.phone?.trim() || null,
      issuedByName: null,
      sourceReference: orderReference,
      items: doc.items.map((item) => ({
        id: item.id,
        description: item.description,
        qty: item.qty,
        unitSymbol: item.product?.unit?.symbol ?? '',
        unitPrice: 0,
        lineTotal: 0,
      })),
      subtotal: 0,
      transportAmount: 0,
      transportMode: doc.transportMode,
      total: 0,
      paymentMethod: null,
      notes: null,
    },
    settings,
  );
}

/** The till-side counterpart: a `PosSaleResult` comes back the instant a sale completes, before there's any reason to re-fetch it as a full `SaleDocument` — this is what the thermal receipt prints from at that moment. */
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
      discount: sale.discount,
      transportAmount: sale.transportAmount,
      transportMode: sale.transportMode,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      payments: sale.payments,
      changeGiven: sale.changeGiven,
      changeToCredit: sale.changeToCredit,
      balanceCollected: sale.balanceCollected,
      balanceLeft: sale.balanceLeft,
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
  discount?: number;
  total: number;
  transportAmount: number;
  transportMode: string;
  paymentMethod: string | null;
  payments?: { method: string; amount: number }[];
  changeGiven?: number;
  changeToCredit?: number;
  balanceCollected?: number;
  balanceLeft?: number;
  customerName: string | null;
  customer: { name: string; businessName: string | null } | null;
  items: { id: string; description: string; qty: number; unitPrice: number; lineTotal: number }[];
  createdAt: string;
}