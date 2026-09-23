import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DocumentViewModel } from '../document-view-model';
import { BrandMark } from './brand-mark';
import { ACCENT, HAIRLINE, INK, LABEL, LINE, MUTED, PANEL } from './theme';

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function qty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(iso));
}

const styles = StyleSheet.create({
  page: { padding: '16mm', fontSize: 10, lineHeight: 1.5, color: INK, fontFamily: 'Helvetica' },
  letterheadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bizBlock: { flexDirection: 'row', gap: 10 },
  bizName: { fontSize: 14, fontWeight: 700 },
  muted: { color: MUTED },
  titleBlock: { alignItems: 'flex-end' },
  docTitle: { fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  docNumber: { fontSize: 11, fontWeight: 700, color: ACCENT, marginTop: 2 },
  unpaidBadge: {
    marginTop: 3,
    borderWidth: 1,
    borderColor: INK,
    borderStyle: 'solid',
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rule: { borderTopWidth: 2, borderTopColor: INK, marginTop: 10 },
  hairline: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  fieldsRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  fieldLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: LABEL, marginBottom: 2 },
  fieldValueStrong: { fontSize: 11, fontWeight: 700 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: PANEL },
  th: { padding: 6, fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: LABEL },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  td: { padding: 7, fontSize: 10 },
  tdRight: { textAlign: 'right' },
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalsBox: { width: '55%' },
  totalsLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderTopColor: INK,
    borderBottomColor: INK,
    fontWeight: 700,
    fontSize: 12,
  },
  signatureRow: { flexDirection: 'row', gap: 16, marginTop: 40 },
  signatureBlock: { flex: 1, borderTopWidth: 1, borderTopColor: INK, paddingTop: 4, fontSize: 9, color: LABEL },
  paymentBox: { marginTop: 12, borderWidth: 1, borderColor: LINE, borderStyle: 'solid', padding: 8 },
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: LABEL,
  },
});

export { styles as pdfStyles, money, qty, fmtDate };

export function Letterhead({ vm }: { vm: DocumentViewModel }) {
  return (
    <View style={styles.letterheadRow}>
      <View style={styles.bizBlock}>
        <BrandMark size={34} />
        <View>
          <Text style={styles.bizName}>{vm.letterhead.businessName}</Text>
          {vm.letterhead.address && <Text style={styles.muted}>{vm.letterhead.address}</Text>}
          <Text style={styles.muted}>{[vm.letterhead.phone, vm.letterhead.email].filter(Boolean).join('  ·  ')}</Text>
        </View>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.docTitle}>{vm.title}</Text>
        <Text style={styles.docNumber}>{vm.number}</Text>
        {!vm.isDeliveryNote && vm.isUnpaid && <Text style={styles.unpaidBadge}>Unpaid</Text>}
      </View>
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function PartiesRow({ vm }: { vm: DocumentViewModel }) {
  return (
    <View style={styles.fieldsRow}>
      <View style={{ flex: 1.4 }}>
        <Field label={vm.isDeliveryNote ? 'Deliver to' : 'Billed to'}>
          <Text style={styles.fieldValueStrong}>{vm.customerName}</Text>
          {vm.customerAddress && <Text style={styles.muted}>{vm.customerAddress}</Text>}
          {vm.customerPhone && <Text style={styles.muted}>{vm.customerPhone}</Text>}
        </Field>
      </View>
      <View style={{ flex: 1 }}>
        <Field label="Date">
          <Text>{fmtDate(vm.createdAt)}</Text>
        </Field>
      </View>
      <View style={{ flex: 1 }}>
        <Field label={vm.isDeliveryNote ? 'Order reference' : 'Issued by'}>
          <Text>{vm.isDeliveryNote ? (vm.sourceReference ?? '—') : (vm.issuedByName ?? '—')}</Text>
        </Field>
      </View>
    </View>
  );
}

/**
 * Percentage widths, not fixed mm — the same reasoning as the old
 * DocumentSheet: values that add up fine for a six-column invoice run past
 * the page edge on the delivery note's wider four-column layout.
 */
export function ItemsTable({ vm }: { vm: DocumentViewModel }) {
  const cols = vm.showPrices
    ? [
        { w: '6%', label: '#' },
        { w: '34%', label: 'Description' },
        { w: '12%', label: 'Qty', right: true },
        { w: '10%', label: 'Unit' },
        { w: '17%', label: 'Price', right: true },
        { w: '21%', label: 'Amount', right: true },
      ]
    : [
        { w: '7%', label: '#' },
        { w: '55%', label: 'Description' },
        { w: '19%', label: 'Qty', right: true },
        { w: '19%', label: 'Unit' },
      ];

  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.tableHeaderRow}>
        {cols.map((c) => (
          <Text key={c.label} style={[styles.th, { width: c.w, textAlign: c.right ? 'right' : 'left' }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {vm.items.map((item) => (
        <View key={item.id} style={styles.tr} wrap={false}>
          <Text style={[styles.td, { width: cols[0].w, color: LABEL }]}>{item.index}</Text>
          <Text style={[styles.td, { width: cols[1].w }]}>{item.description}</Text>
          <Text style={[styles.td, styles.tdRight, { width: cols[2].w, fontWeight: 700 }]}>{qty(item.qty)}</Text>
          <Text style={[styles.td, { width: cols[3].w, color: MUTED }]}>{item.unitSymbol}</Text>
          {vm.showPrices && (
            <>
              <Text style={[styles.td, styles.tdRight, { width: cols[4].w }]}>{money(item.unitPrice)}</Text>
              <Text style={[styles.td, styles.tdRight, { width: cols[5].w, fontWeight: 700 }]}>{money(item.lineTotal)}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

export function TotalsBlock({ vm }: { vm: DocumentViewModel }) {
  return (
    <View style={styles.totalsWrap}>
      <View style={styles.totalsBox}>
        <View style={styles.totalsLine}>
          <Text style={styles.muted}>Subtotal</Text>
          <Text>KSh {money(vm.subtotal)}</Text>
        </View>
        {vm.showTransportLine && (
          <View style={styles.totalsLine}>
            <Text style={styles.muted}>Delivery</Text>
            <Text>KSh {money(vm.transportAmount)}</Text>
          </View>
        )}
        {vm.showTransportIncludedNote && (
          <Text style={{ textAlign: 'right', fontSize: 9, color: LABEL }}>Delivery included in prices</Text>
        )}
        <View style={styles.grandTotal}>
          <Text>Total</Text>
          <Text>KSh {money(vm.total)}</Text>
        </View>
        {vm.type === 'RECEIPT' && vm.paymentLabel && (
          <Text style={{ marginTop: 4, textAlign: 'right', fontSize: 9, color: MUTED }}>Paid by {vm.paymentLabel}</Text>
        )}
        {vm.isUnpaid && <Text style={{ marginTop: 4, textAlign: 'right', fontSize: 9, color: MUTED }}>Payable on collection.</Text>}
      </View>
    </View>
  );
}

export function SignatureBlock() {
  return (
    <View style={styles.signatureRow}>
      <Text style={styles.signatureBlock}>Dispatched by — name &amp; signature</Text>
      <Text style={styles.signatureBlock}>Received by — name, signature &amp; date</Text>
    </View>
  );
}

export function NotesAndPayment({ vm }: { vm: DocumentViewModel }) {
  return (
    <>
      {vm.notes && (
        <View style={{ marginTop: 14 }}>
          <Field label="Notes">
            <Text>{vm.notes}</Text>
          </Field>
        </View>
      )}
      {/* Payment details belong on documents the customer still has to act
          on — never on a delivery note, never on a receipt that's already
          been settled. */}
      {!vm.isDeliveryNote && vm.type !== 'RECEIPT' && vm.letterhead.paymentDetails && (
        <View style={styles.paymentBox}>
          <Field label="How to pay">
            <Text>{vm.letterhead.paymentDetails}</Text>
          </Field>
        </View>
      )}
    </>
  );
}

export function Footer({ vm }: { vm: DocumentViewModel }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{vm.letterhead.footerText}</Text>
      <Text>
        {vm.title} {vm.number}
      </Text>
    </View>
  );
}
