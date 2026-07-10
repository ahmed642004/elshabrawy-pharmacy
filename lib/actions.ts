"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/queries";
import type { Enums } from "@/lib/database.types";

interface CreateOrderInput {
  // Only slug + qty travel to the server — create_order() derives every
  // price/subtotal/discount/total itself from the current products row, so
  // the client can no longer dictate what an order costs (see migration
  // 0015_secure_create_order.sql).
  items: { slug: string; qty: number }[];
  paymentMethod: Enums<"payment_method">;
  shipping: { fullName: string; phone: string; address: string; city: string; notes?: string };
  // Re-validated server-side inside create_order() via validate_promo() —
  // a stale/expired code just silently contributes 0 discount rather than
  // failing the order (see migration 0016_promo_codes.sql).
  promoCode: string | null;
}

export type CreateOrderResult =
  | { orderNumber: string }
  | { error: "INSUFFICIENT_STOCK"; slug: string; available: number; requested: number }
  | { error: "ORDER_FAILED" };

// Returns a result instead of throwing for the RPC's expected failure modes.
// Next.js Server Actions redact thrown Error messages to a generic
// digest-only message in PRODUCTION builds only — next dev forwards the real
// message, which is how the earlier "throw new Error(shortCode)" version of
// this function passed every local test yet silently showed the generic
// "Something went wrong" for every failure (including INSUFFICIENT_STOCK) in
// production. A raw PostgrestError also isn't a plain Error instance, so its
// .message never survives the boundary either way — read it here, server-side.
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_order", {
    p_items: input.items.map((i) => ({ slug: i.slug, qty: i.qty })),
    p_payment_method: input.paymentMethod,
    p_shipping: input.shipping,
    p_promo_code: input.promoCode ?? undefined,
  });

  if (error) {
    // create_order() raises 'INSUFFICIENT_STOCK:<slug>:<available>:<requested>'
    // (migration 0028) — parse the numbers so the client can say exactly
    // what's short, not just that something is. Falls back to the generic
    // code if the message doesn't parse (defensive — should never happen).
    const match = error.message.match(/INSUFFICIENT_STOCK:([^:]+):(\d+):(\d+)/);
    if (match) {
      return { error: "INSUFFICIENT_STOCK", slug: match[1], available: Number(match[2]), requested: Number(match[3]) };
    }
    return { error: "ORDER_FAILED" };
  }
  return { orderNumber: data };
}

// Called from the (client) cart context when the customer applies a promo
// code, so the input box can show real-time validity instead of the old
// honesty-system "any non-empty string works". Returns the discount amount
// in EGP, or null if the code is invalid/expired/below its minimum subtotal.
export async function validatePromo(code: string, subtotal: number): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_promo", { p_code: code, p_subtotal: subtotal });
  if (error || data == null) return null;
  return Number(data);
}

// Cancel while status = 'placed' only — the cancel_order() RPC (migration
// 0022) enforces this and restores the stock create_order() decremented.
// No assertAdmin here: ownership + status are checked inside the RPC itself.
export async function cancelMyOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) throw new Error("CANCEL_FAILED");
  revalidatePath("/account/orders");
}

export interface ReorderItem {
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  stock: Enums<"stock_state">;
  imageUrl: string | null;
}

// Live catalog state for a past order's product slugs. Order snapshots
// (order_items) freeze price/name at purchase time and can reference
// since-delisted products, and cart-context persists price into localStorage
// + the server-synced cart, so reorder MUST read current data, never the
// order snapshot.
export async function getReorderItems(slugs: string[]): Promise<ReorderItem[]> {
  const supabase = await createClient();
  const uniqueSlugs = Array.from(new Set(slugs)).slice(0, 50);
  if (uniqueSlugs.length === 0) return [];

  const { data, error } = await supabase
    .from("products")
    .select("slug, name, brand, price, stock, product_images(url, position)")
    .in("slug", uniqueSlugs);
  if (error || !data) return [];

  return data.map((row) => {
    const images = [...row.product_images].sort((a, b) => a.position - b.position);
    return {
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      price: Number(row.price),
      stock: row.stock,
      imageUrl: images[0]?.url ?? null,
    };
  });
}

interface GeoInput {
  lat?: number | null;
  lng?: number | null;
  geoAccuracyM?: number | null;
}

// Bad/malformed coords must never fail an address save — they just don't get
// stored. Both lat and lng are required together (a lone coordinate is
// meaningless); geoAccuracyM rides along only when both are valid.
function sanitizeGeo(input: GeoInput): { lat: number | null; lng: number | null; geo_accuracy_m: number | null } {
  const { lat, lng, geoAccuracyM } = input;
  const valid =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180;
  if (!valid) return { lat: null, lng: null, geo_accuracy_m: null };
  return {
    lat,
    lng,
    geo_accuracy_m: typeof geoAccuracyM === "number" && Number.isFinite(geoAccuracyM) ? geoAccuracyM : null,
  };
}

interface SaveAddressInput extends GeoInput {
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
    ...sanitizeGeo(input),
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Account page (/account) mutations — owner-only, enforced by the existing
// profiles/addresses RLS policies; each still checks getUser() itself rather
// than trusting the caller, same as saveAddress().
// ---------------------------------------------------------------------------

export async function updateProfile(input: { fullName: string; phone: string }): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, phone: phone || null })
    .eq("id", user.id);
  if (error) throw error;

  // Header reads full_name from the auth user's metadata (not profiles), so
  // both copies must move together or the avatar/dropdown would show the old
  // name until the next sign-in.
  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName, phone },
  });
  if (authError) throw authError;

  revalidatePath("/account");
}

interface AddressInput extends GeoInput {
  recipient: string;
  phone: string;
  street: string;
  city: string;
}

export async function updateAddress(id: string, input: AddressInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("addresses")
    .update({
      recipient: input.recipient,
      phone: input.phone,
      street: input.street,
      city: input.city,
      ...sanitizeGeo(input),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/account");
}

export async function deleteAddress(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/account");
}

export async function setDefaultAddress(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Two statements, not atomic — worst case under concurrent clicks is two
  // rows briefly flagged default, and checkout only reads the first anyway.
  const { error: clearError } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", user.id);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/account");
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
  // Cancellation must go through cancel_order() so the stock create_order()
  // decremented gets restored — this bare update never gave it back.
  if (newStatus === "cancelled") throw new Error("USE_CANCEL_ORDER");
  const supabase = await createClient();

  const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

// Admin cancel — the cancel_order() RPC (migration 0022) permits admins to
// cancel 'placed' or 'confirmed' orders (mirrors canCancelOrder() in
// lib/order-status.ts) and restores the decremented stock atomically.
export async function cancelOrderAdmin(orderId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) throw new Error("CANCEL_FAILED");

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

export async function adjustProductStock(productId: string, delta: number): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("adjust_product_stock", { p_product_id: productId, p_delta: delta });
  if (error) throw error;

  // Stock state shows on listing cards — flush the cached catalog reads.
  updateTag("products");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}

interface PromoInput {
  discountEgp: number;
  minSubtotal: number;
  expiresAt: string | null;
}

function assertPromoAmounts(input: PromoInput): void {
  if (!Number.isFinite(input.discountEgp) || input.discountEgp <= 0) throw new Error("INVALID_AMOUNT");
  if (!Number.isFinite(input.minSubtotal) || input.minSubtotal < 0) throw new Error("INVALID_MIN");
}

export async function createPromoCode(input: PromoInput & { code: string }): Promise<void> {
  await assertAdmin();
  // The DB check (code = upper(code)) rejects lowercase outright, so this
  // normalization isn't optional — without it, a lowercase-typed code fails
  // to insert with a raw constraint error instead of a clean one.
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,24}$/.test(code)) throw new Error("INVALID_CODE");
  assertPromoAmounts(input);

  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").insert({
    code,
    discount_egp: input.discountEgp,
    min_subtotal: input.minSubtotal,
    expires_at: input.expiresAt,
  });
  if (error) {
    // 23505 = duplicate PK. Raw PostgrestErrors are redacted crossing the
    // server-action boundary, so map to a short code the client can match on.
    throw new Error(error.code === "23505" ? "CODE_EXISTS" : "PROMO_SAVE_FAILED");
  }

  revalidatePath("/admin/promos");
}

// Code is the PK and immutable once created (same convention as products.slug)
// — the UI never sends it for update, so renaming isn't possible this way.
export async function updatePromoCode(code: string, input: PromoInput): Promise<void> {
  await assertAdmin();
  assertPromoAmounts(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("promo_codes")
    .update({
      discount_egp: input.discountEgp,
      min_subtotal: input.minSubtotal,
      expires_at: input.expiresAt,
    })
    .eq("code", code);
  if (error) throw new Error("PROMO_SAVE_FAILED");

  revalidatePath("/admin/promos");
}

export async function togglePromoActive(code: string, active: boolean): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").update({ active }).eq("code", code);
  if (error) throw new Error("PROMO_SAVE_FAILED");

  revalidatePath("/admin/promos");
}

// Safe even for a code that discounted past orders: orders store only the
// discount amount they got, never a reference to the code itself.
export async function deletePromoCode(code: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").delete().eq("code", code);
  if (error) throw new Error("PROMO_SAVE_FAILED");

  revalidatePath("/admin/promos");
}

interface DeliverySettingsInput {
  freeDeliveryThreshold: number;
  deliveryFee: number;
}

// Writes the singleton store_settings row that both create_order() and the
// storefront's getDeliverySettings() read. Numbers are re-validated here (the
// DB check constraints are the real backstop) and the "settings" cache tag is
// flushed so storefront cart/checkout/home totals reflect the change on the
// next request.
export async function updateDeliverySettings(input: DeliverySettingsInput): Promise<void> {
  await assertAdmin();
  if (!Number.isFinite(input.freeDeliveryThreshold) || input.freeDeliveryThreshold < 0) {
    throw new Error("INVALID_THRESHOLD");
  }
  if (!Number.isFinite(input.deliveryFee) || input.deliveryFee < 0) throw new Error("INVALID_FEE");

  const supabase = await createClient();
  const { error } = await supabase
    .from("store_settings")
    .update({
      free_delivery_threshold: input.freeDeliveryThreshold,
      delivery_fee: input.deliveryFee,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw new Error("SETTINGS_SAVE_FAILED");

  updateTag("settings");
  revalidatePath("/admin/settings");
}

export async function hideReview(reviewId: string, hidden: boolean): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("reviews")
    .update({ hidden })
    .eq("id", reviewId)
    .select("products(slug)")
    .maybeSingle();
  if (error) throw new Error("REVIEW_MODERATE_FAILED");

  revalidatePath("/admin/reviews");
  if (row?.products?.slug) {
    updateTag(`product:${row.products.slug}`);
    revalidatePath(`/product/${row.products.slug}`);
  }
}

export async function deleteReviewAdmin(reviewId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("reviews").select("products(slug)").eq("id", reviewId).maybeSingle();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw new Error("REVIEW_MODERATE_FAILED");

  revalidatePath("/admin/reviews");
  if (row?.products?.slug) {
    updateTag(`product:${row.products.slug}`);
    revalidatePath(`/product/${row.products.slug}`);
  }
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

const BADGE_TONES = ["sale", "bestseller", "new"] as const;
type BadgeToneValue = (typeof BADGE_TONES)[number];

// Shared parse of the catalog fields the admin product form submits, used by
// both addProduct and updateProduct so the two write the same column set.
// Optional text fields collapse empty strings to null; was_price only sticks
// when it's a valid positive number at or above the actual price (a lower
// "was" price wouldn't represent a real discount).
function parseProductFields(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const price = Number(formData.get("price"));
  const wasPriceRaw = Number(formData.get("wasPrice"));
  const wasPrice =
    Number.isFinite(wasPriceRaw) && wasPriceRaw > 0 && (!Number.isFinite(price) || wasPriceRaw >= price)
      ? wasPriceRaw
      : null;

  const badgeLabel = text("badgeLabel");
  const badgeToneRaw = String(formData.get("badgeTone") ?? "").trim();
  const badgeTone = BADGE_TONES.includes(badgeToneRaw as BadgeToneValue)
    ? (badgeToneRaw as BadgeToneValue)
    : null;

  return {
    name: String(formData.get("name") ?? "").trim(),
    brand: text("brand"),
    sub: text("sub"),
    category_id: text("categoryId"),
    sku: text("sku"),
    price,
    was_price: wasPrice,
    // A badge only makes sense with both a label and a tone; drop both if either
    // is missing so a half-set badge never renders.
    badge_label: badgeLabel && badgeTone ? badgeLabel : null,
    badge_tone: badgeLabel && badgeTone ? badgeTone : null,
    is_popular: formData.get("isPopular") === "on",
    description: text("description"),
    dosage: text("dosage"),
    ingredients: text("ingredients"),
    warnings: text("warnings"),
    storage: text("storage"),
  };
}

export async function addProduct(formData: FormData): Promise<{ slug: string }> {
  await assertAdmin();
  const supabase = await createClient();

  const fields = parseProductFields(formData);
  const stockCount = Number(formData.get("stockCount"));
  const lowStockThreshold = Number(formData.get("lowStockThreshold"));
  const image = formData.get("image");

  if (!fields.name || !Number.isFinite(fields.price)) throw new Error("Name and price are required");

  // products.slug is unique — derive one from the name and disambiguate on
  // collision, mirroring create_order()'s generated-but-unique order_number.
  const baseSlug = slugify(fields.name);
  let slug = baseSlug;
  for (let suffix = 2; ; suffix++) {
    const { data: existing } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
  }

  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      ...fields,
      slug,
      stock_count: Number.isFinite(stockCount) ? stockCount : 0,
      low_stock_threshold: Number.isFinite(lowStockThreshold) ? lowStockThreshold : 10,
    })
    .select("id, slug")
    .single();
  if (error) throw error;

  if (image instanceof File && image.size > 0) {
    await setProductThumbnail(supabase, inserted.id, slug, image);
  }

  updateTag("products");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");

  return { slug: inserted.slug };
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// The form's accept="image/*" is client-side only — re-validate here since a
// direct action call can send any file.
function assertValidImage(image: File): void {
  if (!image.type.startsWith("image/")) throw new Error("Upload must be an image");
  if (image.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
}

// Extension comes from a user-controlled filename — restrict it to a plain
// alphanumeric token so it can't smuggle path separators or odd characters
// into the storage key.
function safeExtension(filename: string): string {
  const rawExt = filename.split(".").pop() ?? "";
  return /^[a-z0-9]{1,8}$/i.test(rawExt) ? rawExt.toLowerCase() : "jpg";
}

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
  assertValidImage(image);
  const path = `${slug}/${Date.now()}.${safeExtension(image.name)}`;

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
  const fields = parseProductFields(formData);
  const stockCount = Number(formData.get("stockCount"));
  const lowStockThreshold = Number(formData.get("lowStockThreshold"));
  const image = formData.get("image");

  if (!id || !fields.name || !Number.isFinite(fields.price)) throw new Error("Name and price are required");

  // The slug deliberately stays unchanged on rename — it's the product's
  // public URL identity and may be sitting in customers' bookmarks, carts,
  // and past order_items rows.
  const { data: updated, error } = await supabase
    .from("products")
    .update({
      ...fields,
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

  updateTag("products");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}

// Uploads one or more gallery images for an existing product. If the product
// has no images yet, the first upload becomes position 0 (the card/carousel
// thumbnail) so it isn't left without one; otherwise new images append after
// the current max position. Returns the inserted rows so the admin modal can
// update its local gallery state without waiting for a full page refetch.
export async function addProductImages(
  formData: FormData
): Promise<{ id: string; url: string; position: number }[]> {
  await assertAdmin();
  const supabase = await createClient();

  const productId = String(formData.get("productId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (!productId || !slug) throw new Error("Missing product");
  if (files.length === 0) throw new Error("No images to upload");

  for (const file of files) assertValidImage(file);

  const { data: existingRows, error: existingError } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", productId);
  if (existingError) throw existingError;

  let nextPosition = existingRows.length === 0 ? 0 : Math.max(...existingRows.map((r) => r.position)) + 1;

  const inserted: { id: string; url: string; position: number }[] = [];
  for (const file of files) {
    const path = `${slug}/${Date.now()}-${nextPosition}.${safeExtension(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file);
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(path);

    const { data: row, error: insertError } = await supabase
      .from("product_images")
      .insert({ product_id: productId, url: publicUrl, position: nextPosition })
      .select("id, url, position")
      .single();
    if (insertError) throw insertError;

    inserted.push(row);
    nextPosition += 1;
  }

  updateTag("products");
  revalidatePath("/admin/inventory");
  revalidatePath(`/product/${slug}`);
  revalidatePath("/");
  return inserted;
}

// Position 0 is the card/carousel/hero thumbnail — it's replaced via the
// photo field above, never deleted from the gallery grid, so the storefront
// never ends up with a product that has other gallery images but no
// thumbnail.
export async function deleteProductImage(imageId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("product_images")
    .select("id, url, position, products(slug)")
    .eq("id", imageId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!row) return;
  if (row.position === 0) throw new Error("Cannot delete the main product photo this way");

  const { error: deleteError } = await supabase.from("product_images").delete().eq("id", imageId);
  if (deleteError) throw deleteError;

  // Best-effort: the DB row is already gone, so a leftover storage object is
  // only a stray file, not a correctness issue.
  const path = row.url.split("/product-images/")[1];
  if (path) {
    await supabase.storage
      .from("product-images")
      .remove([path])
      .catch(() => {});
  }

  updateTag("products");
  revalidatePath("/admin/inventory");
  if (row.products?.slug) revalidatePath(`/product/${row.products.slug}`);
}

interface SubmitReviewInput {
  productSlug: string;
  rating: number;
  body: string;
}

// One review per (product, customer) — re-submitting edits the existing row
// via upsert rather than erroring or duplicating. The has_purchased() RPC
// (migration 0018) is the real gate; RLS backs it up at the row level but
// can't itself express "only reviewers who bought this product," so that
// check lives here in the action.
export async function submitReview(input: SubmitReviewInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");

  const rating = Math.round(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error("Invalid rating");
  const body = input.body.trim().slice(0, 1000) || null;

  const { data: purchased, error: purchasedError } = await supabase.rpc("has_purchased", {
    p_product_slug: input.productSlug,
  });
  if (purchasedError) throw purchasedError;
  if (!purchased) throw new Error("NOT_PURCHASED");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", input.productSlug)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("Product not found");

  // author_name is public (reviews are publicly readable) — never fall back
  // to the user's email here, only their display name or a generic label.
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const authorName = profile?.full_name?.trim() || "Verified customer";

  const { error } = await supabase
    .from("reviews")
    .upsert(
      { product_id: product.id, user_id: user.id, rating, body, author_name: authorName },
      { onConflict: "product_id,user_id" }
    );
  if (error) throw error;

  updateTag(`product:${input.productSlug}`);
  revalidatePath(`/product/${input.productSlug}`);
}

export type NotifyToggleResult = "added" | "removed" | "unauthenticated";

// Toggles a back-in-stock request for the signed-in user. Returns a result
// instead of throwing for the signed-out case — "sign in to get notified" is
// an expected state the caller reacts to, not a failure, and thrown action
// errors get redacted to a generic message crossing the client boundary.
export async function toggleNotifyRequest(productSlug: string): Promise<NotifyToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "unauthenticated";

  const { data: product } = await supabase.from("products").select("id").eq("slug", productSlug).maybeSingle();
  if (!product) return "removed"; // product vanished; nothing to toggle

  const { data: existing } = await supabase
    .from("notify_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", product.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("notify_requests").delete().eq("id", existing.id);
    revalidatePath(`/product/${productSlug}`);
    return "removed";
  }

  // Upsert on the unique pair absorbs double-clicks (23505). Resetting
  // notified_at to null lets a user re-request after a dismissed notice.
  await supabase
    .from("notify_requests")
    .upsert({ user_id: user.id, product_id: product.id, notified_at: null }, { onConflict: "user_id,product_id" });
  revalidatePath(`/product/${productSlug}`);
  return "added";
}

// Marks restock notices as seen so the banner (RestockBanner.tsx) doesn't
// reappear. RLS scopes the update to the caller's own rows regardless; the
// explicit eq is belt-and-braces.
export async function dismissRestockNotice(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notify_requests")
    .update({ notified_at: new Date().toISOString() })
    .in("id", ids.slice(0, 100))
    .eq("user_id", user.id);
}
