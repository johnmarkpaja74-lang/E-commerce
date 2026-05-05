import { create } from 'zustand';

type CheckoutItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

export type CheckoutDraft = {
  mode: 'cart' | 'buy_now';
  items: CheckoutItem[];
};

type CheckoutDraftStore = {
  draft: CheckoutDraft | null;
  setDraft: (draft: CheckoutDraft) => void;
  clearDraft: () => void;
};

export const useCheckoutDraftStore = create<CheckoutDraftStore>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
}));

