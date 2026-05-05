import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { logEvent } from 'firebase/analytics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/src/features/auth/state/authStore';
import { analyticsPromise } from '@/src/features/auth/state/config';
import { useCartStore } from '@/src/features/cart/state/cartStore';
import { usePaginatedProducts } from '@/src/features/products/state/usePaginatedProducts';
import { fetchProductCategories, type Product } from '@/src/services/api/commerceApi';

function categoryIcon(category: string): keyof typeof MaterialIcons.glyphMap {
  const key = category.toLowerCase();
  if (key.includes('electronic')) {
    return 'headphones';
  }
  if (key.includes('jewel')) {
    return 'diamond';
  }
  if (key.includes('men') || key.includes('women') || key.includes('cloth')) {
    return 'checkroom';
  }
  return 'category';
}

function categoryLabel(category: string): string {
  if (category === "men's clothing") {
    return "Men's";
  }
  if (category === "women's clothing") {
    return "Women's";
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

type ProductCardProps = {
  item: Product;
  onAddToCart: (product: Product) => void;
  onOpenProduct: (productId: string) => void;
};

function ProductCard({ item, onAddToCart, onOpenProduct }: ProductCardProps) {
  const theme = Colors;

  return (
    <Pressable style={[styles.productCard, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => onOpenProduct(item.id)}>
      <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
      <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.productBottomRow}>
        <Text style={[styles.productPrice, { color: theme.text }]}>${item.price.toFixed(2)}</Text>
        <Pressable
          style={[styles.cartMiniBtn, { backgroundColor: theme.background }]}
          onPress={(event) => {
            event.stopPropagation();
            onAddToCart(item);
          }}>
          <MaterialIcons name="shopping-bag" size={14} color={theme.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = Colors;
  const addItem = useCartStore((state) => state.addItem);
  const session = useAuthStore((state) => state.session);

  const userGreeting = useMemo(() => {
    if (!session) return 'Hello, Guest';
    const name = session.displayName || session.email.split('@')[0];
    return `Hi, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
  }, [session]);

  const { products, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh, retryInitialLoad } =
    usePaginatedProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddingId, setIsAddingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const next = await fetchProductCategories();
      if (mounted) {
        setCategories(next);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    let next = [...products];
    const query = searchQuery.trim().toLowerCase();

    if (query.length > 0) {
      next = next.filter((item) => item.name.toLowerCase().includes(query));
    }

    if (selectedCategory !== 'All') {
      next = next.filter((item) => item.category === selectedCategory);
    }

    return next;
  }, [products, searchQuery, selectedCategory]);

  const categoryChips = useMemo(() => {
    const all = ['All', ...categories];
    return all.map((category) => ({
      key: category,
      label: category === 'All' ? 'All' : categoryLabel(category),
      icon: category === 'All' ? ('grid-view' as const) : categoryIcon(category),
    }));
  }, [categories]);

  async function handleAddToCart(product: Product) {
    if (isAddingId === product.id) {
      return;
    }

    setIsAddingId(product.id);
    try {
      await addItem({ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl });
      
      // Log Analytics Event
      const analytics = await analyticsPromise;
      if (analytics) {
        logEvent(analytics, 'add_to_cart', {
          item_id: product.id,
          item_name: product.name,
          price: product.price,
        });
      }
      
      Alert.alert('Added to cart', product.name);
    } catch {
      Alert.alert('Add failed', 'Could not add item to cart. Please try again.');
    } finally {
      setIsAddingId((current) => (current === product.id ? null : current));
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.centerText, { color: theme.textSecondary }]}>Loading products...</Text>
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorTitle, { color: theme.text }]}>Could not load products</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={() => void retryInitialLoad()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard 
            item={item} 
            onAddToCart={handleAddToCart} 
            onOpenProduct={(id) => router.push(`/product/${id}`)}
          />
        )}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.5}
        onEndReached={() => void loadMore()}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        ListHeaderComponent={
          <>
            <View style={styles.heroSection}>
              <View style={styles.headerTop}>
                <Text style={styles.greetingText}>{userGreeting}</Text>
                <Text style={styles.headerSubtitle}>Find your favorite items here!</Text>
              </View>
              
              <View style={styles.searchRow}>
                <View style={[styles.searchBox, { backgroundColor: theme.surface }]}>
                  <MaterialIcons name="search" size={20} color={theme.primary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search products..."
                    placeholderTextColor={theme.textSecondary}
                  />
                  {searchQuery.length > 0 ? (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <MaterialIcons name="close" size={18} color="#9ca3af" />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>#SpecialForYou</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoScroll}>
              {products.slice(0, 3).map((promo) => (
                <Pressable key={promo.id} style={styles.promoCard} onPress={() => router.push(`/product/${promo.id}`)}>
                  <Image source={{ uri: promo.imageUrl }} style={styles.promoImage} />
                  <View style={styles.promoOverlay}>
                    <Text style={styles.promoTag}>Limited time!</Text>
                    <Text style={styles.promoTitle}>Get Special Offer</Text>
                    <Text style={styles.promoSub}>Up to 40%</Text>
                    <Pressable
                      style={[styles.promoClaim, { backgroundColor: theme.primary }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleAddToCart(promo);
                      }}>
                      <Text style={styles.promoClaimText}>Claim</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Category</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categoryChips.map((category) => (
                <Pressable
                  key={category.key}
                  style={styles.categoryItem}
                  onPress={() => setSelectedCategory((current) => (current === category.key ? 'All' : category.key))}>
                  <View style={[styles.categoryIconCircle, { backgroundColor: theme.surface }]}>
                    <MaterialIcons name={category.icon} size={22} color={theme.primary} />
                  </View>
                  <Text style={[styles.categoryLabel, { color: theme.text }]}>{category.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : !hasMore ? (
            <Text style={[styles.endText, { color: theme.textSecondary }]}>You reached the end.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f5f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  centerText: { color: '#6b7280' },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  retryButton: { backgroundColor: '#FF6700', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  listContent: { paddingBottom: 72 },
  heroSection: {
    backgroundColor: '#FF6700',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: { marginBottom: 20 },
  greetingText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  headerSubtitle: { color: '#94a3b8', fontSize: 14, fontWeight: '500', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    width: '100%',
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
  sectionHeader: {
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 25, fontWeight: '800', color: '#111827' },
  promoScroll: { paddingLeft: 16, paddingRight: 6, gap: 10 },
  promoCard: { width: 300, height: 132, borderRadius: 18, overflow: 'hidden', backgroundColor: '#18181b', shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  promoImage: { width: '100%', height: '100%' },
  promoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,20,20,0.38)', padding: 12, justifyContent: 'space-between' },
  promoTag: {
    alignSelf: 'flex-start',
    color: '#111827',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoTitle: { color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 30 },
  promoSub: { color: '#f3f4f6', fontSize: 20, fontWeight: '700' },
  promoClaim: { alignSelf: 'flex-end', backgroundColor: '#FF6700', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, shadowColor: '#FF6700', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  promoClaimText: { color: '#fff', fontWeight: '800' },
  categoryRow: { paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', gap: 12 },
  categoryItem: { alignItems: 'center', width: 74 },
  categoryIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  categoryLabel: { marginTop: 7, color: '#374151', fontSize: 12, fontWeight: '600' },
  gridRow: { gap: 12, marginBottom: 12 },
  productCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 10,
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  productHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImage: { width: '100%', height: 115, borderRadius: 14, backgroundColor: '#eef1f5' },
  productName: { marginTop: 8, fontWeight: '700', color: '#374151' },
  productBottomRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  productPrice: { fontSize: 18, fontWeight: '900', color: '#111827' },
  cartMiniBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  footerLoader: { paddingVertical: 12 },
  endText: { textAlign: 'center', color: '#9ca3af', paddingVertical: 12 },
});
