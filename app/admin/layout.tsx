import type { ReactNode } from "react";
import Link from "next/link";
import { LogIn, ShieldAlert } from "lucide-react";
import Button from "@/components/ui/Button";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getAdminSession } from "@/lib/queries";

// The one place the /admin auth+role gate lives — every child page (Overview,
// Orders, Inventory) inherits it, since they all need the identical check
// (unlike checkout's one-off gate on a single page). Next.js never renders
// {children} when this component returns early, so child page.tsx server
// fetches never run for a non-admin visitor.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isLoggedIn, isAdmin } = await getAdminSession();

  if (!isLoggedIn) {
    return (
      <main dir="ltr" className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="flex max-w-[380px] flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
            <LogIn className="h-[34px] w-[34px] text-primary-500" />
          </span>
          <div className="font-headline text-xl font-extrabold text-neutral-900">Sign in required</div>
          <div className="text-sm text-neutral-500">Sign in with a staff account to open the ops dashboard.</div>
          <Link href="/auth?redirect=/admin">
            <Button variant="primary" size="lg">
              Sign in
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main dir="ltr" className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="flex max-w-[380px] flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-50">
            <ShieldAlert className="h-[34px] w-[34px] text-danger-500" />
          </span>
          <div className="font-headline text-xl font-extrabold text-neutral-900">Access denied</div>
          <div className="text-sm text-neutral-500">This account doesn&apos;t have access to the ops dashboard.</div>
          <Link href="/" className="text-sm font-semibold text-neutral-500 hover:text-neutral-700">
            Back to store
          </Link>
        </div>
      </main>
    );
  }

  // dir="ltr" pins the dashboard to English/LTR even when the storefront's
  // Arabic locale cookie has flipped <html dir> to rtl — the admin UI is
  // deliberately not localized (internal staff tool).
  return (
    <div dir="ltr" className="flex h-screen w-full flex-col overflow-hidden bg-neutral-50 md:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
