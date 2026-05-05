import type { CartItem, CartOperation } from './types';

type RebuildResult = {
  items: CartItem[];
  invalidOperationCount: number;
};

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compareOperations(a: CartOperation, b: CartOperation): number {
  if (a.timestamp === b.timestamp) {
    // Stable tie-breaker for same-millisecond writes.
    return (a.id ?? 0) - (b.id ?? 0);
  }

  return a.timestamp - b.timestamp;
}

export function rebuildCartFromOperations(operations: CartOperation[]): RebuildResult {
  // Step 1: Always start from an empty cart state.
  const cartByProductId = new Map<string, CartItem>();
  let invalidOperationCount = 0;

  // Step 2: Replay logs sequentially by timestamp (and id when tied).
  const orderedOperations = [...operations].sort(compareOperations);

  for (const operation of orderedOperations) {
    const productId = toStringValue(operation.payload.productId);

    if (!productId) {
      invalidOperationCount += 1;
      continue;
    }

    if (operation.type === 'ADD') {
      const name = toStringValue(operation.payload.name);
      const price = toNumberValue(operation.payload.price);
      const quantity = toNumberValue(operation.payload.quantity) ?? 1;

      if (!name || price === null || quantity < 1) {
        invalidOperationCount += 1;
        continue;
      }

      const existingItem = cartByProductId.get(productId);
      if (existingItem) {
        cartByProductId.set(productId, {
          ...existingItem,
          // Duplicate ADD operations intentionally accumulate quantity.
          quantity: existingItem.quantity + quantity,
        });
      } else {
        cartByProductId.set(productId, {
          productId,
          name,
          price,
          quantity,
        });
      }
      continue;
    }

    if (operation.type === 'REMOVE') {
      cartByProductId.delete(productId);
      continue;
    }

    if (operation.type === 'UPDATE') {
      const quantity = toNumberValue(operation.payload.quantity);
      const existingItem = cartByProductId.get(productId);

      // Invalid UPDATE cases:
      // - product does not exist in current reconstructed state
      // - quantity missing/invalid
      if (!existingItem || quantity === null || quantity < 1) {
        invalidOperationCount += 1;
        continue;
      }

      // Duplicate UPDATEs are applied in order; last valid write wins.
      cartByProductId.set(productId, {
        ...existingItem,
        quantity,
      });
      continue;
    }

    invalidOperationCount += 1;
  }

  return {
    items: Array.from(cartByProductId.values()),
    invalidOperationCount,
  };
}
