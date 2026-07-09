import { createClient } from "@/lib/supabase/server";
import { getHeaderDeliveryCity } from "@/lib/queries";
import HeaderClient, { type HeaderUser } from "@/components/HeaderClient";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = profile?.is_admin ?? false;
  }

  const headerUser: HeaderUser | null = user
    ? {
        email: user.email ?? "",
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
        isAdmin,
      }
    : null;

  // null for guests/no saved address — HeaderClient falls back to generic copy.
  const deliveryCity = user ? await getHeaderDeliveryCity() : null;

  return <HeaderClient user={headerUser} deliveryCity={deliveryCity} />;
}
