import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/src/features/auth/state/authStore';
import { useCartStore } from '@/src/features/cart/state/cartStore';
import { useCheckoutDraftStore } from '@/src/features/orders/state/checkoutDraftStore';
import { fetchProductById, MOCK_PRODUCTS, type Product } from '@/src/services/api/commerceApi';
import { getDatabase } from '@/src/services/storage/sqlite/db';

const SIZES = ['US 4', 'US 4.5', 'US 5', 'US 5.5', 'US 6'];
const COLORS = ['Black', 'White', 'Red', 'Blue'];
const PRODUCT_DETAILS: Record<string, { description: string; material: string; shipping: string; returns: string; features: string[] }> = {
  'furn-1001': {
    description: 'A compact sofa designed for modern apartments with a comfortable deep seat and durable frame.',
    material: 'Linen blend upholstery, kiln-dried wood frame.',
    shipping: 'Ships in 2-4 business days.',
    returns: '7-day return window for defects or transit damage.',
    features: ['Soft cushioning', 'Space-saving width', 'Easy-clean fabric'],
  },
  'furn-1002': {
    description: 'Wingback chair with ergonomic support for reading corners and lounge spaces.',
    material: 'Textile seat, solid wood legs.',
    shipping: 'Ships in 2-4 business days.',
    returns: '7-day return window for defects or transit damage.',
    features: ['Neck support', 'Compact footprint', 'Stable leg base'],
  },
  'furn-1003': {
    description: 'Minimal wooden side table for living room or bedside use.',
    material: 'Engineered wood with matte finish.',
    shipping: 'Ships in 1-3 business days.',
    returns: '7-day return window for defects or transit damage.',
    features: ['Scratch-resistant top', 'Rounded edges', 'Multi-use design'],
  },
};

export default function ProductDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((state) => state.addItem);
  const setCheckoutDraft = useCheckoutDraftStore((state) => state.setDraft);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const session = useAuthStore((state) => state.session);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Sync wishlist status with database
  useEffect(() => {
    if (session?.id && product?.id) {
      const db = getDatabase();
      const row = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM wishlist WHERE user_id = ? AND product_id = ?;',
        [session.id, product.id]
      );
      setIsWishlisted(!!row && row.count > 0);
    }
  }, [session?.id, product?.id]);

  const handleToggleWishlist = useCallback(() => {
    if (!session?.id) {
      Alert.alert('Login Required', 'Please sign in to wishlist items.');
      return;
    }
    if (!product) return;

    const db = getDatabase();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isWishlisted) {
      db.runSync('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?;', [session.id, product.id]);
      setIsWishlisted(false);
    } else {
      db.runSync(
        'INSERT OR REPLACE INTO wishlist (user_id, product_id, name, price, image_url) VALUES (?, ?, ?, ?, ?);',
        [session.id, product.id, product.name, product.price, product.imageUrl ?? null] // Ensure imageUrl is string | null
      );
      setIsWishlisted(true);
    }
  }, [session?.id, product, isWishlisted]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setLoadingProduct(true);
      const fetched = await fetchProductById(String(id ?? ''));
      if (!mounted) {
        return;
      }
      setProduct(fetched ?? MOCK_PRODUCTS[0]);
      setLoadingProduct(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const resolvedProduct = useMemo(() => product ?? MOCK_PRODUCTS[0], [product]);

  const details = PRODUCT_DETAILS[resolvedProduct.id] ?? {
    description: 'A curated home product selected for quality, comfort, and practical everyday use.',
    material: 'Quality mixed materials for long-term use.',
    shipping: 'Ships in 2-5 business days.',
    returns: '7-day return window for defects or transit damage.',
    features: ['Reliable build quality', 'Thoughtful design', 'Great value'],
  };
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [pendingAction, setPendingAction] = useState<'add' | 'buy' | null>(null);
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const galleryImages = useMemo(() => {
    const candidates = resolvedProduct.imageUrls && resolvedProduct.imageUrls.length > 0
      ? resolvedProduct.imageUrls
      : resolvedProduct.imageUrl
        ? [resolvedProduct.imageUrl]
        : [];

    return [...new Set(candidates.filter(Boolean))];
  }, [resolvedProduct.imageUrl, resolvedProduct.imageUrls]);

  const activeImage = galleryImages[selectedImageIndex] ?? resolvedProduct.imageUrl;

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [resolvedProduct.id]);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    const fetched = await fetchProductById(String(id ?? ''));
    if (fetched) {
      setProduct(fetched);
    }
    setRefreshing(false);
  }

  function openOptions(action: 'add' | 'buy'): void {
    if (isAdding || isBuyingNow) {
      return;
    }
    setPendingAction(action);
    setShowOptions(true);
  }

  function variantId(baseId: string, color: string, size: string): string {
    return `${baseId}::${color.toLowerCase()}::${size.toLowerCase().replace(/\s+/g, '-')}`;
  }

  function variantName(baseName: string, color: string, size: string): string {
    return `${baseName} (${color}, ${size})`;
  }

  async function confirmSelection(): Promise<void> {
    const lineId = variantId(resolvedProduct.id, selectedColor, selectedSize);
    const lineName = variantName(resolvedProduct.name, selectedColor, selectedSize);

    if (pendingAction === 'buy') {
      setShowOptions(false);
      setIsBuyingNow(true);
      try {
        await addItem({
          id: lineId,
          name: lineName,
          price: resolvedProduct.price,
          imageUrl: resolvedProduct.imageUrl,
          quantity: selectedQuantity,
        });
        setCheckoutDraft({
          mode: 'buy_now',
          items: [
            {
              productId: lineId,
              name: lineName,
              price: resolvedProduct.price,
              quantity: selectedQuantity,
            },
          ],
        });
        setPendingAction(null);
        requestAnimationFrame(() => {
          router.push('/checkout');
        });
      } catch {
        Alert.alert('Checkout unavailable', 'Could not add item to cart. Please try again.');
      } finally {
        setIsBuyingNow(false);
      }
      return;
    }

    setShowOptions(false);
    setPendingAction(null);
    setIsAdding(true);
    try {
      await addItem({
          id: lineId,
          name: lineName,
          price: resolvedProduct.price,
          imageUrl: resolvedProduct.imageUrl,
          quantity: selectedQuantity,
        });
      Alert.alert('Added to cart', `${lineName} x${selectedQuantity}`);
    } catch {
      Alert.alert('Add failed', 'Could not add item to cart. Please try again.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <View style={styles.page}>
      {loadingProduct ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={20} color="#111827" />
          </Pressable>
          <Text style={styles.topTitle}>Product Details</Text>
          <Pressable style={styles.iconBtn} onPress={handleToggleWishlist}>
            <MaterialIcons 
              name={isWishlisted ? "favorite" : "favorite-border"} 
              size={20} 
              color={isWishlisted ? Colors.primary : "#111827"} 
            />
          </Pressable>
        </View>

        <View style={styles.heroBox}>
          <Image source={{ uri: activeImage }} style={styles.heroImage} />
        </View>

        <View style={styles.thumbRow}>
          {galleryImages.map((imageUrl, index) => (
            <Pressable key={`${imageUrl}-${index}`} onPress={() => setSelectedImageIndex(index)}>
              <Image source={{ uri: imageUrl }} style={[styles.thumb, index === selectedImageIndex && styles.thumbActive]} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.name}>{resolvedProduct.name}</Text>
        <Text style={styles.price}>${resolvedProduct.price.toFixed(2)}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}><Text style={styles.metaText}>5 Pair Left</Text></View>
          <View style={styles.metaChip}><Text style={styles.metaText}>Sold 50</Text></View>
          <View style={styles.metaChip}><Text style={styles.metaText}>★ 4.7</Text></View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Product Details</Text>
          <Text style={styles.detailText}>{details.description}</Text>
          <Text style={styles.detailLabel}>Material</Text>
          <Text style={styles.detailText}>{details.material}</Text>
          <Text style={styles.detailLabel}>Key Features</Text>
          {details.features.map((feature) => (
            <Text key={feature} style={styles.featureText}>• {feature}</Text>
          ))}
          <Text style={styles.detailLabel}>Shipping</Text>
          <Text style={styles.detailText}>{details.shipping}</Text>
          <Text style={styles.detailLabel}>Returns</Text>
          <Text style={styles.detailText}>{details.returns}</Text>
          <Text style={styles.skuText}>SKU: {resolvedProduct.id.toUpperCase()}</Text>
        </View>
      </ScrollView>

      {!showOptions ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[styles.addBtn, isAdding && styles.buttonDisabled]} onPress={() => openOptions('add')} disabled={isAdding || isBuyingNow}>
            <Text style={styles.addText}>{isAdding ? 'Adding...' : 'Add to Cart'}</Text>
          </Pressable>
          <Pressable style={[styles.buyBtn, isBuyingNow && styles.buttonDisabled]} onPress={() => openOptions('buy')} disabled={isBuyingNow || isAdding}>
            <Text style={styles.buyText}>{isBuyingNow ? 'Processing...' : 'Buy Now'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={showOptions} transparent animationType="slide" onRequestClose={() => setShowOptions(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 10, 24) }]}>
            <Text style={styles.modalTitle}>Select Options</Text>
            <Text style={styles.modalLabel}>Color</Text>
            <View style={styles.optionRow}>
              {COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[styles.optionChip, selectedColor === color && styles.optionChipActive]}
                  onPress={() => setSelectedColor(color)}>
                  <Text style={[styles.optionChipText, selectedColor === color && styles.optionChipTextActive]}>{color}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Size</Text>
            <View style={styles.optionRow}>
              {SIZES.map((size) => (
                <Pressable
                  key={size}
                  style={[styles.optionChip, selectedSize === size && styles.optionChipActive]}
                  onPress={() => setSelectedSize(size)}>
                  <Text style={[styles.optionChipText, selectedSize === size && styles.optionChipTextActive]}>{size}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Quantity</Text>
            <View style={styles.qtyPickerRow}>
              <Pressable
                style={styles.qtyPickerBtn}
                onPress={() => setSelectedQuantity((current) => Math.max(1, current - 1))}>
                <Text style={styles.qtyPickerBtnText}>-</Text>
              </Pressable>
              <Text style={styles.qtyPickerValue}>{selectedQuantity}</Text>
              <Pressable style={styles.qtyPickerBtn} onPress={() => setSelectedQuantity((current) => current + 1)}>
                <Text style={styles.qtyPickerBtnText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowOptions(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={() => void confirmSelection()}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.modalConfirmText}>
                  {pendingAction === 'buy' ? 'Continue to Checkout' : 'Add to Cart'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' },
  loadingWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: 'rgba(243,244,246,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: { color: '#374151', fontWeight: '600' },
  content: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 120 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  heroBox: { borderRadius: 20, backgroundColor: '#ffffff', padding: 14, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  heroImage: { width: '100%', height: 260, borderRadius: 16, backgroundColor: '#f3f4f6' },
  thumbRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff' },
  thumbActive: { borderColor: Colors.primary },
  name: { marginTop: 14, fontSize: 30, fontWeight: '800', color: '#111827' },
  price: { marginTop: 6, fontSize: 34, fontWeight: '900', color: '#111827' },
  metaRow: { marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 6, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  metaText: { color: '#4b5563', fontWeight: '600' },
  detailCard: { marginTop: 16, backgroundColor: '#ffffff', borderRadius: 16, padding: 14, gap: 6, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  detailTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  detailLabel: { marginTop: 4, color: '#374151', fontWeight: '700' },
  detailText: { color: '#4b5563', lineHeight: 20 },
  featureText: { color: '#4b5563' },
  skuText: { marginTop: 6, color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, flexDirection: 'row', gap: 8 },
  iconAction: { width: 48, borderRadius: 24, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  addBtn: { flex: 1, borderRadius: 24, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  addText: { color: Colors.primary, fontWeight: '800' },
  buyBtn: { flex: 1, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  buyText: { color: '#fff', fontWeight: '800' },
  buttonDisabled: { opacity: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalLabel: { marginTop: 4, color: '#374151', fontWeight: '700' },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  optionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionChipText: { color: '#374151', fontWeight: '700' },
  optionChipTextActive: { color: '#fff' },
  qtyPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, // Removed shadows
  qtyPickerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', /* Removed shadows */ },
  qtyPickerBtnText: { fontSize: 20, fontWeight: '800', color: '#111827' },
  qtyPickerValue: { minWidth: 30, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    /* Removed shadows */
  },
  modalCancelText: { color: '#1f2937', fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  }, // Removed shadows
  modalConfirmText: { color: '#fff', fontWeight: '800', textAlign: 'center', width: '100%', fontSize: 15 },
});
