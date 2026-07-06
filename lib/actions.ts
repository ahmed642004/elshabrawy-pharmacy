"use server";

import { createClient } from "@/lib/supabase/server";
import type { CartItem } from "@/lib/cart-context";
import type { Enums } from "@/lib/database.types";

interface CreateOrderInput {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: Enums<"payment_method">;
  shipping: { fullName: string; phone: string; address: string; city: string; notes?: string };
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_order", {
    p_items: input.items.map((i) => ({ slug: i.slug, name: i.name, brand: i.brand, price: i.price, qty: i.qty })),
    p_subtotal: input.subtotal,
    p_delivery_fee: input.deliveryFee,
    p_discount: input.discount,
    p_total: input.total,
    p_payment_method: input.paymentMethod,
    p_shipping: input.shipping,
  });

  if (error) throw error;
  return data;
}

interface SaveAddressInput {
  recipient: string;
  phone: string;
  street: string;
  city: string;
}

// Persists a newly-entered checkout address for a signed-in user so it shows
// up as a saved address next time. No-ops for guests (no user to attach it
// to) rather than throwing, since this runs best-effort after an order has
// already succeeded — a failure here shouldn't look like the order failed.
export async function saveAddress(input: SaveAddressInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    recipient: input.recipient,
    phone: input.phone,
    street: input.street,
    city: input.city,
    is_default: (count ?? 0) === 0,
  });
  if (error) throw error;
}
