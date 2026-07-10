import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewPrompt from "@/components/product/ReviewPrompt";
import RestockBanner from "@/components/RestockBanner";
import WhatsAppButton from "@/components/WhatsAppButton";
import { getPendingReviews, getRestockedNotifies } from "@/lib/queries";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // Both fail closed to [] for guests/errors — neither should ever take down
  // a storefront page. Fetched in parallel, not serialized as two awaits.
  const [pendingReviews, restocked] = await Promise.all([getPendingReviews(), getRestockedNotifies()]);

  return (
    <>
      <Header />
      <RestockBanner items={restocked} />
      {children}
      <Footer />
      <WhatsAppButton />
      <ReviewPrompt products={pendingReviews} />
    </>
  );
}
