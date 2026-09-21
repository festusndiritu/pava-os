import { Document, Page, Text } from '@react-pdf/renderer';
import type { DocumentViewModel } from '../../document-view-model';
import { Letterhead, PartiesRow, ItemsTable, SignatureBlock, Footer, pdfStyles } from '../primitives';

export function DeliveryNotePdf({ vm }: { vm: DocumentViewModel }) {
  return (
    <Document title={`${vm.title} ${vm.number}`}>
      <Page size="A4" style={pdfStyles.page}>
        <Letterhead vm={vm} />
        <PartiesRow vm={vm} />
        <ItemsTable vm={vm} />
        {vm.notes && <Text style={{ marginTop: 14, fontSize: 10 }}>{vm.notes}</Text>}
        <SignatureBlock />
        <Footer vm={vm} />
      </Page>
    </Document>
  );
}
