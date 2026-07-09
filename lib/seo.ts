// Structured-data builders shared by the listing pages.

interface ListedProduct {
  slug: string;
  name: string;
}

// BreadcrumbList + ItemList for a product listing page. The last breadcrumb
// has no `item` — it is the current page.
export function listingJsonLd(
  base: string,
  homeName: string,
  pageName: string,
  products: ListedProduct[]
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: homeName, item: base },
          { "@type": "ListItem", position: 2, name: pageName },
        ],
      },
      {
        "@type": "ItemList",
        itemListElement: products.slice(0, 20).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.name,
          url: `${base}/product/${p.slug}`,
        })),
      },
    ],
  };
}
