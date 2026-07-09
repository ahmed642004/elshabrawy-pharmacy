import type { Metadata } from "next";
import CartPageClient from "@/components/cart/CartPageClient";

// Private page: robots.txt already disallows it; this covers the case where
// the disallow is ever lifted or the page is reached via external links.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CartPage() {
  return <CartPageClient />;
}
