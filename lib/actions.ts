"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/queries";
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

// ---------------------------------------------------------------------------
// Pharmacy Ops Dashboard (/admin) mutations. Each re-checks admin status
// server-side before writing — RLS is the real backstop, but this gives a
// clean "Not authorized" error instead of a raw RLS-denial bubbling up,
// matching how create_order()'s underlying RPC re-checks auth.uid() even
// though the UI already gates.
// ---------------------------------------------------------------------------

async function assertAdmin(): Promise<void> {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) throw new Error("Not authorized");
}

export async function updateOrderStatus(orderId: string, newStatus: Enums<"order_status">): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

export async function adjustProductStock(productId: string, delta: number): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("adjust_product_stock", { p_product_id: productId, p_delta: delta });
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

export async function addProduct(formData: FormData): Promise<{ slug: string }> {
  await assertAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const lowStockThreshold = Number(formData.get("lowStockThreshold"));
  const image = formData.get("image");

  if (!name || !Number.isFinite(price)) throw new Error("Name and price are required");

  // products.slug is unique — derive one from the name and disambiguate on
  // collision, mirroring create_order()'s generated-but-unique order_number.
  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let suffix = 2; ; suffix++) {
    const { data: existing } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
  }

  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      name,
      slug,
      category_id: categoryId,
      sku,
      price,
      stock_count: Number.isFinite(stockCount) ? stockCount : 0,
      low_stock_threshold: Number.isFinite(lowStockThreshold) ? lowStockThreshold : 10,
    })
    .select("id, slug")
    .single();
  if (error) throw error;

  if (image instanceof File && image.size > 0) {
    await setProductThumbnail(supabase, inserted.id, slug, image);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/inventory");

  return { slug: inserted.slug };
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// Uploads a validated image to the product-images bucket and points the
// product's position-0 product_images row (the card/carousel thumbnail —
// see CLAUDE.md's images section) at it, replacing any previous thumbnail
// row and best-effort deleting the old storage object so the bucket doesn't
// accumulate orphans.
async function setProductThumbnail(
  supabase: ServerSupabase,
  productId: string,
  slug: string,
  image: File
): Promise<void> {
  // The form's accept="image/*" is client-side only — re-validate here
  // since a direct action call can send any file.
  if (!image.type.startsWith("image/")) throw new Error("Upload must be an image");
  if (image.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");

  // Extension comes from a user-controlled filename — restrict it to a
  // plain alphanumeric token so it can't smuggle path separators or odd
  // characters into the storage key.
  const rawExt = image.name.split(".").pop() ?? "";
  const ext = /^[a-z0-9]{1,8}$/i.test(rawExt) ? rawExt.toLowerCase() : "jpg";
  const path = `${slug}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("product-images").upload(path, image);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);

  const { data: existing } = await supabase
    .from("product_images")
    .select("id, url")
    .eq("product_id", productId)
    .eq("position", 0)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from("product_images")
      .update({ url: publicUrl })
      .eq("id", existing.id);
    if (updateError) throw updateError;

    // Remove the replaced file from storage. Best-effort: the row already
    // points at the new image, so a leftover object is only a stray file.
    const oldPath = existing.url.split("/product-images/")[1];
    if (oldPath) {
      await supabase.storage
        .from("product-images")
        .remove([oldPath])
        .catch(() => {});
    }
  } else {
    const { error: imageError } = await supabase
      .from("product_images")
      .insert({ product_id: productId, url: publicUrl, position: 0 });
    if (imageError) throw imageError;
  }
}

export async function updateProduct(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const lowStockThreshold = Number(formData.get("lowStockThreshold"));
  const image = formData.get("image");

  if (!id || !name || !Number.isFinite(price)) throw new Error("Name and price are required");

  // The slug deliberately stays unchanged on rename — it's the product's
  // public URL identity and may be sitting in customers' bookmarks, carts,
  // and past order_items rows.
  const { data: updated, error } = await supabase
    .from("products")
    .update({
      name,
      category_id: categoryId,
      sku,
      price,
      stock_count: Number.isFinite(stockCount) ? Math.max(0, stockCount) : 0,
      low_stock_threshold: Number.isFinite(lowStockThreshold) ? Math.max(0, lowStockThreshold) : 10,
    })
    .eq("id", id)
    .select("id, slug")
    .single();
  if (error) throw error;

  if (image instanceof File && image.size > 0) {
    await setProductThumbnail(supabase, updated.id, updated.slug, image);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}
