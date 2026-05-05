import {
  clearCartOperationsFromStorage,
  insertCartOperationToStorage,
  loadCartOperationsFromStorage,
} from '@/src/features/cart/data/cartLocalDataSource';
import type { CartOperation, CartOperationRow } from '@/src/features/cart/model/types';

function mapOperationRowToModel(row: CartOperationRow): CartOperation {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    timestamp: row.timestamp,
    synced: row.synced === 1,
  };
}

export function addOperation(operation: CartOperation): void {
  // Every mutation is logged locally with type/payload/timestamp.
  // This gives us a durable queue for later sync and replay.
  insertCartOperationToStorage(operation);
}

export function fetchOperations(): CartOperation[] {
  return loadCartOperationsFromStorage().map(mapOperationRowToModel);
}

export function clearOperations(): void {
  clearCartOperationsFromStorage();
}
