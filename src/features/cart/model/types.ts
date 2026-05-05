export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

export type CartOperationType = 'ADD' | 'REMOVE' | 'UPDATE';

export type CartOperation = {
  id?: number;
  type: CartOperationType;
  payload: Record<string, unknown>;
  timestamp: number;
  synced?: boolean;
};

export type CartConflict =
  | {
      type: 'OUT_OF_STOCK';
      productId: string;
      message?: string;
    }
  | {
      type: 'PRICE_CHANGED';
      productId: string;
      newPrice: number;
      message?: string;
    };

export type CartItemRow = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
};

export type CartOperationRow = {
  id: number;
  type: CartOperationType;
  payload_json: string;
  timestamp: number;
  synced: number;
};
