"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { createClient } from "@/lib/supabase/client";
import { validatePromo } from "@/lib/actions";
import {
  getCartTotals,
  MAX_ITEM_QTY,
  DEFAULT_DELIVERY_SETTINGS,
  type DeliverySettings,
} from "@/lib/cart-totals";
import type { StockState } from "@/components/ProductCard";

export interface CartItem {
  slug: string;
  name: string;
  brand?: string;
  price: number;
  imageUrl?: string;
  qty: number;
  stock: StockState;
}

export interface AppliedPromo {
  code: string;
  discount: number;
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
  // promoInput is the raw text box value; promo is the last successfully
  // validated code + its server-computed discount amount (null if none
  // applied, or if the last attempt failed — see promoError).
  promoInput: string;
  setPromoInput: (code: string) => void;
  promo: AppliedPromo | null;
  promoError: boolean;
  applyPromo: () => Promise<void>;
  clearPromo: () => void;
  itemCount: number;
  // Admin-configured delivery rule, fetched server-side and passed in; used by
  // the summary components' getCartTotals calls so display matches what
  // create_order() will charge.
  deliverySettings: DeliverySettings;
}

const CartContext = createContext<CartContextValue | null>(null);

// Qty is clamped here — the single chokepoint every addition/merge passes
// through — rather than only in the UI, since localStorage can already hold
// pre-cap quantities (hand-edited, or saved before MAX_ITEM_QTY existed) and
// the sign-in server merge sums two independently-valid carts.
function mergeItemInto(list: CartItem[], item: CartItem): CartItem[] {
  const existing = list.find((i) => i.slug === item.slug);
  if (existing) {
    return list.map((i) =>
      i.slug === item.slug
        ? { ...i, qty: Math.min(i.qty + item.qty, MAX_ITEM_QTY) }
        : i,
    );
  }
  return [...list, { ...item, qty: Math.min(item.qty, MAX_ITEM_QTY) }];
}

function clampCartItems(list: CartItem[]): CartItem[] {
  return list.map((i) =>
    i.qty > MAX_ITEM_QTY ? { ...i, qty: MAX_ITEM_QTY } : i,
  );
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
  promo?: AppliedPromo | null;
}

export function CartProvider({
  children,
  deliverySettings = DEFAULT_DELIVERY_SETTINGS,
}: {
  children: ReactNode;
  deliverySettings?: DeliverySettings;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [savedItems, setSavedItems] = useState<CartItem[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState(false);

  // supabase-js is only needed for signed-in cart sync; it's dynamically
  // imported below so it stays out of the initial bundle every storefront
  // page hydrates with. Null until that import resolves.
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  // Mirrors the latest items/savedItems for the async sign-in merge below —
  // by the time the server cart response arrives, state may have moved past
  // what the closure captured.
  const stateRef = useRef<StoredCart>({
    items: [],
    savedItems: [],
    promo: null,
  });
  // The signed-in user currently being synced, and whether the initial
  // server merge for that user has completed (pushes are held until it has,
  // so a pre-merge local state can't clobber the server copy).
  const syncUserRef = useRef<string | null>(null);
  const syncReadyRef = useRef(false);
  // Sync bootstrap: whether the supabase import has been kicked off, and the
  // cookie-gated starter so the pathname effect below can re-invoke it.
  const startedSyncRef = useRef(false);
  const startSyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as StoredCart;
      // One-time hydration from localStorage, which isn't available during SSR.
      // Clamped in case it predates MAX_ITEM_QTY or was hand-edited.
      setItems(clampCartItems(stored.items ?? []));
      setSavedItems(clampCartItems(stored.savedItems ?? []));
      setPromo(stored.promo ?? null);
    } catch {
      // ignore malformed local storage content
    }
  }, []);

  useEffect(() => {
    const stored: StoredCart = { items, savedItems, promo };
    stateRef.current = stored;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [items, savedItems, promo]);

  // Server sync, layered on top of localStorage: signed-in users get their
  // cart merged from and written back to the cart_items table, so it follows
  // them across devices. Guests keep the pure-localStorage behavior.
  //
  // supabase-js is only imported once a Supabase auth cookie ("sb-…") is
  // actually present — guests never download the chunk at all. The cookie
  // check re-runs on route changes and window focus, which covers signing in
  // during this SPA session (/auth sets the cookie, then navigates away) and
  // in another tab.
  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    // Deferred to idle time so the chunk fetch/eval stays off the critical
    // rendering path — cart sync starting a moment later is invisible.
    const whenIdle: (cb: () => void) => void =
      typeof requestIdleCallback === "function"
        ? (cb) => requestIdleCallback(cb, { timeout: 3000 })
        : (cb) => setTimeout(cb, 1500);

    const start = () => {
      if (cancelled || startedSyncRef.current) return;
      if (!document.cookie.includes("sb-")) return;
      startedSyncRef.current = true;
      import("@/lib/supabase/client").then((mod) => {
        if (cancelled) return;
        const supabase = mod.createClient();
        supabaseRef.current = supabase;

        ({
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          // Only (re)sync on events that actually change who's signed in.
          // TOKEN_REFRESHED (and similar) fire periodically for a long-lived
          // session and must not trigger a resync — the merge below reads
          // localStorage, which lags behind in-flight React state until the
          // debounced write-through catches up, so a resync here can silently
          // clobber just-added items.
          if (
            event !== "SIGNED_IN" &&
            event !== "SIGNED_OUT" &&
            event !== "INITIAL_SESSION"
          )
            return;

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
              .select(
                "qty, saved_for_later, products(slug, name, brand, price, stock, product_images(url, position))",
              );
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
                imageUrl: [...(row.products.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url,
                stock: row.products.stock,
                qty: row.qty,
              };
              (row.saved_for_later ? serverSaved : serverItems).push(item);
            }

            const local = stateRef.current;
            // clampCartItems here too: a slug present only server-side (no local
            // conflict to clamp it via mergeItemInto) passes through mergeCartLists
            // untouched, and could predate MAX_ITEM_QTY.
            const mergedItems = clampCartItems(
              mergeCartLists(serverItems, local.items),
            );
            const inCart = new Set(mergedItems.map((i) => i.slug));
            // A slug can't be both in the cart and saved for later; the cart wins.
            const mergedSaved = clampCartItems(
              mergeCartLists(serverSaved, local.savedItems).filter(
                (i) => !inCart.has(i.slug),
              ),
            );

            syncReadyRef.current = true;
            setItems(mergedItems);
            setSavedItems(mergedSaved);
          }, 0);
        }));
      });
    };

    startSyncRef.current = start;
    whenIdle(start);
    window.addEventListener("focus", start);

    return () => {
      cancelled = true;
      startSyncRef.current = null;
      window.removeEventListener("focus", start);
      subscription?.unsubscribe();
    };
  }, []);

  // Route changes re-run the cookie check: signing in on /auth sets the
  // Supabase cookie and then navigates, which is when sync should begin.
  const pathname = usePathname();
  useEffect(() => {
    startSyncRef.current?.();
  }, [pathname]);

  // Debounced write-through: any cart change while synced replaces the whole
  // server cart (small carts make a full replace simpler and more robust
  // than per-operation diffing).
  useEffect(() => {
    // syncReady only flips true after the initial merge, which requires the
    // lazy supabase import to have resolved — so supabaseRef is set here.
    const supabase = supabaseRef.current;
    if (!syncReadyRef.current || !syncUserRef.current || !supabase) return;
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
        () => {},
      );
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
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
      const clamped = Math.min(qty, MAX_ITEM_QTY);
      setItems((prev) =>
        prev.map((i) => (i.slug === slug ? { ...i, qty: clamped } : i)),
      );
    },
    [removeItem],
  );

  const saveForLater = useCallback(
    (slug: string) => {
      const item = items.find((i) => i.slug === slug);
      if (!item) return;
      setItems((prev) => prev.filter((i) => i.slug !== slug));
      setSavedItems((prev) => mergeItemInto(prev, item));
    },
    [items],
  );

  const moveToCart = useCallback(
    (slug: string) => {
      const item = savedItems.find((i) => i.slug === slug);
      if (!item) return;
      setSavedItems((prev) => prev.filter((i) => i.slug !== slug));
      setItems((prev) => mergeItemInto(prev, item));
    },
    [savedItems],
  );

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) return;
    const { subtotal } = getCartTotals(items, 0);
    const discount = await validatePromo(code, subtotal);
    if (discount == null) {
      setPromo(null);
      setPromoError(true);
      return;
    }
    setPromo({ code: code.toUpperCase(), discount });
    setPromoError(false);
  }, [items, promoInput]);

  const clearPromo = useCallback(() => {
    setPromoInput("");
    setPromo(null);
    setPromoError(false);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setPromoInput("");
    setPromo(null);
    setPromoError(false);
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
        promoInput,
        setPromoInput,
        promo,
        promoError,
        applyPromo,
        clearPromo,
        itemCount,
        deliverySettings,
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
