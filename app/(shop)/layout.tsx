import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewPrompt from "@/components/product/ReviewPrompt";
import { getPendingReviews } from "@/lib/queries";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // Delivered-but-unreviewed products for the signed-in customer; [] for
  // guests. ReviewPrompt renders nothing when empty and only auto-opens once
  // per session, so this is a no-op for most page views.
  const pendingReviews = await getPendingReviews();

  return (
    <>
      <Header />
      {children}
      <Footer />
      <ReviewPrompt products={pendingReviews} />
    </>
  );
}
