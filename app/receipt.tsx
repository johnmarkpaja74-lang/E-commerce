import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useOrderReceiptStore } from '@/src/features/orders/state/orderReceiptStore';

export default function ReceiptScreen() {
  const router = useRouter();
  const lastOrder = useOrderReceiptStore((state) => state.lastOrder);

  if (!lastOrder) {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>No receipt found</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Receipt</Text>
        <Text style={styles.meta}>Order ID: {lastOrder.orderId}</Text>
        <Text style={styles.meta}>Placed: {new Date(lastOrder.placedAt).toLocaleString()}</Text>
        <Text style={styles.meta}>Status: {lastOrder.status}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Order Details</Text>
        {lastOrder.items.map((item) => (
          <View key={item.productId} style={styles.itemRow}>
            <View style={styles.itemMain}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>Qty {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.totalRow}><Text style={styles.rowLabel}>Subtotal</Text><Text style={styles.rowValue}>${lastOrder.subtotal.toFixed(2)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.rowLabel}>Shipping</Text><Text style={styles.rowValue}>${lastOrder.shipping.toFixed(2)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.rowLabel}>Discount</Text><Text style={styles.rowValue}>-${lastOrder.discount.toFixed(2)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>${lastOrder.total.toFixed(2)}</Text></View>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
        <Text style={styles.primaryBtnText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f6f6f6' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  meta: { color: '#6b7280', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#ececec', marginVertical: 4 },
  sectionLabel: { color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  itemMain: { flex: 1, paddingRight: 8 },
  itemName: { color: '#111827', fontWeight: '600' },
  itemQty: { color: '#6b7280', fontSize: 12 },
  itemPrice: { color: '#111827', fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  rowLabel: { color: '#6b7280' },
  rowValue: { color: '#111827', fontWeight: '700' },
  totalLabel: { color: '#111827', fontWeight: '800', fontSize: 18 },
  totalValue: { color: '#111827', fontWeight: '900', fontSize: 24 },
  primaryBtn: {
    backgroundColor: '#ff9800',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

