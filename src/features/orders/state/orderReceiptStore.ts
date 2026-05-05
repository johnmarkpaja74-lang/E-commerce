import { create } from 'zustand';

type ReceiptLineItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

export type ReceiptOrder = {
  orderId: string;
  placedAt: string;
  items: ReceiptLineItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: 'PLACED' | 'PENDING';
};

type OrderReceiptStore = {
  lastOrder: ReceiptOrder | null;
  setLastOrder: (order: ReceiptOrder) => void;
  clearLastOrder: () => void;
};

export const useOrderReceiptStore = create<OrderReceiptStore>((set) => ({
  lastOrder: null,
  setLastOrder: (order) => set({ lastOrder: order }),
  clearLastOrder: () => set({ lastOrder: null }),
}));

