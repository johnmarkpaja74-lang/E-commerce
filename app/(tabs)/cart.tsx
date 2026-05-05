import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCartStore, type CartItem } from '@/src/features/cart/state/cartStore';
import { useCheckoutDraftStore } from '@/src/features/orders/state/checkoutDraftStore';

const DELIVERY_OPTIONS = [
  { id: 'standard', label: 'Standard', fee: 15 },
  { id: 'express', label: 'Express', fee: 30 },
  { id: 'same-day', label: 'Same-day', fee: 45 },
] as const;

const PROMO_CODES: Record<string, number> = {
  DROPSYEAREND: 200,
  WELCOME10: 10,
};

export const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=60';

function getImageForProduct(storedImageUrl?: string): string {
  return storedImageUrl || PLACEHOLDER_IMAGE;
}

export default function CartScreen() {
  const router = useRouter();
  const setCheckoutDraft = useCheckoutDraftStore((state) => state.setDraft);
  const items = useCartStore((state) => state.items);
  const initializeFromDatabase = useCartStore((state) => state.initializeFromDatabase);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateItemQuantity = useCartStore((state) => state.updateItemQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const [search, setSearch] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<(typeof DELIVERY_OPTIONS)[number]['id']>('standard');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void initializeFromDatabase();
  }, [initializeFromDatabase]);

  useEffect(() => {
    // Keep selection in sync with cart contents.
    setSelectedIds((previous) => {
      const next = new Set<string>();
      for (const item of items) {
        if (previous.has(item.productId) || previous.size === 0) {
          next.add(item.productId);
        }
      }
      return next;
    });
  }, [items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, search]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.productId));
  }, [items, selectedIds]);

  const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = appliedPromoCode ? (PROMO_CODES[appliedPromoCode] ?? 0) : 0;
  const shipping = selectedItems.length > 0 ? (DELIVERY_OPTIONS.find((option) => option.id === deliveryId)?.fee ?? 15) : 0;
  const total = Math.max(subtotal + shipping - discount, 0);

  function toggleSelection(productId: string): void {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  async function handleRemoveItem(productId: string): Promise<void> {
    setRemovingIds((previous) => {
      const next = new Set(previous);
      next.add(productId);
      return next;
    });

    try {
      await removeItem(productId);
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(productId);
        return next;
      });
    } catch {
      Alert.alert('Remove failed', 'Could not remove item. Please try again.');
    } finally {
      setRemovingIds((previous) => {
        const next = new Set(previous);
        next.delete(productId);
        return next;
      });
    }
  }

  async function handleClearCart(): Promise<void> {
    try {
      await clearCart();
      setSelectedIds(new Set());
      setAppliedPromoCode(null);
      setPromoInput('');
    } catch {
      Alert.alert('Clear cart failed', 'Could not clear cart. Please try again.');
    }
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      await initializeFromDatabase();
    } catch {
      Alert.alert('Refresh failed', 'Could not refresh cart. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }

  function applyPromo(): void {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Promo', 'Enter a promo code first.');
      return;
    }
    if (!PROMO_CODES[code]) {
      Alert.alert('Promo', 'Invalid promo code.');
      return;
    }
    setAppliedPromoCode(code);
  }

  function removePromo(): void {
    setAppliedPromoCode(null);
    setPromoInput('');
  }

  function checkout(): void {
    if (items.length === 0) {
      Alert.alert('Cart is empty', 'Add products before checkout.');
      return;
    }
    if (selectedItems.length === 0) {
      Alert.alert('No selected items', 'Select at least one item to continue.');
      return;
    }
    setCheckoutDraft({
      mode: 'cart',
      items: selectedItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
    router.push('/checkout');
  }

  function renderItem({ item }: { item: CartItem }) {
    const checked = selectedIds.has(item.productId);
    const isRemoving = removingIds.has(item.productId);
    return (
      <Pressable
        style={[styles.itemCard, isRemoving && styles.itemCardRemoving]}
        onPress={() => router.push(`/product/${item.productId.split('::')[0]}`)}>
        <Pressable
          disabled={isRemoving}
          style={[styles.checkBox, checked && styles.checkBoxActive]}
          onPress={(event) => {
            event.stopPropagation();
            toggleSelection(item.productId);
          }}>
          {checked ? <MaterialIcons name="check" size={16} color="#111827" /> : null}
        </Pressable>

        <Image
          source={{ uri: getImageForProduct(item.imageUrl) }}
          style={styles.itemImage}
          resizeMode="cover"
        />

        <View style={styles.itemMeta}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        </View>

        <View style={styles.qtyGroup}>
          <Pressable
            disabled={isRemoving}
            style={styles.qtyBtn}
            onPress={(event) => {
              event.stopPropagation();
              void updateItemQuantity(item.productId, Math.max(1, item.quantity - 1));
            }}>
            <Text style={styles.qtyText}>-</Text>
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable
            disabled={isRemoving}
            style={styles.qtyBtn}
            onPress={(event) => {
              event.stopPropagation();
              void updateItemQuantity(item.productId, item.quantity + 1);
            }}>
            <Text style={styles.qtyText}>+</Text>
          </Pressable>
        </View>

        <Pressable
          disabled={isRemoving}
          style={styles.removeBtn}
          onPress={(event) => {
            event.stopPropagation();
            void handleRemoveItem(item.productId);
          }}>
          <MaterialIcons name="close" size={16} color="#4b5563" />
        </Pressable>
      </Pressable>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>My Cart</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#ff4d4f" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search cart items..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
            {search.trim().length > 0 ? (
              <Pressable onPress={() => setSearch('')}>
                <MaterialIcons name="close" size={18} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.productId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Your cart is empty.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.deliveryRow}>
              {DELIVERY_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.deliveryChip, option.id === deliveryId && styles.deliveryChipActive]}
                  onPress={() => setDeliveryId(option.id)}>
                  <Text style={[styles.deliveryText, option.id === deliveryId && styles.deliveryTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.promoRow}>
              <TextInput
                value={promoInput}
                onChangeText={setPromoInput}
                autoCapitalize="characters"
                placeholder="Promo code"
                placeholderTextColor="#9ca3af"
                style={styles.promoInput}
              />
              {appliedPromoCode ? (
                <Pressable style={styles.promoBtnMuted} onPress={removePromo}>
                  <Text style={styles.promoBtnMutedText}>Remove</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.promoBtn} onPress={applyPromo}>
                  <Text style={styles.promoBtnText}>Apply</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Selected Items</Text><Text style={styles.summaryValue}>{selectedItems.length}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Sub Total</Text><Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Shipping</Text><Text style={styles.summaryValue}>${shipping.toFixed(2)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Discount</Text><Text style={styles.discountValue}>-${discount.toFixed(2)}</Text></View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>${total.toFixed(2)}</Text></View>

            <View style={styles.summaryActions}>
              <Pressable style={styles.clearBtn} onPress={() => void handleClearCart()}>
                <Text style={styles.clearBtnText}>Clear Cart</Text>
              </Pressable>
              <Pressable style={styles.checkoutBtn} onPress={checkout}>
                <Text style={styles.checkoutText}>Check out</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f5f6' },
  heroSection: {
    backgroundColor: '#FF6700',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  searchRow: { marginTop: 14 },
  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchInput: { flex: 1, color: '#111827', fontSize: 15, paddingVertical: 0, fontWeight: '500' },
  listContent: { flexGrow: 1, padding: 12, paddingTop: 18, gap: 12, paddingBottom: 32 },
  itemCard: {
    minHeight: 116,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  itemCardRemoving: { opacity: 0.5 },
  checkBox: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cfd4dc',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: { backgroundColor: '#ffe7e7', borderColor: '#ffb4b4' },
  removeBtn: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: { width: 112, height: 82, borderRadius: 12, backgroundColor: '#f3f4f6' },
  itemMeta: { flex: 1, justifyContent: 'center', gap: 6, paddingRight: 8 },
  itemName: { color: '#111111', fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  itemPrice: { color: '#1f2937', fontSize: 14, fontWeight: '700' },
  qtyGroup: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  qtyText: { fontSize: 16, fontWeight: '800', color: '#111' },
  qtyValue: { minWidth: 16, textAlign: 'center', fontWeight: '700', color: '#111' },
  emptyWrap: { marginTop: 18, paddingVertical: 24, alignItems: 'center', gap: 10 },
  emptyText: { color: '#555', fontSize: 15 },
  summaryCard: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  deliveryRow: { flexDirection: 'row', gap: 8 },
  deliveryChip: { flex: 1, minHeight: 34, borderRadius: 17, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  deliveryChipActive: { backgroundColor: '#ffeaea', borderColor: '#ffcece' },
  deliveryText: { color: '#4b5563', fontWeight: '700', fontSize: 12 },
  deliveryTextActive: { color: '#b91c1c' },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb' },
  promoBtn: { borderRadius: 10, backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 10 },
  promoBtnText: { color: '#fff', fontWeight: '700' },
  promoBtnMuted: { borderRadius: 10, backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 10 },
  promoBtnMutedText: { color: '#b91c1c', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#6b7280' },
  summaryValue: { color: '#111827', fontWeight: '700' },
  discountValue: { color: '#dc2626', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  totalLabel: { color: '#111827', fontWeight: '800', fontSize: 18 },
  totalValue: { color: '#111827', fontWeight: '900', fontSize: 24 },
  summaryActions: { marginTop: 6, flexDirection: 'row', gap: 8 },
  clearBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { color: '#1f2937', fontWeight: '700' },
  checkoutBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#FF6700', alignItems: 'center', justifyContent: 'center' },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
