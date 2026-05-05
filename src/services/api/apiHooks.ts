import {
  fetchProducts,
  submitOrder,
  validateCart,
} from '@/src/services/api/commerceApi';
import { useApiRequest } from '@/src/shared/hooks/useApiRequest';

// Example hook wrappers used by screens/components for loading+error state handling.
export function useProductsApi() {
  return useApiRequest(fetchProducts);
}

export function useValidateCartApi() {
  return useApiRequest(validateCart);
}

export function useSubmitOrderApi() {
  return useApiRequest(submitOrder);
}
