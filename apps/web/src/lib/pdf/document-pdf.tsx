'use client';

import { pdf } from '@react-pdf/renderer';
import type { SaleDocument } from '../documents-api';
import type { BusinessSettings } from '../settings-api';
import { buildDocumentViewModel, type DocumentViewModel } from '../document-view-model';
import { QuotePdf } from './templates/QuotePdf';
import { InvoicePdf } from './templates/InvoicePdf';
import { ReceiptPdf } from './templates/ReceiptPdf';
import { DeliveryNotePdf } from './templates/DeliveryNotePdf';
import { PricelistPdf, type PricelistViewModel } from './templates/PricelistPdf';
// Reused as-is: sharing a Blob to the OS share sheet (or falling back to a
// download) has nothing to do with how the PDF's bytes were produced.
import { sharePdfBlob } from '../pdf';

/**
 * Real vector PDF — selectable text, small file, correct pagination for a
 * long line-item list — generated entirely client-side. Replaces the old
 * html2canvas screenshot-to-image-to-PDF pipeline for all four document
 * types (marketing's pricelist export still uses that pipeline until it's
 * migrated too).
 *
 * Takes the view-model directly rather than a `SaleDocument`, so a POS
 * till sale — which only ever has a `PosSaleResult` on hand, never a full
 * `SaleDocument` — can share a PDF too, via `buildPosReceiptViewModel`.
 */
export async function viewModelToPdfBlob(vm: DocumentViewModel): Promise<Blob> {
  const element =
    vm.type === 'QUOTE' ? (
      <QuotePdf vm={vm} />
    ) : vm.type === 'INVOICE' ? (
      <InvoicePdf vm={vm} />
    ) : vm.type === 'DELIVERY_NOTE' ? (
      <DeliveryNotePdf vm={vm} />
    ) : (
      <ReceiptPdf vm={vm} />
    );
  return pdf(element).toBlob();
}

export async function shareViewModelAsPdf(vm: DocumentViewModel): Promise<'shared' | 'downloaded'> {
  const blob = await viewModelToPdfBlob(vm);
  return sharePdfBlob(blob, `${vm.number}.pdf`, `${vm.title} ${vm.number}`);
}

export async function sharePricelistAsPdf(vm: PricelistViewModel): Promise<'shared' | 'downloaded'> {
  const blob = await pdf(<PricelistPdf vm={vm} />).toBlob();
  return sharePdfBlob(blob, `${vm.title || 'pricelist'}.pdf`, vm.title);
}

export async function documentToPdfBlob(doc: SaleDocument, settings: BusinessSettings | null): Promise<Blob> {
  return viewModelToPdfBlob(buildDocumentViewModel(doc, settings));
}

export async function shareDocumentAsPdf(doc: SaleDocument, settings: BusinessSettings | null): Promise<'shared' | 'downloaded'> {
  return shareViewModelAsPdf(buildDocumentViewModel(doc, settings));
}
