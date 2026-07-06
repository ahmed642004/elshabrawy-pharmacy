import { createClient } from "@/lib/supabase/server";
import HeaderClient, { type HeaderUser } from "@/components/HeaderClient";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headerUser: HeaderUser | null = user
    ? { email: user.email ?? "", fullName: (user.user_metadata?.full_name as string | undefined) ?? null }
    : null;

  return <HeaderClient user={headerUser} />;
}
