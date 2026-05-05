import type { CartConflict, CartItem } from '@/src/features/cart/model/types';
import { API_BASE_URL, API_ENDPOINTS, IS_FAKE_STORE_API } from '@/src/services/api/endpoints';
import { requestJsonWithRetry } from '@/src/services/api/http';

export type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  imageUrls?: string[];
  category?: string;
};

export type FetchProductsParams = {
  page?: number;
  pageSize?: number;
};

export type FetchProductsResult = {
  items: Product[];
  hasMore: boolean;
  nextPage: number | null;
};

type ProductApiResponse = Product[] | { items: Product[]; hasMore?: boolean; nextPage?: number | null };
type FakeStoreProduct = {
  id: number;
  title: string;
  price: number;
  image: string;
  category: string;
};
type DummyJsonProduct = {
  id: number;
  title: string;
  price: number;
  thumbnail?: string;
  images?: string[];
  category?: string;
};
type DummyJsonProductsResponse = {
  products: DummyJsonProduct[];
  total: number;
  skip: number;
  limit: number;
};
const DUMMY_JSON_BASE_URL = 'https://dummyjson.com';
const FAKE_STORE_PREFIX = 'fs';
const DUMMY_JSON_PREFIX = 'dj';
let combinedLiveCatalogCache: Product[] | null = null;

export type CartValidationResult = {
  valid: boolean;
  issues: string[];
  conflicts?: CartConflict[];
  totals?: {
    subtotal: number;
    tax: number;
    shipping: number;
    grandTotal: number;
  };
};

export type SubmitOrderInput = {
  items: CartItem[];
  customerId: string;
  shippingAddress: string;
  paymentMethodId: string;
};

export type SubmitOrderResult = {
  orderId: string;
  status: 'PLACED' | 'PENDING';
  placedAt: string;
};

export const MOCK_PRODUCTS: Product[] = [
  { id: 'cat-1001', name: 'Mid Century Sofa', price: 280, imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1002', name: 'Modern Wingback Chair', price: 140, imageUrl: 'https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1003', name: 'Mini Wooden Table', price: 165, imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1004', name: 'Mini Pottery Teapot', price: 125, imageUrl: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1005', name: 'Parabolic Reflector Lamp', price: 170, imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1006', name: 'Mini Bookshelf', price: 165, imageUrl: 'https://images.unsplash.com/photo-1588279102920-e41f0f87353f?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1007', name: 'Marble Flower Vase', price: 170, imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1008', name: 'Accent Stool', price: 90, imageUrl: 'https://images.unsplash.com/photo-1578898887932-dce23a595ad4?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1009', name: 'Low Console Table', price: 210, imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1010', name: 'Curved Floor Lamp', price: 110, imageUrl: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1011', name: 'Soft Lounge Chair', price: 200, imageUrl: 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1012', name: 'Wood Side Cabinet', price: 240, imageUrl: 'https://images.unsplash.com/photo-1556911220-bda9f7f7597e?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1013', name: 'Cloud Runner Sneakers', price: 120, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1014', name: 'Leather Court Shoes', price: 95, imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1015', name: 'Trail Hiking Shoes', price: 130, imageUrl: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1016', name: 'Mesh Running Tee', price: 32, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1017', name: 'Classic Denim Jacket', price: 74, imageUrl: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1018', name: 'Cotton Relaxed Hoodie', price: 58, imageUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1019', name: 'Silk Office Blouse', price: 49, imageUrl: 'https://images.unsplash.com/photo-1551163943-3f7e29e3f8f5?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1020', name: 'Slim Chino Pants', price: 52, imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1021', name: 'Noise Cancel Headphones', price: 180, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1022', name: 'True Wireless Earbuds', price: 79, imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1023', name: 'Smart Fitness Watch', price: 155, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1024', name: 'Stainless Chronograph', price: 230, imageUrl: 'https://images.unsplash.com/photo-1434056886845-dac89ffe9b56?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1025', name: 'Portable Bluetooth Speaker', price: 68, imageUrl: 'https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1026', name: '4K Action Camera', price: 190, imageUrl: 'https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1027', name: 'Ceramic Dinner Plate Set', price: 45, imageUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1028', name: 'Nonstick Cookware Kit', price: 135, imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1029', name: 'Bamboo Cutting Board', price: 22, imageUrl: 'https://images.unsplash.com/photo-1615486363977-55cf1f91f8d3?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1030', name: 'Espresso Coffee Grinder', price: 88, imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1031', name: 'Organic Face Cleanser', price: 18, imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1032', name: 'Vitamin C Serum', price: 27, imageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38c93?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1033', name: 'Hydrating Body Lotion', price: 16, imageUrl: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1034', name: 'Beard Grooming Kit', price: 36, imageUrl: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1035', name: 'Yoga Mat Pro', price: 42, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1036', name: 'Adjustable Dumbbell Pair', price: 260, imageUrl: 'https://images.unsplash.com/photo-1517964603305-11c0f6f66012?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1037', name: 'Resistance Band Set', price: 29, imageUrl: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1038', name: 'Cycling Water Bottle', price: 14, imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1039', name: 'Travel Backpack 35L', price: 92, imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1040', name: 'Hard Shell Carry-On', price: 145, imageUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1041', name: 'Packing Cube Set', price: 24, imageUrl: 'https://images.unsplash.com/photo-1529312266912-b33f7f30f43a?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1042', name: 'Neck Pillow Memory Foam', price: 21, imageUrl: 'https://images.unsplash.com/photo-1511546395756-590dffdcdbd1?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1043', name: 'Minimal Desk Lamp', price: 47, imageUrl: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1044', name: 'Ergonomic Office Chair', price: 320, imageUrl: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1045', name: 'Mechanical Keyboard', price: 99, imageUrl: 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1046', name: 'Wireless Vertical Mouse', price: 44, imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1047', name: 'Cotton Bedsheet Set', price: 63, imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1048', name: 'Weighted Blanket', price: 118, imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1049', name: 'Aromatherapy Diffuser', price: 39, imageUrl: 'https://images.unsplash.com/photo-1608571423539-e951a7f33c1f?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1050', name: 'Scented Candle Trio', price: 28, imageUrl: 'https://images.unsplash.com/photo-1603006905393-c0e0e7f7f8f0?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1051', name: 'Gaming Monitor 27-inch', price: 289, imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1052', name: 'USB-C Hub 8-in-1', price: 49, imageUrl: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1053', name: 'Smartphone Gimbal', price: 119, imageUrl: 'https://images.unsplash.com/photo-1508896694512-1eade558679c?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1054', name: 'Portable SSD 1TB', price: 149, imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1055', name: 'Kids Learning Tablet', price: 169, imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1056', name: 'Wooden Puzzle Set', price: 26, imageUrl: 'https://images.unsplash.com/photo-1612196808214-bd0d2f9db3f3?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1057', name: 'Pet Grooming Brush', price: 19, imageUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1058', name: 'Automatic Pet Feeder', price: 129, imageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1059', name: 'Garden Watering Hose', price: 34, imageUrl: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=60' },
  { id: 'cat-1060', name: 'Solar Pathway Lights', price: 54, imageUrl: 'https://images.unsplash.com/photo-1473445361085-b9a07f55608b?auto=format&fit=crop&w=900&q=60' },
];

function toProduct(item: Product | FakeStoreProduct): Product {
  if ('name' in item) {
    return {
      id: String(item.id),
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      imageUrls: item.imageUrls,
      category: item.category,
    };
  }

  return {
    id: String(item.id),
    name: item.title,
    price: item.price,
    imageUrl: item.image,
    category: item.category,
  };
}

function withSourceId(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
}

function splitSourceId(rawId: string): { source: string | null; id: string } {
  const [source, id] = rawId.split(':');
  if (!id) {
    return { source: null, id: rawId };
  }
  return { source, id };
}

function mapFakeStoreProduct(item: FakeStoreProduct): Product {
  return {
    id: withSourceId(FAKE_STORE_PREFIX, item.id),
    name: item.title,
    price: item.price,
    imageUrl: item.image,
    imageUrls: [item.image],
    category: item.category,
  };
}

function mapDummyJsonProduct(item: DummyJsonProduct): Product {
  const gallery = item.images && item.images.length > 0
    ? item.images
    : item.thumbnail
      ? [item.thumbnail]
      : [];

  return {
    id: withSourceId(DUMMY_JSON_PREFIX, item.id),
    name: item.title,
    price: item.price,
    imageUrl: item.thumbnail ?? item.images?.[0],
    imageUrls: gallery,
    category: item.category,
  };
}

async function fetchCombinedLiveCatalog(): Promise<Product[]> {
  if (combinedLiveCatalogCache) {
    return combinedLiveCatalogCache;
  }

  const [fakeResult, dummyResult] = await Promise.allSettled([
    requestJsonWithRetry<FakeStoreProduct[]>(`${API_BASE_URL}${API_ENDPOINTS.products}`, {
      method: 'GET',
      retries: 2,
      retryDelayMs: 500,
    }),
    requestJsonWithRetry<DummyJsonProductsResponse>(`${DUMMY_JSON_BASE_URL}/products?limit=0`, {
      method: 'GET',
      retries: 2,
      retryDelayMs: 500,
    }),
  ]);

  const combined: Product[] = [];
  if (fakeResult.status === 'fulfilled') {
    combined.push(...fakeResult.value.map(mapFakeStoreProduct));
  }
  if (dummyResult.status === 'fulfilled') {
    combined.push(...dummyResult.value.products.map(mapDummyJsonProduct));
  }

  if (combined.length === 0) {
    throw new Error('Both live product sources failed.');
  }

  combinedLiveCatalogCache = combined;
  return combinedLiveCatalogCache;
}

export async function fetchProductCategories(): Promise<string[]> {
  try {
    if (IS_FAKE_STORE_API) {
      const catalog = await fetchCombinedLiveCatalog();
      const unique = new Set(
        catalog
          .map((item) => item.category?.trim())
          .filter((value): value is string => Boolean(value))
      );
      return [...unique];
    }

    const firstPage = await fetchProducts({ page: 1, pageSize: 100 });
    const unique = new Set(
      firstPage.items
        .map((item) => item.category?.trim())
        .filter((value): value is string => Boolean(value))
    );
    return [...unique];
  } catch {
    try {
      const categories = await requestJsonWithRetry<string[]>(
        `${DUMMY_JSON_BASE_URL}/products/category-list`,
        { method: 'GET', retries: 2, retryDelayMs: 500 }
      );
      return categories;
    } catch {
      return ['electronics', 'jewelery', "men's clothing", "women's clothing"];
    }
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  if (!id) {
    return null;
  }

  const { source, id: sourceId } = splitSourceId(id);

  try {
    if (IS_FAKE_STORE_API) {
      if (source === DUMMY_JSON_PREFIX) {
        const item = await requestJsonWithRetry<DummyJsonProduct>(
          `${DUMMY_JSON_BASE_URL}/products/${sourceId}`,
          { method: 'GET', retries: 2, retryDelayMs: 500 }
        );
        return mapDummyJsonProduct(item);
      }

      const item = await requestJsonWithRetry<FakeStoreProduct>(
        `${API_BASE_URL}${API_ENDPOINTS.products}/${sourceId}`,
        { method: 'GET', retries: 2, retryDelayMs: 500 }
      );
      return mapFakeStoreProduct(item);
    }
  } catch {
    try {
      const item = await requestJsonWithRetry<DummyJsonProduct>(
        `${DUMMY_JSON_BASE_URL}/products/${sourceId}`,
        { method: 'GET', retries: 2, retryDelayMs: 500 }
      );
      return mapDummyJsonProduct(item);
    } catch {
      // Fall through to local fallback.
    }
  }

  return MOCK_PRODUCTS.find((item) => item.id === sourceId) ?? null;
}

export async function fetchProducts(params: FetchProductsParams = {}): Promise<FetchProductsResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const skip = (page - 1) * pageSize;

  try {
    if (IS_FAKE_STORE_API) {
      const combined = await fetchCombinedLiveCatalog();
      const items = combined.slice(skip, skip + pageSize);
      return {
        items,
        hasMore: skip + pageSize < combined.length,
        nextPage: skip + pageSize < combined.length ? page + 1 : null,
      };
    }

    const query = `?page=${page}&pageSize=${pageSize}`;
    const response = await requestJsonWithRetry<ProductApiResponse>(
      `${API_BASE_URL}${API_ENDPOINTS.products}${query}`,
      {
        method: 'GET',
        retries: 2,
        retryDelayMs: 500,
      }
    );

    if (Array.isArray(response)) {
      const normalized = response.map((item) => toProduct(item as Product | FakeStoreProduct));
      const start = (page - 1) * pageSize;
      const items = normalized.slice(start, start + pageSize);
      return {
        items,
        hasMore: start + pageSize < normalized.length,
        nextPage: start + pageSize < normalized.length ? page + 1 : null,
      };
    }

    const items = (response.items ?? []).map((item) => toProduct(item as Product | FakeStoreProduct));
    return {
      items,
      hasMore: response.hasMore ?? items.length === pageSize,
      nextPage: response.nextPage ?? (items.length === pageSize ? page + 1 : null),
    };
  } catch {
    try {
      const response = await requestJsonWithRetry<DummyJsonProductsResponse>(
        `${DUMMY_JSON_BASE_URL}/products?limit=${pageSize}&skip=${skip}`,
        { method: 'GET', retries: 2, retryDelayMs: 500 }
      );
      const items = response.products.map((item) => ({
        ...mapDummyJsonProduct(item),
      }));
      const nextOffset = response.skip + response.limit;
      return {
        items,
        hasMore: nextOffset < response.total,
        nextPage: nextOffset < response.total ? page + 1 : null,
      };
    } catch {
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const items = MOCK_PRODUCTS.slice(start, end);
      return {
        items,
        hasMore: end < MOCK_PRODUCTS.length,
        nextPage: end < MOCK_PRODUCTS.length ? page + 1 : null,
      };
    }
  }
}

export async function validateCart(items: CartItem[]): Promise<CartValidationResult> {
  if (IS_FAKE_STORE_API) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = items.length > 0 ? 15 : 0;
    const tax = Number((subtotal * 0.12).toFixed(2));
    const grandTotal = Math.max(subtotal + shipping + tax, 0);
    return {
      valid: true,
      issues: [],
      totals: {
        subtotal,
        tax,
        shipping,
        grandTotal,
      },
    };
  }

  return requestJsonWithRetry<CartValidationResult>(
    `${API_BASE_URL}${API_ENDPOINTS.validateCart}`,
    {
      method: 'POST',
      body: { items },
      retries: 2,
      retryDelayMs: 500,
    }
  );
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  if (IS_FAKE_STORE_API) {
    return {
      orderId: `demo-${Date.now()}`,
      status: 'PLACED',
      placedAt: new Date().toISOString(),
    };
  }

  return requestJsonWithRetry<SubmitOrderResult>(`${API_BASE_URL}${API_ENDPOINTS.submitOrder}`, {
    method: 'POST',
    body: input,
    retries: 3,
    retryDelayMs: 700,
  });
}
