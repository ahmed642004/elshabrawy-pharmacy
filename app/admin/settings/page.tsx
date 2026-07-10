import { Suspense } from "react";
import SettingsClient from "@/components/admin/SettingsClient";
import { getDeliverySettings } from "@/lib/queries";

export default async function AdminSettingsPage() {
  const settings = await getDeliverySettings();
  return (
    <Suspense>
      <SettingsClient settings={settings} />
    </Suspense>
  );
}
