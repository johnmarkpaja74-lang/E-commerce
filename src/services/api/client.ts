import { API_BASE_URL, API_ENDPOINTS, IS_FAKE_STORE_API } from '@/src/services/api/endpoints';
import { requestJsonWithRetry } from '@/src/services/api/http';
import { logInfo } from '@/src/services/logging/logger';
import type { CartConflict, CartOperation } from '@/src/features/cart/model/types';

export type SendCartOperationResponse = {
  ok: boolean;
  conflicts?: CartConflict[];
};

export async function sendCartOperation(operation: CartOperation): Promise<SendCartOperationResponse> {
  if (IS_FAKE_STORE_API) {
    return { ok: true };
  }

  logInfo('Sending cart operation to API', {
    url: `${API_BASE_URL}${API_ENDPOINTS.cartOperations}`,
    type: operation.type,
  });

  return requestJsonWithRetry<SendCartOperationResponse>(
    `${API_BASE_URL}${API_ENDPOINTS.cartOperations}`,
    {
      method: 'POST',
      body: operation,
      retries: 3,
      retryDelayMs: 600,
    }
  );
}
