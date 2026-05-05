import { isOnline } from '@/src/services/network/connectivity';
import {
  clearCartItemsFromStorage,
  deleteCartItemFromStorage,
  loadCartItemsFromStorage,
  upsertCartItemInStorage,
} from '@/src/features/cart/data/cartLocalDataSource';
import { addOperation, clearOperations, fetchOperations } from '@/src/features/cart/data/operationLog';
import { processQueueNow } from '@/src/features/cart/sync/offlineQueue';
import type { CartItem, CartOperation } from '@/src/features/cart/model/types';

export const cartRepository = {
  loadSnapshot(): { items: CartItem[]; operations: CartOperation[] } {
    const itemRows = loadCartItemsFromStorage();
    const operations = fetchOperations();

    return {
      items: itemRows.map((row) => ({
        productId: row.product_id,
        name: row.name,
        price: row.price,
        quantity: row.quantity,
        imageUrl: row.image_url,
      })),
      operations,
    };
  },

  async saveCartItem(item: CartItem): Promise<void> {
    upsertCartItemInStorage({
      product_id: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    });
  },

  async removeCartItem(productId: string): Promise<void> {
    deleteCartItemFromStorage(productId);
  },

  async clearCart(): Promise<void> {
    clearCartItemsFromStorage();
  },

  async enqueueOperation(operation: CartOperation): Promise<void> {
    // Every mutation is always recorded locally first.
    // If offline, this remains queued. If online, queue processing starts now.
    addOperation(operation);

    if (isOnline()) {
      await processQueueNow();
    }
  },

  async clearOperationLog(): Promise<void> {
    clearOperations();
  },
};
