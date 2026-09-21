import { Document, Page } from '@react-pdf/renderer';
import type { DocumentViewModel } from '../../document-view-model';
import { Letterhead, PartiesRow, ItemsTable, TotalsBlock, NotesAndPayment, Footer, pdfStyles } from '../primitives';

export function InvoicePdf({ vm }: { vm: DocumentViewModel }) {
  return (
    <Document title={`${vm.title} ${vm.number}`}>
      <Page size="A4" style={pdfStyles.page}>
        <Letterhead vm={vm} />
        <PartiesRow vm={vm} />
        <ItemsTable vm={vm} />
        <TotalsBlock vm={vm} />
        <NotesAndPayment vm={vm} />
        <Footer vm={vm} />
      </Page>
    </Document>
  );
}
