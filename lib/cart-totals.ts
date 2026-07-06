import type { CartItem } from "@/lib/cart-context";

const FREE_DELIVERY_THRESHOLD = 300;
const DELIVERY_FEE = 40;
const PROMO_DISCOUNT = 20;

export interface CartTotals {
  subtotal: number;
  deliveryFree: boolean;
  deliveryFee: number;
  discount: number;
  total: number;
}

export function getCartTotals(items: CartItem[], promoApplied: boolean): CartTotals {
  const activeItems = items.filter((i) => i.stock !== "out");
  const subtotal = activeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryFree = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0;
  const deliveryFee = deliveryFree ? 0 : DELIVERY_FEE;
  const discount = promoApplied ? PROMO_DISCOUNT : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  return { subtotal, deliveryFree, deliveryFee, discount, total };
}

export const formatEGP = (n: number) => `EGP ${n.toLocaleString()}`;
