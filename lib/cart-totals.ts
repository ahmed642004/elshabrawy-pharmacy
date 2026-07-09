import type { CartItem } from "@/lib/cart-context";

const FREE_DELIVERY_THRESHOLD = 300;
const DELIVERY_FEE = 40;

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
export function getCartTotals(items: CartItem[], promoDiscount: number): CartTotals {
  const activeItems = items.filter((i) => i.stock !== "out");
  const subtotal = activeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryFree = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0;
  const deliveryFee = deliveryFree ? 0 : DELIVERY_FEE;
  const discount = Math.min(Math.max(0, promoDiscount), subtotal);
  const total = Math.max(0, subtotal + deliveryFee - discount);

  return { subtotal, deliveryFree, deliveryFee, discount, total };
}

export const formatEGP = (n: number) => `EGP ${n.toLocaleString()}`;
