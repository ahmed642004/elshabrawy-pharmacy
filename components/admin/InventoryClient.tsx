"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Plus, Minus, AlertTriangle, Pencil, Pill } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import StockProgressBar from "@/components/admin/StockProgressBar";
import ProductFormModal from "@/components/admin/ProductFormModal";
import { adjustProductStock } from "@/lib/actions";
import { formatEGP } from "@/lib/cart-totals";
import type { AdminInventoryItem, CategoryRow } from "@/lib/queries";

interface InventoryClientProps {
  inventory: AdminInventoryItem[];
  categories: CategoryRow[];
}

export default function InventoryClient({ inventory, categories }: InventoryClientProps) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addModalOpen, setAddModalOpen] = useState(searchParams.get("add") === "1");
  const [editingItem, setEditingItem] = useState<AdminInventoryItem | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventory.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (query && !(item.name.toLowerCase().includes(query) || (item.sku ?? "").toLowerCase().includes(query))) {
        return false;
      }
      return true;
    });
  }, [inventory, search, categoryFilter]);

  const lowStockCount = inventory.filter((i) => i.stockCount <= i.lowStockThreshold).length;

  function handleAdjust(id: string, delta: number) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await adjustProductStock(id, delta);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-10 md:py-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-3xl">
            Inventory
          </h1>
          <p className="m-0 mt-1 text-sm text-neutral-500">
            {filtered.length} item{filtered.length === 1 ? "" : "s"} · {lowStockCount} need reordering
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative w-full sm:w-[240px]">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search medicine or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} /> Add item
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`h-[34px] rounded-full px-4 font-label text-sm font-semibold transition-colors ${
            categoryFilter === "all"
              ? "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)]"
              : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryFilter(c.id)}
            className={`h-[34px] rounded-full px-4 font-label text-sm font-semibold transition-colors ${
              categoryFilter === c.id
                ? "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)]"
                : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[20px] border border-neutral-200 bg-white shadow-sm">
        <div className="min-w-[800px]">
        <div className="grid grid-cols-[1.4fr_110px_130px_90px_100px_170px] gap-2 border-b border-neutral-100 px-5 py-3.5 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
          <div>Medicine</div>
          <div>Category</div>
          <div>Stock level</div>
          <div>Price</div>
          <div>SKU</div>
          <div>Adjust</div>
        </div>
        {filtered.map((item) => {
          const low = item.stockCount <= item.lowStockThreshold;
          const pending = pendingIds.has(item.id);
          return (
            <div
              key={item.id}
              className="grid grid-cols-[1.4fr_110px_130px_90px_100px_170px] items-center gap-2 border-b border-neutral-100 px-5 py-3.5 last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-neutral-100">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Pill className="h-4 w-4 text-neutral-300" strokeWidth={1.5} />
                  )}
                </div>
                <div className="font-label text-sm font-semibold text-neutral-900">{item.name}</div>
                {low && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-500" />}
              </div>
              <div className="text-xs text-neutral-500">{item.categoryLabel}</div>
              <StockProgressBar stockCount={item.stockCount} lowStockThreshold={item.lowStockThreshold} />
              <div className="font-label text-sm font-semibold text-neutral-900">{formatEGP(item.price)}</div>
              <div className="text-xs text-neutral-400">{item.sku}</div>
              <div className="flex gap-1.5">
                <IconButton
                  icon={Minus}
                  aria-label={`Decrease stock for ${item.name}`}
                  size="sm"
                  disabled={pending}
                  onClick={() => handleAdjust(item.id, -10)}
                />
                <IconButton
                  icon={Plus}
                  aria-label={`Increase stock for ${item.name}`}
                  size="sm"
                  disabled={pending}
                  onClick={() => handleAdjust(item.id, 10)}
                />
                <IconButton
                  icon={Pencil}
                  aria-label={`Edit ${item.name}`}
                  size="sm"
                  onClick={() => setEditingItem(item)}
                />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">No items match this search.</div>
        )}
        </div>
      </div>

      {addModalOpen && <ProductFormModal categories={categories} onClose={() => setAddModalOpen(false)} />}
      {editingItem && (
        <ProductFormModal categories={categories} product={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </main>
  );
}
