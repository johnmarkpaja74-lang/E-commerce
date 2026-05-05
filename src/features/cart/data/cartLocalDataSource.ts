import { getDatabase } from '@/src/services/storage/sqlite/db';
import type { CartItemRow, CartOperation, CartOperationRow } from '@/src/features/cart/model/types';

export function loadCartItemsFromStorage(): CartItemRow[] {
  const database = getDatabase();
  return database.getAllSync<CartItemRow>(
    'SELECT product_id, name, price, quantity, image_url FROM cart_items ORDER BY name ASC;'
  );
}

export function upsertCartItemInStorage(item: CartItemRow): void {
  const database = getDatabase();

  database.runSync(
    `
      INSERT INTO cart_items (product_id, name, price, quantity, image_url)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id)
      DO UPDATE SET
        name = excluded.name,
        price = excluded.price,
        quantity = excluded.quantity,
        image_url = excluded.image_url;
    `,
    [item.product_id, item.name, item.price, item.quantity, item.image_url ?? null]
  );
}

export function updateCartItemPriceInStorage(productId: string, newPrice: number): void {
  const database = getDatabase();
  database.runSync('UPDATE cart_items SET price = ? WHERE product_id = ?;', [newPrice, productId]);
}

export function deleteCartItemFromStorage(productId: string): void {
  const database = getDatabase();
  database.runSync('DELETE FROM cart_items WHERE product_id = ?;', [productId]);
}

export function clearCartItemsFromStorage(): void {
  const database = getDatabase();
  database.runSync('DELETE FROM cart_items;');
}

export function insertCartOperationToStorage(operation: CartOperation): void {
  const database = getDatabase();
  database.runSync(
    'INSERT INTO cart_operations (type, payload_json, timestamp, synced) VALUES (?, ?, ?, 0);',
    [operation.type, JSON.stringify(operation.payload), operation.timestamp]
  );
}

export function loadCartOperationsFromStorage(): CartOperationRow[] {
  const database = getDatabase();

  return database.getAllSync<CartOperationRow>(
    'SELECT id, type, payload_json, timestamp, synced FROM cart_operations ORDER BY timestamp ASC;'
  );
}

export function clearCartOperationsFromStorage(): void {
  const database = getDatabase();
  database.runSync('DELETE FROM cart_operations;');
}

export function loadPendingCartOperationsFromStorage(): CartOperationRow[] {
  const database = getDatabase();

  return database.getAllSync<CartOperationRow>(
    'SELECT id, type, payload_json, timestamp, synced FROM cart_operations WHERE synced = 0 ORDER BY timestamp ASC;'
  );
}

export function getPendingCartOperationCount(): number {
  try {
    const database = getDatabase();
    const result = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM cart_operations WHERE synced = 0;'
    );

    return result?.count ?? 0;
  } catch {
    // During first render, migrations may not have created tables yet.
    // Returning 0 keeps UI stable until initialization completes.
    return 0;
  }
}

export function markCartOperationSynced(operationId: number): void {
  const database = getDatabase();
  database.runSync('UPDATE cart_operations SET synced = 1 WHERE id = ?;', [operationId]);
}
