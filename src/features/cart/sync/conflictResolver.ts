import {
  deleteCartItemFromStorage,
  updateCartItemPriceInStorage,
} from '@/src/features/cart/data/cartLocalDataSource';
import type { CartConflict } from '@/src/features/cart/model/types';
import { logInfo } from '@/src/services/logging/logger';

export function applyCartConflicts(conflicts: CartConflict[]): void {
  for (const conflict of conflicts) {
    if (conflict.type === 'OUT_OF_STOCK') {
      // Rule: unavailable items are removed locally so cart stays purchasable.
      deleteCartItemFromStorage(conflict.productId);
      logInfo('Resolved OUT_OF_STOCK by removing item', {
        productId: conflict.productId,
      });
      continue;
    }

    if (conflict.type === 'PRICE_CHANGED') {
      // Rule: local item price is updated to server-authoritative price.
      updateCartItemPriceInStorage(conflict.productId, conflict.newPrice);
      logInfo('Resolved PRICE_CHANGED by updating item price', {
        productId: conflict.productId,
        newPrice: conflict.newPrice,
      });
    }
  }
}
