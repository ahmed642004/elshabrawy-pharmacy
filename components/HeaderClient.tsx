"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, MapPin, User, ShoppingCart, Menu, X, LogOut, Pill, LayoutDashboard, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Logo from "@/components/Logo";
import Wordmark from "@/components/Wordmark";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { useCart } from "@/lib/cart-context";
import { formatEGP } from "@/lib/cart-totals";

const NAV_LINKS = [
  { key: "skincare", href: "/category/skincare" },
  { key: "vitamins", href: "/category/vitamins" },
  { key: "hair", href: "/category/hair" },
  { key: "personal", href: "/category/personal" },
  { key: "devices", href: "/category/devices" },
  { key: "offers", href: "/category/offers", danger: true },
] as const;

export interface HeaderUser {
  email: string;
  fullName: string | null;
  isAdmin: boolean;
}

interface LiveResult {
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  imageUrl?: string;
}

const LIVE_SEARCH_LIMIT = 6;
const LIVE_SEARCH_DEBOUNCE_MS = 250;

interface LiveSearchDropdownProps {
  open: boolean;
  loading: boolean;
  results: LiveResult[];
  query: string;
  onClose: () => void;
  onSeeAll: () => void;
}

function LiveSearchDropdown({ open, loading, results, query, onClose, onSeeAll }: LiveSearchDropdownProps) {
  const t = useTranslations("header");
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label={t("closeSearchResults")}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        className="absolute inset-x-0 top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-[14px] border border-neutral-200 bg-white p-2 shadow-lg"
        style={{ animation: "ccDropIn 160ms ease-out" }}
      >
        {loading ? (
          <div className="px-3 py-4 text-center text-sm text-neutral-500">{t("searching")}</div>
        ) : results.length > 0 ? (
          <>
            {results.map((r) => (
              <Link
                key={r.slug}
                href={`/product/${r.slug}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-neutral-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-neutral-100">
                  {r.imageUrl ? (
                    <Image src={r.imageUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
                  ) : (
                    <Pill className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  {r.brand && (
                    <span className="block text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                      {r.brand}
                    </span>
                  )}
                  <span className="block truncate text-sm font-semibold text-neutral-900">{r.name}</span>
                </span>
                <span className="shrink-0 font-headline text-sm font-bold text-neutral-900">
                  {formatEGP(r.price)}
                </span>
              </Link>
            ))}
            <button
              type="button"
              onClick={onSeeAll}
              className="mt-1 block w-full rounded-[10px] px-2 py-2 text-center text-[13px] font-semibold text-primary-500 hover:bg-primary-50"
            >
              {t("seeAllResults", { query: query.trim() })}
            </button>
          </>
        ) : (
          <div className="px-3 py-4 text-center text-sm text-neutral-500">{t("noResults")}</div>
        )}
      </div>
    </>
  );
}

export default function HeaderClient({
  user,
  deliveryCity,
}: {
  user: HeaderUser | null;
  deliveryCity: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("header");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
  const searchQueryRef = useRef(searchQuery);
  const { itemCount } = useCart();

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      // Clearing the input should hide the dropdown immediately, not wait
      // for a debounce cycle — this is a direct sync of internal state to
      // the current input value, not a subscription to an external system.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveResults([]);
      setLiveLoading(false);
      setLiveOpen(false);
      return;
    }

    setLiveOpen(true);
    setLiveLoading(true);

    const timer = setTimeout(async () => {
      // Lazy-loaded so supabase-js stays out of the initial bundle — it's
      // only needed once the user actually types a search query.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
      const pattern = `%${escaped}%`;
      const { data, error } = await supabase
        .from("products")
        .select("slug, name, brand, price, product_images(url, position)")
        .or(`name.ilike.${pattern},brand.ilike.${pattern},sub.ilike.${pattern}`)
        .limit(LIVE_SEARCH_LIMIT);

      if (searchQueryRef.current.trim() !== q) return; // stale response, a newer query is in flight

      if (!error && data) {
        setLiveResults(
          data.map((row) => ({
            slug: row.slug,
            name: row.name,
            brand: row.brand,
            price: Number(row.price),
            imageUrl: (row.product_images ?? [])
              .slice()
              .sort((a, b) => a.position - b.position)[0]?.url,
          }))
        );
      }
      setLiveLoading(false);
    }, LIVE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function closeLiveSearch() {
    setLiveOpen(false);
  }

  function goToFullResults() {
    const q = searchQuery.trim();
    if (!q) return;
    closeLiveSearch();
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    goToFullResults();
  }

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
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
            <Logo size={36} priority />
            <Wordmark size={20} className="shrink-0" />
          </Link>

          <form onSubmit={handleSearchSubmit} className="relative max-w-[480px] flex-1">
            <div className="flex h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4">
              <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setLiveOpen(true)}
                placeholder={t("searchPlaceholder")}
                className="h-full w-full min-w-0 border-none bg-transparent font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              />
            </div>
            <LiveSearchDropdown open={liveOpen} loading={liveLoading} results={liveResults} query={searchQuery} onClose={closeLiveSearch} onSeeAll={goToFullResults} />
          </form>

          <div className="ms-auto flex shrink-0 items-center gap-4">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-neutral-500">
              <MapPin className="h-4 w-4 text-secondary-500" />
              {deliveryCity ? t("locationWithCity", { city: deliveryCity }) : t("location")}
            </span>

            <LocaleSwitcher />

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  aria-label={t("accountMenu")}
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
                      aria-label={t("closeAccountMenu")}
                      onClick={() => setAccountMenuOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div
                      className="absolute end-0 z-50 mt-2 w-56 rounded-[14px] border border-neutral-200 bg-white p-3 shadow-lg"
                      style={{ animation: "ccDropIn 160ms ease-out" }}
                    >
                      <div className="mb-2 border-b border-neutral-100 pb-2">
                        <div className="truncate font-headline text-sm font-bold text-neutral-900">
                          {user.fullName || t("signedIn")}
                        </div>
                        <div className="truncate text-xs text-neutral-500">{user.email}</div>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-start text-[13.5px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        <User className="h-4 w-4" /> {t("myAccount")}
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-start text-[13.5px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        <Package className="h-4 w-4" /> {t("myOrders")}
                      </Link>
                      {user.isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-start text-[13.5px] font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          <LayoutDashboard className="h-4 w-4" /> {t("opsDashboard")}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-start text-[13.5px] font-semibold text-danger-500 hover:bg-danger-50"
                      >
                        <LogOut className="h-4 w-4" /> {t("signOut")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                aria-label={t("account")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              >
                <User className="h-[18px] w-[18px]" />
              </Link>
            )}

            <Link
              href="/cart"
              aria-label={t("cart")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-600"
            >
              <ShoppingCart className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span
                  key={itemCount}
                  style={{ animation: "ccBadgePop 300ms ease-out" }}
                  className="absolute -end-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-danger-500 px-1 text-[11px] font-bold text-white"
                >
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
              className={`whitespace-nowrap font-label text-[13px] font-semibold no-underline transition-colors ${"danger" in link && link.danger ? "text-danger-500 hover:text-danger-600" : "text-neutral-500 hover:text-primary-600"}`}
            >
              {t(`nav.${link.key}`)}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 px-4 pt-3 pb-3 backdrop-blur md:hidden">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={t("openMenu")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-neutral-300 bg-white"
          >
            <Menu className="h-5 w-5 text-neutral-700" />
          </button>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <Logo size={32} priority className="shrink-0" />
            <span className="min-w-0 overflow-hidden">
              <Wordmark size={16} />
            </span>
          </Link>
          <Link
            href="/cart"
            aria-label={t("cart")}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {itemCount > 0 && (
              <span
                key={itemCount}
                style={{ animation: "ccBadgePop 300ms ease-out" }}
                className="absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-danger-500 px-1 text-[11px] font-bold text-white"
              >
                {itemCount}
              </span>
            )}
          </Link>
        </div>
        <form onSubmit={handleSearchSubmit} className="relative flex h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim() && setLiveOpen(true)}
            placeholder={t("searchPlaceholderShort")}
            className="h-full w-full min-w-0 border-none bg-transparent font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <LiveSearchDropdown open={liveOpen} loading={liveLoading} results={liveResults} query={searchQuery} onClose={closeLiveSearch} onSeeAll={goToFullResults} />
        </form>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white md:hidden"
          style={{ animation: "ccDropIn 200ms ease-out" }}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 p-4">
            <span className="font-headline text-lg font-extrabold text-neutral-900">{t("menu")}</span>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label={t("closeMenu")}
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
                className={`flex min-h-11 items-center border-b border-neutral-100 py-3.5 font-label text-base font-semibold no-underline ${"danger" in link && link.danger ? "text-danger-500" : "text-neutral-700"}`}
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2.5 border-t border-neutral-200 p-4">
            <LocaleSwitcher className="w-full justify-center" />
            {user ? (
              <>
                <div className="px-1 pb-1">
                  <div className="truncate font-headline text-sm font-bold text-neutral-900">
                    {user.fullName || t("signedIn")}
                  </div>
                  <div className="truncate text-xs text-neutral-500">{user.email}</div>
                </div>
                <Link href="/account" onClick={() => setMenuOpen(false)}>
                  <Button variant="outlined" size="lg" fullWidth>
                    <User className="h-[18px] w-[18px]" /> {t("myAccount")}
                  </Button>
                </Link>
                <Link href="/account/orders" onClick={() => setMenuOpen(false)}>
                  <Button variant="outlined" size="lg" fullWidth>
                    <Package className="h-[18px] w-[18px]" /> {t("myOrders")}
                  </Button>
                </Link>
                {user.isAdmin && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)}>
                    <Button variant="outlined" size="lg" fullWidth>
                      <LayoutDashboard className="h-[18px] w-[18px]" /> {t("opsDashboard")}
                    </Button>
                  </Link>
                )}
                <Button variant="outlined" size="lg" fullWidth onClick={handleSignOut}>
                  <LogOut className="h-[18px] w-[18px]" /> {t("signOut")}
                </Button>
              </>
            ) : (
              <Link href="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outlined" size="lg" fullWidth>
                  <User className="h-[18px] w-[18px]" /> {t("signIn")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
