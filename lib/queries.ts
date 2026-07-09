import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Product, BadgeTone, StockState } from "@/components/ProductCard";
import type { Enums, Tables } from "@/lib/database.types";
import { PRICE_RANGES } from "@/lib/price-ranges";
import { cairoDateKey } from "@/lib/admin-stats";

type ProductRow = Tables<"products"> & {
  product_images?: Pick<Tables<"product_images">, "url" | "position">[];
};

const PRODUCT_SELECT_WITH_IMAGES = "*, product_images(url, position)";

function toProduct(row: ProductRow): Product {
  const thumbnail = (row.product_images ?? []).slice().sort((a, b) => a.position - b.position)[0];

  return {
    slug: row.slug,
    name: row.name,
    brand: row.brand ?? undefined,
    sub: row.sub ?? undefined,
    price: Number(row.price),
    wasPrice: row.was_price != null ? Number(row.was_price) : undefined,
    imageUrl: thumbnail?.url,
    badge:
      row.badge_label && row.badge_tone
        ? { label: row.badge_label, tone: row.badge_tone as BadgeTone }
        : undefined,
    stock: row.stock as StockState,
  };
}

export interface CategoryRow {
  id: string;
  label: string;
  labelAr: string | null;
}

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, label, label_ar")
    .order("sort_order");
  if (error) throw error;
  return data.map((c) => ({ id: c.id, label: c.label, labelAr: c.label_ar }));
}

export async function getPopularProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT_WITH_IMAGES)
    .eq("is_popular", true)
    .order("created_at");
  if (error) throw error;
  return data.map(toProduct);
}

export interface ListingProduct extends Product {
  category: string;
}

export async function getBrands(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_distinct_brands");
  if (error) throw error;
  return data.map((row) => row.brand).filter((b): b is string => Boolean(b));
}

function buildPriceOrFilter(rangeIds: string[]): string {
  const clauses = rangeIds
    .map((id) => PRICE_RANGES.find((r) => r.id === id))
    .filter((r): r is (typeof PRICE_RANGES)[number] => Boolean(r))
    .map((r) => {
      const parts: string[] = [];
      if (r.min !== undefined) parts.push(`price.${r.minExclusive ? "gt" : "gte"}.${r.min}`);
      if (r.max !== undefined) parts.push(`price.${r.maxExclusive ? "lt" : "lte"}.${r.max}`);
      return parts.length > 1 ? `and(${parts.join(",")})` : parts[0];
    })
    .filter((c): c is string => Boolean(c));
  return clauses.join(",");
}

export interface ProductFilters {
  categoryIds?: string[];
  brands?: string[];
  priceRangeIds?: string[];
  sort?: string;
  // Backs /category/offers — restricts to products where the generated
  // on_sale column is true (was_price is a genuine discount over price).
  onSale?: boolean;
}

// Filters (category/brand/price) and sort are all applied in the query
// itself — the database only ever returns matching rows, so this scales as
// the catalog grows instead of shipping every product to the browser and
// filtering client-side.
export async function getFilteredProducts(filters: ProductFilters): Promise<ListingProduct[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select(PRODUCT_SELECT_WITH_IMAGES);

  if (filters.categoryIds?.length) query = query.in("category_id", filters.categoryIds);
  if (filters.brands?.length) query = query.in("brand", filters.brands);
  if (filters.onSale) query = query.eq("on_sale", true);
  if (filters.priceRangeIds?.length) {
    const orFilter = buildPriceOrFilter(filters.priceRangeIds);
    if (orFilter) query = query.or(orFilter);
  }

  if (filters.sort === "price-asc") query = query.order("price", { ascending: true });
  else if (filters.sort === "price-desc") query = query.order("price", { ascending: false });
  else if (filters.sort === "name-asc") query = query.order("name", { ascending: true });
  else query = query.order("created_at");

  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => ({ ...toProduct(row), category: row.category_id ?? "" }));
}

export interface ProductDetail extends Product {
  category: string;
  categoryLabel: string;
  rating: number | null;
  reviewCount: number;
  description: string | null;
  dosage: string | null;
  ingredients: string | null;
  warnings: string | null;
  storage: string | null;
  images: string[];
  reviews: { authorName: string; rating: number; body: string | null; createdAt: string }[];
}

// Wrapped in React cache() so generateMetadata() and the page body share one
// Supabase fetch per request instead of hitting it twice.
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("products")
    .select("*, categories(label), product_images(url, position), reviews(id, author_name, rating, body, created_at)")
    .eq("slug", slug)
    .eq("reviews.hidden", false)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const images = (row.product_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => img.url);

  return {
    ...toProduct(row),
    category: row.category_id ?? "",
    categoryLabel: row.categories?.label ?? "",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count,
    description: row.description,
    dosage: row.dosage,
    ingredients: row.ingredients,
    warnings: row.warnings,
    storage: row.storage,
    images,
    reviews: (row.reviews ?? []).map((r) => ({
      authorName: r.author_name,
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
    })),
  };
});

// Lightweight slug list for the sitemap — no images/reviews/etc.
export async function getAllProductSlugs(): Promise<{ slug: string; createdAt: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("slug, created_at");
  if (error || !data) return [];
  return data.map((r) => ({ slug: r.slug, createdAt: r.created_at }));
}

// Whether a request has a signed-in user at all — no role/ownership info,
// just enough for the review form to decide between the sign-in prompt and
// the write form (the real purchase/ownership checks live server-side in
// submitReview()).
export async function isSignedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export interface PendingReview {
  slug: string;
  name: string;
  imageUrl: string | null;
}

// Products from the signed-in customer's DELIVERED orders that they haven't
// reviewed yet — feeds the post-delivery review prompt. Returns [] for guests
// (the RPC scopes to auth.uid()). Failures fail closed to [] so a hiccup here
// never blocks the storefront layout that awaits it.
export async function getPendingReviews(): Promise<PendingReview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_pending_reviews");
  if (error || !data) return [];
  return data.map((row) => ({ slug: row.slug, name: row.name, imageUrl: row.image_url }));
}

export interface RestockedNotify {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

type NotifyRequestRow = {
  id: string;
  products: {
    slug: string;
    name: string;
    stock: Enums<"stock_state">;
    product_images: Pick<Tables<"product_images">, "url" | "position">[];
  } | null;
};

// Signed-in user's pending notify requests whose product is back in stock.
// KEY INSIGHT: no trigger/cron/transition-detection is needed. "Pending
// request AND product currently not out-of-stock" IS the restock signal —
// the 0010 trigger keeps products.stock derived from stock_count, so this
// is always accurate at read time.
// Fails closed to [] — this runs in the shop layout on every page view; an
// error here must never take down the whole storefront (same contract as
// getPendingReviews above).
export async function getRestockedNotifies(): Promise<RestockedNotify[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notify_requests")
    .select("id, products(slug, name, stock, product_images(url, position))")
    .is("notified_at", null)
    .returns<NotifyRequestRow[]>();
  if (error || !data) return [];

  return data
    .filter((r): r is NotifyRequestRow & { products: NonNullable<NotifyRequestRow["products"]> } =>
      r.products != null && r.products.stock !== "out"
    )
    .map((r) => {
      const images = [...r.products.product_images].sort((a, b) => a.position - b.position);
      return { id: r.id, slug: r.products.slug, name: r.products.name, imageUrl: images[0]?.url ?? null };
    });
}

export async function hasNotifyRequest(productSlug: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: product } = await supabase.from("products").select("id").eq("slug", productSlug).maybeSingle();
  if (!product) return false;

  const { data } = await supabase
    .from("notify_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", product.id)
    .maybeSingle();
  return data != null;
}

export async function searchProducts(query: string): Promise<ListingProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const escaped = trimmed.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT_WITH_IMAGES)
    .or(`name.ilike.${pattern},brand.ilike.${pattern},sub.ilike.${pattern}`)
    .order("created_at");
  if (error) throw error;
  return data.map((row) => ({ ...toProduct(row), category: row.category_id ?? "" }));
}

export async function getRelatedProducts(categoryId: string, excludeSlug: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT_WITH_IMAGES)
    .eq("category_id", categoryId)
    .neq("slug", excludeSlug)
    .limit(6);
  if (error) throw error;
  return data.map(toProduct);
}

export interface AddressRow {
  id: string;
  // A flag rather than a pre-rendered "Default"/"Address" label so the
  // client can localize the text.
  isDefault: boolean;
  name: string;
  phone: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  geoAccuracyM: number | null;
}

export interface AddressesResult {
  addresses: AddressRow[];
  isLoggedIn: boolean;
}

// Just the city text for the header's delivery chip — cheap, single-column,
// single-row lookup so a signed-in header render never pulls full address
// rows just to show "Delivery to X". Returns null for guests, no saved
// addresses, or a blank city, so the caller can fall back to generic copy.
export async function getHeaderDeliveryCity(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("addresses")
    .select("city")
    .order("is_default", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const city = data?.city?.trim();
  return city || null;
}

// isLoggedIn is [] for guests (no session) — checkout falls back to the "add
// new address" form only (guest COD is a valid flow), and lets the checkout
// page know whether a newly-entered address can be saved back to the table
// (guests have no user_id to attach it to).
export async function getAddresses(): Promise<AddressesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { addresses: [], isLoggedIn: false };

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error) throw error;

  return {
    isLoggedIn: true,
    addresses: data.map((row) => ({
      id: row.id,
      isDefault: row.is_default,
      name: row.recipient ?? "",
      phone: row.phone ?? "",
      address: row.street ?? "",
      city: [row.city, row.governorate].filter(Boolean).join(", "),
      lat: row.lat,
      lng: row.lng,
      geoAccuracyM: row.geo_accuracy_m,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pharmacy Ops Dashboard (/admin) — staff-only reads. Every function below is
// only ever called from behind the /admin layout's isAdmin gate, but RLS is
// the real enforcement boundary (see 0009_admin_role_and_policies.sql).
// ---------------------------------------------------------------------------

export interface AdminSession {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export async function getAdminSession(): Promise<AdminSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isLoggedIn: false, isAdmin: false };

  const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return { isLoggedIn: true, isAdmin: data?.is_admin ?? false };
}

export interface AdminOrderItem {
  slug: string | null;
  name: string;
  brand: string | null;
  price: number;
  qty: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: Enums<"order_status">;
  paymentMethod: Enums<"payment_method">;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  geo: { lat: number; lng: number } | null;
  items: AdminOrderItem[];
}

interface ShippingSnapshot {
  fullName?: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}

const ORDER_SELECT_WITH_ITEMS = "*, order_items(product_slug, name, brand, price, qty)";

type OrderRowWithItems = Tables<"orders"> & {
  order_items: Pick<Tables<"order_items">, "product_slug" | "name" | "brand" | "price" | "qty">[];
};

function toAdminOrder(row: OrderRowWithItems): AdminOrder {
  const shipping = (row.shipping ?? {}) as ShippingSnapshot;
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    discount: Number(row.discount),
    total: Number(row.total),
    createdAt: row.created_at,
    customerName: shipping.fullName ?? "",
    customerPhone: shipping.phone ?? "",
    customerAddress: [shipping.address, shipping.city].filter(Boolean).join(", "),
    geo:
      typeof shipping.lat === "number" &&
      Number.isFinite(shipping.lat) &&
      typeof shipping.lng === "number" &&
      Number.isFinite(shipping.lng)
        ? { lat: shipping.lat, lng: shipping.lng }
        : null,
    items: (row.order_items ?? []).map((i) => ({
      slug: i.product_slug,
      name: i.name,
      brand: i.brand,
      price: Number(i.price),
      qty: i.qty,
    })),
  };
}

// Fetches every order (not paginated/server-filtered) — a deliberate
// difference from getFilteredProducts: this is a single small pharmacy's
// order volume, not a public catalog that needs to scale, so search/filter
// happens client-side in OrdersClient instead of round-tripping per keystroke.
export async function getAdminOrders(): Promise<AdminOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT_WITH_ITEMS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toAdminOrder);
}

export interface AdminPromoCode {
  code: string;
  discountEgp: number;
  minSubtotal: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

// RLS (promo_admin_all) scopes this to admins — a non-admin session simply
// gets zero rows; app/admin/layout.tsx is still the primary gate for the page.
// No usage/redemption counts here: orders only store the discount amount,
// never which code produced it, so that data doesn't exist to query.
export async function getAdminPromoCodes(): Promise<AdminPromoCode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    code: r.code,
    discountEgp: Number(r.discount_egp),
    minSubtotal: Number(r.min_subtotal),
    active: r.active,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

export interface AdminReview {
  id: string;
  productSlug: string;
  productName: string;
  authorName: string;
  rating: number;
  body: string | null;
  createdAt: string;
  hidden: boolean;
}

// RLS's "Public read reviews" policy is `using (true)`, so this also sees
// hidden rows — fine, this query only ever runs from /admin/reviews, gated
// by the layout + assertAdmin() on the mutating actions.
export async function getAdminReviews(): Promise<AdminReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, author_name, rating, body, created_at, hidden, products(slug, name)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    productSlug: r.products?.slug ?? "",
    productName: r.products?.name ?? "Unknown product",
    authorName: r.author_name,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
    hidden: r.hidden,
  }));
}

export interface MyOrdersResult {
  orders: AdminOrder[];
  isLoggedIn: boolean;
}

// The customer-facing "my orders" read. The explicit user_id filter is
// load-bearing, not just belt-and-braces: RLS alone isn't enough here
// because an admin's SELECT-all policy would otherwise make their own
// account page list every customer's orders.
export async function getMyOrders(): Promise<MyOrdersResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orders: [], isLoggedIn: false };

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT_WITH_ITEMS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { orders: data.map(toAdminOrder), isLoggedIn: true };
}

export interface AdminInventoryItem {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  sub: string | null;
  sku: string | null;
  categoryId: string | null;
  categoryLabel: string;
  price: number;
  wasPrice: number | null;
  stockCount: number;
  lowStockThreshold: number;
  stockState: StockState;
  badgeLabel: string | null;
  badgeTone: BadgeTone | null;
  isPopular: boolean;
  description: string | null;
  dosage: string | null;
  ingredients: string | null;
  warnings: string | null;
  storage: string | null;
  imageUrl?: string;
  // All product_images rows (including position 0, the card/carousel
  // thumbnail) so the admin gallery section can render and manage every
  // image; consumers skip position 0 when rendering the extra grid.
  galleryImages: { id: string; url: string; position: number }[];
}

export async function getAdminInventory(): Promise<AdminInventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, brand, sub, sku, category_id, price, was_price, stock_count, low_stock_threshold, stock, badge_label, badge_tone, is_popular, description, dosage, ingredients, warnings, storage, categories(label), product_images(id, url, position)"
    )
    .order("name");
  if (error) throw error;

  return data.map((row) => {
    const galleryImages = (row.product_images ?? []).slice().sort((a, b) => a.position - b.position);
    const thumbnail = galleryImages[0];
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      sub: row.sub,
      sku: row.sku,
      categoryId: row.category_id,
      categoryLabel: row.categories?.label ?? "Uncategorized",
      price: Number(row.price),
      wasPrice: row.was_price != null ? Number(row.was_price) : null,
      stockCount: row.stock_count,
      lowStockThreshold: row.low_stock_threshold,
      stockState: row.stock,
      badgeLabel: row.badge_label,
      badgeTone: (row.badge_tone as BadgeTone | null) ?? null,
      isPopular: row.is_popular,
      description: row.description,
      dosage: row.dosage,
      ingredients: row.ingredients,
      warnings: row.warnings,
      storage: row.storage,
      imageUrl: thumbnail?.url,
      galleryImages,
    };
  });
}

export interface AccountAddress {
  id: string;
  recipient: string;
  phone: string;
  street: string;
  city: string;
  isDefault: boolean;
  lat: number | null;
  lng: number | null;
  geoAccuracyM: number | null;
}

export interface AccountData {
  isLoggedIn: boolean;
  email: string;
  fullName: string;
  phone: string;
  addresses: AccountAddress[];
}

// Everything the /account page needs in one fetch: the profile row plus the
// raw address fields (unlike getAddresses(), which pre-formats them for
// checkout's read-only radio cards — this page edits them).
export async function getAccountData(): Promise<AccountData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isLoggedIn: false, email: "", fullName: "", phone: "", addresses: [] };

  const [{ data: profile }, { data: addresses, error }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("addresses")
      .select("id, recipient, phone, street, city, is_default, lat, lng, geo_accuracy_m")
      .order("is_default", { ascending: false })
      .order("created_at"),
  ]);
  if (error) throw error;

  return {
    isLoggedIn: true,
    email: user.email ?? "",
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    addresses: (addresses ?? []).map((row) => ({
      id: row.id,
      recipient: row.recipient ?? "",
      phone: row.phone ?? "",
      street: row.street ?? "",
      city: row.city ?? "",
      isDefault: row.is_default,
      lat: row.lat,
      lng: row.lng,
      geoAccuracyM: row.geo_accuracy_m,
    })),
  };
}

// "Today" means the pharmacy's local (Africa/Cairo) calendar day, not the
// server's — counting the (small) profiles table in JS avoids computing the
// Cairo-midnight boundary as a UTC timestamptz range.
export async function getNewCustomersTodayCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("created_at");
  if (error) throw error;

  const todayKey = cairoDateKey(new Date());
  return data.filter((row) => cairoDateKey(new Date(row.created_at)) === todayKey).length;
}
