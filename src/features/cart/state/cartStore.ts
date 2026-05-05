import { create } from 'zustand';

import { cartRepository } from '@/src/features/cart/data/cartRepository';
import type { CartItem, CartOperation } from '@/src/features/cart/model/types';
import { initializeOfflineQueue } from '@/src/features/cart/sync/offlineQueue';
import { runMigrations } from '@/src/services/storage/sqlite/migrations';

type CartStore = {
  items: CartItem[];
  operations: CartOperation[];
  initializeFromDatabase: () => Promise<void>;
  addItem: (product: { id: string; name: string; price: number; imageUrl?: string; quantity?: number }) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateItemQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
};

function createOperation(
  type: 'ADD' | 'REMOVE' | 'UPDATE',
  payload: Record<string, unknown>
): CartOperation {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  operations: [],

  initializeFromDatabase: async () => {
    runMigrations();

    // Start offline queue engine once app state is hydrated.
    // It monitors connectivity and auto-processes pending operations on reconnect.
    initializeOfflineQueue();

    const snapshot = cartRepository.loadSnapshot();
    set({ items: snapshot.items, operations: snapshot.operations });
  },

  addItem: async (product) => {
    const currentItems = get().items;
    const existingItem = currentItems.find((item) => item.productId === product.id);
    const addQuantity = Math.max(1, Math.floor(product.quantity ?? 1));

    let updatedItem: CartItem;
    let updatedItems: CartItem[];

    if (existingItem) {
      updatedItem = { ...existingItem, quantity: existingItem.quantity + addQuantity };
      updatedItems = currentItems.map((item) =>
        item.productId === product.id ? updatedItem : item
      );
    } else {
      updatedItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: addQuantity,
        imageUrl: product.imageUrl,
      };
      updatedItems = [...currentItems, updatedItem];
    }

    const operation = createOperation('ADD', {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: addQuantity,
    });

    const previousItems = currentItems;
    const previousOperations = get().operations;

    // Optimistic state update for immediate UI response.
    set({
      items: updatedItems,
      operations: [...previousOperations, operation],
    });

    try {
      await cartRepository.saveCartItem(updatedItem);
      await cartRepository.enqueueOperation(operation);
    } catch (error) {
      // Rollback if persistence or queueing fails.
      set({
        items: previousItems,
        operations: previousOperations,
      });
      throw error;
    }
  },

  removeItem: async (productId) => {
    const updatedItems = get().items.filter((item) => item.productId !== productId);
    const operation = createOperation('REMOVE', { productId });

    await cartRepository.removeCartItem(productId);
    await cartRepository.enqueueOperation(operation);

    set({
      items: updatedItems,
      operations: [...get().operations, operation],
    });
  },

  updateItemQuantity: async (productId, quantity) => {
    if (quantity < 1) {
      return;
    }

    const currentItems = get().items;
    const existingItem = currentItems.find((item) => item.productId === productId);
    if (!existingItem) {
      return;
    }

    const updatedItem: CartItem = { ...existingItem, quantity };
    const updatedItems = currentItems.map((item) =>
      item.productId === productId ? updatedItem : item
    );

    const operation = createOperation('UPDATE', { productId, quantity });

    await cartRepository.saveCartItem(updatedItem);
    await cartRepository.enqueueOperation(operation);

    set({
      items: updatedItems,
      operations: [...get().operations, operation],
    });
  },

  clearCart: async () => {
    await cartRepository.clearCart();
    set({ items: [] });
  },
}));
