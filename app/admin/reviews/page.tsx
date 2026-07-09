import { Suspense } from "react";
import ReviewsClient from "@/components/admin/ReviewsClient";
import { getAdminReviews } from "@/lib/queries";

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();
  return (
    <Suspense>
      <ReviewsClient reviews={reviews} />
    </Suspense>
  );
}
