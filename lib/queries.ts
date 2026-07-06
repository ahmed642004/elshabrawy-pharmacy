import { createClient } from "@/lib/supabase/server";
import type { Product, BadgeTone, StockState } from "@/components/ProductCard";
import type { Tables } from "@/lib/database.types";

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

export async function getAllProducts(): Promise<ListingProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT_WITH_IMAGES)
    .order("created_at");
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
