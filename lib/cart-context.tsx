"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { StockState } from "@/components/ProductCard";

export interface CartItem {
  slug: string;
  name: string;
  brand?: string;
  price: number;
  qty: number;
  stock: StockState;
}

interface CartContextValue {
  items: CartItem[];
  savedItems: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (slug: string) => void;
  updateQty: (slug: string, qty: number) => void;
  saveForLater: (slug: string) => void;
  moveToCart: (slug: string) => void;
  clearCart: () => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  promoApplied: boolean;
  applyPromo: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function mergeItemInto(list: CartItem[], item: CartItem): CartItem[] {
  const existing = list.find((i) => i.slug === item.slug);
  if (existing) {
    return list.map((i) => (i.slug === item.slug ? { ...i, qty: i.qty + item.qty } : i));
  }
  return [...list, item];
}

const STORAGE_KEY = "elshabrawy-pharmacy-cart";

interface StoredCart {
  items: CartItem[];
  savedItems: CartItem[];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [savedItems, setSavedItems] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as StoredCart;
      // One-time hydration from localStorage, which isn't available during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(stored.items ?? []);
      setSavedItems(stored.savedItems ?? []);
    } catch {
      // ignore malformed local storage content
    }
  }, []);

  useEffect(() => {
    const stored: StoredCart = { items, savedItems };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [items, savedItems]);

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => mergeItemInto(prev, { ...item, qty }));
  }, []);

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const updateQty = useCallback(
    (slug: string, qty: number) => {
      if (qty < 1) {
        removeItem(slug);
        return;
      }
      setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, qty } : i)));
    },
    [removeItem]
  );

  const saveForLater = useCallback(
    (slug: string) => {
      const item = items.find((i) => i.slug === slug);
      if (!item) return;
      setItems((prev) => prev.filter((i) => i.slug !== slug));
      setSavedItems((prev) => mergeItemInto(prev, item));
    },
    [items]
  );

  const moveToCart = useCallback(
    (slug: string) => {
      const item = savedItems.find((i) => i.slug === slug);
      if (!item) return;
      setSavedItems((prev) => prev.filter((i) => i.slug !== slug));
      setItems((prev) => mergeItemInto(prev, item));
    },
    [savedItems]
  );

  const applyPromo = useCallback(() => {
    setPromoApplied((prev) => prev || promoCode.trim().length > 0);
  }, [promoCode]);

  const clearCart = useCallback(() => {
    setItems([]);
    setPromoCode("");
    setPromoApplied(false);
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        savedItems,
        addItem,
        removeItem,
        updateQty,
        saveForLater,
        moveToCart,
        clearCart,
        promoCode,
        setPromoCode,
        promoApplied,
        applyPromo,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
