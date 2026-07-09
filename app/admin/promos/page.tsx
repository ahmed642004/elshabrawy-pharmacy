import { Suspense } from "react";
import PromosClient from "@/components/admin/PromosClient";
import { getAdminPromoCodes } from "@/lib/queries";

export default async function AdminPromosPage() {
  const promos = await getAdminPromoCodes();
  return (
    <Suspense>
      <PromosClient promos={promos} />
    </Suspense>
  );
}
