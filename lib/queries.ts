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
}

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, label")
    .order("sort_order");
  if (error) throw error;
  return data;
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

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("products")
    .select("*, categories(label), product_images(url, position), reviews(author_name, rating, body, created_at)")
    .eq("slug", slug)
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
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
}

export interface AddressesResult {
  addresses: AddressRow[];
  isLoggedIn: boolean;
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
      label: row.is_default ? "Default" : "Address",
      name: row.recipient ?? "",
      phone: row.phone ?? "",
      address: row.street ?? "",
      city: [row.city, row.governorate].filter(Boolean).join(", "),
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
  items: AdminOrderItem[];
}

interface ShippingSnapshot {
  fullName?: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
}

const ORDER_SELECT_WITH_ITEMS = "*, order_items(name, brand, price, qty)";

type OrderRowWithItems = Tables<"orders"> & {
  order_items: Pick<Tables<"order_items">, "name" | "brand" | "price" | "qty">[];
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
    items: (row.order_items ?? []).map((i) => ({
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
  name: string;
  sku: string | null;
  categoryId: string | null;
  categoryLabel: string;
  price: number;
  stockCount: number;
  lowStockThreshold: number;
  stockState: StockState;
  imageUrl?: string;
}

export async function getAdminInventory(): Promise<AdminInventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, sku, category_id, price, stock_count, low_stock_threshold, stock, categories(label), product_images(url, position)"
    )
    .order("name");
  if (error) throw error;

  return data.map((row) => {
    const thumbnail = (row.product_images ?? []).slice().sort((a, b) => a.position - b.position)[0];
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      categoryId: row.category_id,
      categoryLabel: row.categories?.label ?? "Uncategorized",
      price: Number(row.price),
      stockCount: row.stock_count,
      lowStockThreshold: row.low_stock_threshold,
      stockState: row.stock,
      imageUrl: thumbnail?.url,
    };
  });
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
