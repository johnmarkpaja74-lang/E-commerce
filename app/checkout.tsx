import { useRouter } from 'expo-router';
import { logEvent } from 'firebase/analytics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { analyticsPromise } from '@/src/features/auth/state/config';
import { useCartStore } from '@/src/features/cart/state/cartStore';
import { useCartSyncStatus } from '@/src/features/cart/state/useCartSyncStatus';
import { applyCartConflicts } from '@/src/features/cart/sync/conflictResolver';
import { useCheckoutDraftStore } from '@/src/features/orders/state/checkoutDraftStore';
import { useOrderReceiptStore } from '@/src/features/orders/state/orderReceiptStore';
import { MOCK_PRODUCTS, submitOrder, validateCart } from '@/src/services/api/commerceApi';

type CheckoutPhase =
  | 'idle'
  | 'validating'
  | 'resolving_conflicts'
  | 'submitting'
  | 'success'
  | 'blocked_offline'
  | 'error';

export default function CheckoutModalScreen() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const initializeFromDatabase = useCartStore((state) => state.initializeFromDatabase);
  const clearCart = useCartStore((state) => state.clearCart);
  const checkoutDraft = useCheckoutDraftStore((state) => state.draft);
  const clearCheckoutDraft = useCheckoutDraftStore((state) => state.clearDraft);
  const setLastOrder = useOrderReceiptStore((state) => state.setLastOrder);
  const { online } = useCartSyncStatus();

  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [message, setMessage] = useState<string>('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState('Demo Address, Manila');
  const [paymentMethodId, setPaymentMethodId] = useState('pm-demo-card');

  const checkoutItems = checkoutDraft?.items?.length ? checkoutDraft.items : items;
  const checkoutMode = checkoutDraft?.mode ?? 'cart';

  const total = useMemo(() => {
    return checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [checkoutItems]);
  const shipping = 15;
  const discount = 0;
  const grandTotal = Math.max(total + shipping - discount, 0);

  async function handleCheckout(): Promise<void> {
    if (checkoutItems.length === 0) {
      setPhase('error');
      setMessage('Your cart is empty. Add items before checkout.');
      return;
    }

    if (!online) {
      setPhase('blocked_offline');
      setMessage('You are offline. Reconnect to validate cart and place order.');
      return;
    }

    try {
      setPhase('validating');
      setMessage('Validating cart with server...');
      const validation = await validateCart(checkoutItems);

      if (validation.conflicts && validation.conflicts.length > 0) {
        setPhase('resolving_conflicts');
        setMessage('Resolving cart conflicts from server...');
        applyCartConflicts(validation.conflicts);
        await initializeFromDatabase();

        setPhase('idle');
        setMessage('Cart updated due to stock/price changes. Review and try again.');
        return;
      }

      if (!validation.valid) {
        setPhase('error');
        setMessage(validation.issues.join(' ') || 'Cart validation failed.');
        return;
      }

      setPhase('submitting');
      setMessage('Submitting order...');
      const order = await submitOrder({
        items: checkoutItems,
        customerId: 'demo-customer-1',
        shippingAddress,
        paymentMethodId,
      });

      setLastOrder({
        orderId: order.orderId,
        placedAt: order.placedAt,
        status: order.status,
        items: checkoutItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: total,
        shipping,
        discount,
        total: grandTotal,
      });

      // Log Purchase Event
      const analytics = await analyticsPromise;
      if (analytics) {
        logEvent(analytics, 'purchase', {
          transaction_id: order.orderId,
          value: grandTotal,
          currency: 'USD',
          items: checkoutItems.map(i => ({ item_id: i.productId, item_name: i.name })),
        });
      }

      if (checkoutMode === 'cart') {
        await clearCart();
      }
      clearCheckoutDraft();
      setOrderId(order.orderId);
      setPhase('success');
      setMessage('Order placed successfully.');
      router.replace('/receipt');
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
    }
  }

  const busy = phase === 'validating' || phase === 'resolving_conflicts' || phase === 'submitting';
  const previewItems = checkoutItems.slice(0, 3);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Checkout</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <TextInput
            value={shippingAddress}
            onChangeText={setShippingAddress}
            placeholder="Enter delivery address"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <Text style={styles.metaText}>Customer: demo-customer-1</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.methodRow}>
            {[
              { id: 'pm-demo-card', label: 'Card' },
              { id: 'pm-cod', label: 'Cash' },
              { id: 'pm-wallet', label: 'Wallet' },
            ].map((method) => (
              <Pressable
                key={method.id}
                style={[styles.methodChip, paymentMethodId === method.id && styles.methodChipActive]}
                onPress={() => setPaymentMethodId(method.id)}>
                <Text style={[styles.methodChipText, paymentMethodId === method.id && styles.methodChipTextActive]}>
                  {method.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.metaText}>Method ID: {paymentMethodId}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.sectionTitle}>Checkout Status</Text>
            <View style={[styles.statusChip, online ? styles.onlineChip : styles.offlineChip]}>
              <Text style={styles.statusChipText}>{online ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <Text style={styles.metaText}>
            {online ? 'Ready to validate and place order.' : 'Reconnect before placing order.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items ({checkoutItems.length})</Text>
          {previewItems.map((item) => {
            const image = MOCK_PRODUCTS.find((p) => p.id === item.productId)?.imageUrl;
            return (
              <View key={item.productId} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>Qty {item.quantity} • ${item.price.toFixed(2)}</Text>
                </View>
                <Text style={styles.itemTotal}>${(item.price * item.quantity).toFixed(2)}</Text>
                {image ? <Text style={styles.imageHint}>●</Text> : null}
              </View>
            );
          })}
          {checkoutItems.length > previewItems.length ? (
            <Text style={styles.metaText}>+{checkoutItems.length - previewItems.length} more items</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Items Total</Text>
            <Text style={styles.value}>${total.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Shipping</Text>
            <Text style={styles.value}>${shipping.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Discount</Text>
            <Text style={styles.discount}>-${discount.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.total}>${grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {orderId ? <Text style={styles.orderId}>Order ID: {orderId}</Text> : null}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => void handleCheckout()}
          disabled={busy}>
          <Text style={styles.buttonText}>Place Order</Text>
        </Pressable>

        {busy ? <ActivityIndicator color="#ff4d4f" /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f7f3f3',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 62,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffdede',
  },
  backText: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 12,
  },
  headerSpacer: {
    width: 62,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffdede',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  valueStrong: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ffd3d3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff8f8',
    color: '#0f172a',
  },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffd3d3',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodChipActive: { backgroundColor: '#ff4d4f', borderColor: '#ff4d4f' },
  methodChipText: { color: '#374151', fontWeight: '700' },
  methodChipTextActive: { color: '#fff' },
  metaText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  onlineChip: { backgroundColor: '#dcfce7' },
  offlineChip: { backgroundColor: '#fee2e2' },
  statusChipText: { fontWeight: '800', fontSize: 12, color: '#111827' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  itemMain: { flex: 1, paddingRight: 8 },
  itemName: { color: '#111827', fontWeight: '600' },
  itemMeta: { color: '#6b7280', fontSize: 12 },
  itemTotal: { color: '#111827', fontWeight: '700' },
  imageHint: { marginLeft: 6, color: '#ff4d4f', fontSize: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#6b7280',
    fontWeight: '600',
  },
  value: {
    color: '#111827',
    fontWeight: '700',
  },
  discount: {
    color: '#dc2626',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#efeef1',
    marginVertical: 2,
  },
  totalLabel: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  total: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 24,
  },
  message: {
    color: '#374151',
    fontWeight: '500',
  },
  orderId: {
    color: '#ff4d4f',
    fontWeight: '800',
  },
  button: {
    marginTop: 2,
    backgroundColor: '#ff4d4f',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
