export const API_BASE_URL = 'https://fakestoreapi.com';
export const IS_FAKE_STORE_API = API_BASE_URL.includes('fakestoreapi.com');

export const API_ENDPOINTS = {
  products: '/products',
  validateCart: '/cart/validate',
  submitOrder: '/orders',
  cartOperations: '/cart/operations',
} as const;
