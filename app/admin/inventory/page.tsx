import { Suspense } from "react";
import InventoryClient from "@/components/admin/InventoryClient";
import { getAdminInventory, getCategories } from "@/lib/queries";

export default async function AdminInventoryPage() {
  const [inventory, categories] = await Promise.all([getAdminInventory(), getCategories()]);
  return (
    <Suspense>
      <InventoryClient inventory={inventory} categories={categories} />
    </Suspense>
  );
}
