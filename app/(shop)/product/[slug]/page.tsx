import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/site";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import ProductTabs from "@/components/product/ProductTabs";
import RelatedProducts from "@/components/product/RelatedProducts";
import ProductReviews from "@/components/product/ProductReviews";
import { getProductBySlug, getRelatedProducts, hasNotifyRequest, isSignedIn } from "@/lib/queries";

// Collapses whitespace and cuts at the last word boundary before `max` chars
// rather than mid-word — matters for Arabic descriptions especially.
function truncateForMeta(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, t, locale] = await Promise.all([
    getProductBySlug(slug),
    getTranslations("common"),
    getLocale(),
  ]);
  if (!product) return { title: { absolute: t("siteTitle") } };

  const description = truncateForMeta(product.description ?? "", 160) || t("siteDescription");
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${slug}` },
    // Next replaces the root openGraph object wholesale (no deep merge), so
    // siteName/locale must be re-declared here or product pages lose them.
    openGraph: {
      title: product.name,
      description,
      siteName: t("siteTitle"),
      type: "website",
      locale: locale === "ar" ? "ar_EG" : "en_US",
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, tListing, signedIn, notifyRequested] = await Promise.all([
    getRelatedProducts(product.category, product.slug),
    getTranslations("listing"),
    isSignedIn(),
    hasNotifyRequest(product.slug),
  ]);

  const base = siteUrl();
  const stock = product.stock ?? "in";
  // Product + BreadcrumbList structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description ?? undefined,
        image: product.images.length > 0 ? product.images : undefined,
        url: `${base}/product/${product.slug}`,
        ...(product.sku ? { sku: product.sku } : {}),
        ...(product.categoryLabel ? { category: product.categoryLabel } : {}),
        ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
        ...(product.rating != null && product.reviewCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.rating,
                reviewCount: product.reviewCount,
              },
            }
          : {}),
        ...(product.reviews.length > 0
          ? {
              review: product.reviews.slice(0, 10).map((r) => ({
                "@type": "Review",
                author: { "@type": "Person", name: r.authorName },
                reviewRating: { "@type": "Rating", ratingValue: r.rating },
                ...(r.body ? { reviewBody: r.body } : {}),
                datePublished: r.createdAt.slice(0, 10),
              })),
            }
          : {}),
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: "EGP",
          availability:
            stock === "out" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          url: `${base}/product/${product.slug}`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: tListing("breadcrumbHome"), item: base },
          {
            "@type": "ListItem",
            position: 2,
            name: product.categoryLabel,
            item: `${base}/category/${product.category}`,
          },
          { "@type": "ListItem", position: 3, name: product.name },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 py-4 md:gap-10 md:px-10 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
        <Link href="/" className="hover:text-neutral-700">
          {tListing("breadcrumbHome")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <span>{product.categoryLabel}</span>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <span className="font-semibold text-neutral-900">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-9 md:grid-cols-2">
        <ProductGallery name={product.name} images={product.images} />
        <ProductPurchasePanel
          slug={product.slug}
          brand={product.brand ?? ""}
          name={product.name}
          price={product.price}
          wasPrice={product.wasPrice}
          stock={product.stock ?? "in"}
          rating={product.rating}
          reviewCount={product.reviewCount}
          notifyRequested={notifyRequested}
        />
      </div>

      <ProductTabs
        description={product.description}
        dosage={product.dosage}
        ingredients={product.ingredients}
        warnings={product.warnings}
        storage={product.storage}
      />
      {related.length > 0 && <RelatedProducts products={related} />}
      <ProductReviews
        slug={product.slug}
        isLoggedIn={signedIn}
        rating={product.rating}
        reviewCount={product.reviewCount}
        reviews={product.reviews}
      />
    </main>
  );
}
