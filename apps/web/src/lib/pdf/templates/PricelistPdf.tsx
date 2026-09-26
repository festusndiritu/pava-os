import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Logo } from '../brand-mark';
import { ACCENT, HAIRLINE, INK, MUTED } from '../theme';
import { fmtNumber } from '../../format';

export interface PricelistViewModel {
  title: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  categories: { name: string; items: { id: string; label: string; price: number }[] }[];
}

const styles = StyleSheet.create({
  page: { padding: '16mm', fontSize: 10, lineHeight: 1.5, color: INK, fontFamily: 'Helvetica' },
  header: { alignItems: 'center', textAlign: 'center', borderBottom: `2pt solid ${ACCENT}`, paddingBottom: 10, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 700 },
  muted: { color: MUTED },
  category: { marginBottom: 10 },
  categoryTitle: { fontWeight: 700, borderBottom: `1pt solid ${INK}`, paddingBottom: 3, marginBottom: 4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  price: { fontWeight: 700, color: ACCENT },
});

/**
 * Not one of the four document types — a customer-facing pricelist has no
 * document number, status, or customer; it's closer to a flyer than an
 * invoice. Kept as its own small template rather than forced through
 * DocumentViewModel, which exists specifically for records that trace back
 * to a real Document row.
 */
export function PricelistPdf({ vm }: { vm: PricelistViewModel }) {
  return (
    <Document title={vm.title}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Logo size={40} />
          <Text style={[styles.title, { marginTop: 4 }]}>{vm.title}</Text>
          {vm.address && <Text style={styles.muted}>{vm.address}</Text>}
          <Text style={styles.muted}>{[vm.phone, vm.email].filter(Boolean).join('  ·  ')}</Text>
        </View>
        {vm.categories.map((cat) => (
          <View key={cat.name} style={styles.category} wrap={false}>
            <Text style={styles.categoryTitle}>{cat.name}</Text>
            {cat.items.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text>{item.label}</Text>
                <Text style={styles.price}>KSh {fmtNumber(item.price)}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
