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
import { sharePdfBlob, type ShareResult } from '../pdf';

/** Real vector PDF — selectable text, small file, correct pagination for a long line-item list — generated entirely client-side. */
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

export async function shareViewModelAsPdf(vm: DocumentViewModel): Promise<ShareResult> {
  const blob = await viewModelToPdfBlob(vm);
  return sharePdfBlob(blob, `${vm.number}.pdf`, `${vm.title} ${vm.number}`, {
    phone: vm.customerPhone,
    message: `${vm.title} ${vm.number} from ${vm.letterhead.businessName}`,
  });
}

export async function sharePricelistAsPdf(vm: PricelistViewModel): Promise<ShareResult> {
  const blob = await pdf(<PricelistPdf vm={vm} />).toBlob();
  return sharePdfBlob(blob, `${vm.title || 'pricelist'}.pdf`, vm.title);
}

export async function documentToPdfBlob(doc: SaleDocument, settings: BusinessSettings | null): Promise<Blob> {
  return viewModelToPdfBlob(buildDocumentViewModel(doc, settings));
}

export async function shareDocumentAsPdf(doc: SaleDocument, settings: BusinessSettings | null): Promise<ShareResult> {
  return shareViewModelAsPdf(buildDocumentViewModel(doc, settings));
}
