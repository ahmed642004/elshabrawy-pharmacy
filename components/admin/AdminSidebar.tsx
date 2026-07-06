"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Boxes, Plus, Stethoscope } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary-500 shadow-[0_1px_2px_rgba(15,82,255,0.25)]">
        <Plus className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
      </span>
      <div className="leading-tight">
        <div className="font-headline text-base font-bold text-neutral-900">
          Clinical<span className="text-primary-500">Clarity</span>
        </div>
        <div className="font-label text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
          Ops dashboard
        </div>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      {/* Mobile: top bar with horizontal nav pills instead of a sidebar. */}
      <div className="flex shrink-0 flex-col border-b border-neutral-200 bg-white md:hidden">
        <div className="px-4 pt-3 pb-2">
          <Logo />
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-4 pb-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 font-label text-sm font-semibold transition-colors ${
                isActive(href)
                  ? "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)]"
                  : "border border-neutral-300 bg-white text-neutral-600"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Desktop: fixed left sidebar. */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-6 md:flex">
        <div className="mb-5 border-b border-neutral-200 px-2 pb-6">
          <Logo />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-10 items-center gap-2.5 rounded-[10px] px-3 font-label text-sm font-semibold transition-colors ${
                isActive(href)
                  ? "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)]"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-2 rounded-[14px] border border-primary-100 bg-tertiary-100 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-secondary-500">
              <Stethoscope className="h-4 w-4 text-white" strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <div className="font-label text-sm font-semibold text-neutral-900">Dr. Laila Fahmy</div>
              <div className="text-[11px] text-neutral-500">Pharmacist on duty</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-label text-[11px] font-semibold text-secondary-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
            Online · 3 chats waiting
          </div>
        </div>
      </aside>
    </>
  );
}
