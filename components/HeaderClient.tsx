"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, MapPin, User, ShoppingCart, Menu, X, LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import { useCart } from "@/lib/cart-context";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { label: "Skincare", href: "/category/skincare" },
  { label: "Vitamins & supplements", href: "/category/vitamins" },
  { label: "Hair care", href: "/category/hair" },
  { label: "Personal care", href: "/category/personal" },
  { label: "Devices", href: "/category/devices" },
  { label: "Offers", href: "/category/offers", danger: true },
];

export interface HeaderUser {
  email: string;
  fullName: string | null;
}

export default function HeaderClient({ user }: { user: HeaderUser | null }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { itemCount } = useCart();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAccountMenuOpen(false);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Desktop / tablet header */}
      <header className="sticky top-0 z-30 hidden border-b border-neutral-200 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-6 py-3.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-500 shadow-[0_6px_18px_rgba(15,82,255,0.28)]">
              <Plus className="h-5 w-5 text-white" />
            </span>
            <span className="whitespace-nowrap font-headline text-xl font-extrabold tracking-tight text-neutral-900">
              Elshabrawy <span className="text-primary-500">Pharmacy</span>
            </span>
          </Link>

          <div className="max-w-[480px] flex-1">
            <div className="flex h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4">
              <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
              <input
                type="search"
                placeholder="Search medicines, brands, health needs…"
                className="h-full w-full min-w-0 border-none bg-transparent font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-neutral-500">
              <MapPin className="h-4 w-4 text-secondary-500" /> Cairo · Nasr City
            </span>

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  aria-label="Account menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-tertiary-100 text-primary-600 hover:bg-tertiary-100/70"
                >
                  <span className="font-label text-sm font-bold">
                    {(user.fullName || user.email).charAt(0).toUpperCase()}
                  </span>
                </button>
                {accountMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close account menu"
                      onClick={() => setAccountMenuOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-[14px] border border-neutral-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 border-b border-neutral-100 pb-2">
                        <div className="truncate font-headline text-sm font-bold text-neutral-900">
                          {user.fullName || "Signed in"}
                        </div>
                        <div className="truncate text-xs text-neutral-500">{user.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-[13.5px] font-semibold text-danger-500 hover:bg-danger-50"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                aria-label="Account"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              >
                <User className="h-[18px] w-[18px]" />
              </Link>
            )}

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600"
            >
              <ShoppingCart className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-danger-500 px-1 text-[11px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1280px] gap-6 overflow-x-auto px-6 pb-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap font-label text-[13px] font-semibold no-underline ${link.danger ? "text-danger-500" : "text-neutral-500"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 px-4 pt-3 pb-3 backdrop-blur md:hidden">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-neutral-300 bg-white"
          >
            <Menu className="h-5 w-5 text-neutral-700" />
          </button>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-500 shadow-[0_6px_18px_rgba(15,82,255,0.28)]">
              <Plus className="h-[18px] w-[18px] text-white" />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap font-headline text-base font-extrabold tracking-tight text-neutral-900">
              Elshabrawy <span className="text-primary-500">Pharmacy</span>
            </span>
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-danger-500 px-1 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
        <div className="flex h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
          <input
            type="search"
            placeholder="Search medicines, brands…"
            className="h-full w-full min-w-0 border-none bg-transparent font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white md:hidden">
          <div className="flex items-center justify-between border-b border-neutral-200 p-4">
            <span className="font-headline text-lg font-extrabold text-neutral-900">Menu</span>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-neutral-300 bg-white"
            >
              <X className="h-5 w-5 text-neutral-700" />
            </button>
          </div>
          <div className="flex flex-col px-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex min-h-11 items-center border-b border-neutral-100 py-3.5 font-label text-base font-semibold no-underline ${link.danger ? "text-danger-500" : "text-neutral-700"}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2.5 border-t border-neutral-200 p-4">
            {user ? (
              <>
                <div className="px-1 pb-1">
                  <div className="truncate font-headline text-sm font-bold text-neutral-900">
                    {user.fullName || "Signed in"}
                  </div>
                  <div className="truncate text-xs text-neutral-500">{user.email}</div>
                </div>
                <Button variant="outlined" size="lg" fullWidth onClick={handleSignOut}>
                  <LogOut className="h-[18px] w-[18px]" /> Sign out
                </Button>
              </>
            ) : (
              <Link href="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outlined" size="lg" fullWidth>
                  <User className="h-[18px] w-[18px]" /> Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
