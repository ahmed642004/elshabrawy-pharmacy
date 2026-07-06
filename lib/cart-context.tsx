"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
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

// Union of the server cart and the local cart at sign-in. On a slug conflict
// the local row wins — it reflects this device's most recent activity, while
// the server copy may be days old (from another device or a past session).
function mergeCartLists(server: CartItem[], local: CartItem[]): CartItem[] {
  const merged = new Map(server.map((i) => [i.slug, i]));
  for (const item of local) merged.set(item.slug, item);
  return [...merged.values()];
}

const PUSH_DEBOUNCE_MS = 800;

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

  const supabase = useMemo(() => createClient(), []);
  // Mirrors the latest items/savedItems for the async sign-in merge below —
  // by the time the server cart response arrives, state may have moved past
  // what the closure captured.
  const stateRef = useRef<StoredCart>({ items: [], savedItems: [] });
  // The signed-in user currently being synced, and whether the initial
  // server merge for that user has completed (pushes are held until it has,
  // so a pre-merge local state can't clobber the server copy).
  const syncUserRef = useRef<string | null>(null);
  const syncReadyRef = useRef(false);

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
    stateRef.current = stored;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [items, savedItems]);

  // Server sync, layered on top of localStorage: signed-in users get their
  // cart merged from and written back to the cart_items table, so it follows
  // them across devices. Guests keep the pure-localStorage behavior.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (!userId) {
        // Signed out: stop syncing but keep the local cart — it was this
        // device's cart before sign-in too.
        syncUserRef.current = null;
        syncReadyRef.current = false;
        return;
      }
      if (syncUserRef.current === userId) return;
      syncUserRef.current = userId;
      syncReadyRef.current = false;

      // Deferred: supabase-js awaits this callback internally, so making
      // Supabase calls inline can deadlock.
      setTimeout(async () => {
        const { data, error } = await supabase
          .from("cart_items")
          .select("qty, saved_for_later, products(slug, name, brand, price, stock)");
        // Fail open on error: the local cart keeps working, just unsynced.
        if (error || syncUserRef.current !== userId) return;

        const serverItems: CartItem[] = [];
        const serverSaved: CartItem[] = [];
        for (const row of data) {
          if (!row.products) continue;
          const item: CartItem = {
            slug: row.products.slug,
            name: row.products.name,
            brand: row.products.brand ?? undefined,
            price: Number(row.products.price),
            stock: row.products.stock,
            qty: row.qty,
          };
          (row.saved_for_later ? serverSaved : serverItems).push(item);
        }

        const local = stateRef.current;
        const mergedItems = mergeCartLists(serverItems, local.items);
        const inCart = new Set(mergedItems.map((i) => i.slug));
        // A slug can't be both in the cart and saved for later; the cart wins.
        const mergedSaved = mergeCartLists(serverSaved, local.savedItems).filter((i) => !inCart.has(i.slug));

        syncReadyRef.current = true;
        setItems(mergedItems);
        setSavedItems(mergedSaved);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Debounced write-through: any cart change while synced replaces the whole
  // server cart (small carts make a full replace simpler and more robust
  // than per-operation diffing).
  useEffect(() => {
    if (!syncReadyRef.current || !syncUserRef.current) return;
    const timer = setTimeout(() => {
      const payload = [
        ...items.map((i) => ({ slug: i.slug, qty: i.qty, saved: false })),
        ...savedItems.map((i) => ({ slug: i.slug, qty: i.qty, saved: true })),
      ];
      // supabase-js builders are lazy thenables — the request only fires
      // once .then() is invoked, so a bare `void rpc(...)` would never send
      // anything. Failures are ignored: the next cart change retries.
      supabase.rpc("replace_cart", { p_items: payload }).then(
        () => {},
        () => {}
      );
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [items, savedItems, supabase]);

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
