import type { CartItem } from "@/lib/cart-context";

export interface DeliverySettings {
  // Order subtotal (EGP) at or above which delivery is free.
  freeDeliveryThreshold: number;
  // Flat delivery fee (EGP) charged below the threshold.
  deliveryFee: number;
}

// Fallback used only when the real settings haven't been threaded in (e.g. the
// internal applyPromo call, which needs the subtotal, not the delivery math).
// The authoritative values live in the store_settings table and are read by
// create_order() server-side; these mirror that row's column defaults so a
// missing prop degrades to the historical 300/40 rule rather than free
// delivery on everything.
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  freeDeliveryThreshold: 300,
  deliveryFee: 40,
};

// UX cap on a single line's quantity — well under create_order()'s hard
// server-side limit of 99, just high enough to stop an accidental runaway
// increment click from silently building an absurd cart.
export const MAX_ITEM_QTY = 10;

export interface CartTotals {
  subtotal: number;
  deliveryFree: boolean;
  deliveryFee: number;
  discount: number;
  total: number;
}

// promoDiscount is a real EGP amount now (validated server-side via
// validate_promo(), see lib/cart-context.tsx's applyPromo), not a flat
// constant unlocked by any non-empty code. Clamped to the subtotal so a
// stale cached discount can't outlive items being removed from the cart.
//
// settings comes from the admin-editable store_settings row (threaded through
// the cart context); this is display math only — create_order() recomputes the
// same delivery rule from the same row, so it stays authoritative.
export function getCartTotals(
  items: CartItem[],
  promoDiscount: number,
  settings: DeliverySettings = DEFAULT_DELIVERY_SETTINGS
): CartTotals {
  const activeItems = items.filter((i) => i.stock !== "out");
  const subtotal = activeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryFree = subtotal >= settings.freeDeliveryThreshold || subtotal === 0;
  const deliveryFee = deliveryFree ? 0 : settings.deliveryFee;
  const discount = Math.min(Math.max(0, promoDiscount), subtotal);
  const total = Math.max(0, subtotal + deliveryFee - discount);

  return { subtotal, deliveryFree, deliveryFee, discount, total };
}

export const formatEGP = (n: number) => `EGP ${n.toLocaleString()}`;
