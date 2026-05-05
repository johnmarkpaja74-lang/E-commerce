import {
  clearCartOperationsFromStorage,
  deleteCartItemFromStorage,
  insertCartOperationToStorage,
  loadCartItemsFromStorage,
  loadCartOperationsFromStorage,
  upsertCartItemInStorage,
} from '@/src/features/cart/data/cartLocalDataSource';
import { runMigrations } from '@/src/services/storage/sqlite/migrations';
import type { CartItemRow, CartOperationType } from '@/src/features/cart/model/types';

export type { CartItemRow } from '@/src/features/cart/model/types';

export type CartOperationRow = {
  id: number;
  type: CartOperationType;
  payload_json: string;
  timestamp: number;
};

export function initializeCartTables(): void {
  runMigrations();
}

export function loadCartItemsFromDatabase(): CartItemRow[] {
  return loadCartItemsFromStorage();
}

export function upsertCartItemInDatabase(item: CartItemRow): void {
  upsertCartItemInStorage(item);
}

export function deleteCartItemFromDatabase(productId: string): void {
  deleteCartItemFromStorage(productId);
}

export function addCartOperationToDatabase(operation: {
  type: CartOperationType;
  payload: Record<string, unknown>;
  timestamp: number;
}): void {
  insertCartOperationToStorage(operation);
}

export function loadCartOperationsFromDatabase(): CartOperationRow[] {
  return loadCartOperationsFromStorage().map((row) => ({
    id: row.id,
    type: row.type,
    payload_json: row.payload_json,
    timestamp: row.timestamp,
  }));
}

export function clearCartOperationsFromDatabase(): void {
  clearCartOperationsFromStorage();
}
