"use client";

import { useState, type FormEvent } from "react";
import { X, ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import { addProduct, updateProduct } from "@/lib/actions";
import type { AdminInventoryItem, CategoryRow } from "@/lib/queries";

interface ProductFormModalProps {
  categories: CategoryRow[];
  // When set, the modal edits this product instead of creating a new one.
  product?: AdminInventoryItem;
  onClose: () => void;
}

export default function ProductFormModal({ categories, product, onClose }: ProductFormModalProps) {
  const editing = Boolean(product);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImagePreview(file ? URL.createObjectURL(file) : (product?.imageUrl ?? null));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      if (editing) await updateProduct(formData);
      else await addProduct(formData);
      onClose();
    } catch {
      setError("Something went wrong saving this item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "ccOverlayIn 160ms ease-out" }}>
      <div onClick={onClose} className="absolute inset-0 bg-neutral-900/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-y-auto rounded-[20px] bg-white p-5 shadow-lg md:p-7"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="font-headline text-xl font-bold text-neutral-900">
              {editing ? "Edit item" : "Add item"}
            </div>
            <div className="mt-0.5 text-sm text-neutral-500">
              {editing ? product?.name : "New medicine into inventory"}
            </div>
          </div>
          <IconButton icon={X} aria-label="Close" shape="circle" size="sm" onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {editing && <input type="hidden" name="id" value={product?.id} />}

          <label className="flex flex-col gap-2">
            <span className="font-label text-xs font-semibold text-neutral-500">
              {editing ? "Photo (upload to replace)" : "Photo (optional)"}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-neutral-100">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-neutral-300" />
                )}
              </div>
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                className="min-w-0 text-sm text-neutral-500 file:mr-3 file:rounded-[8px] file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-neutral-700"
              />
            </div>
          </label>

          <div>
            <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">Medicine name</label>
            <Input name="name" required placeholder="e.g. Ibuprofen 400mg" defaultValue={product?.name ?? ""} />
          </div>

          <div>
            <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">Category</label>
            <select
              name="categoryId"
              defaultValue={product?.categoryId ?? categories[0]?.id ?? ""}
              className="h-[46px] w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 font-body text-sm text-neutral-900 outline-none focus:border-primary-500 focus:ring-3 focus:ring-primary-500/20"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">SKU</label>
              <Input name="sku" placeholder="Auto-generated" defaultValue={product?.sku ?? ""} />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">Price (EGP)</label>
              <Input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0"
                defaultValue={product?.price ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">
                {editing ? "Stock count" : "Starting stock"}
              </label>
              <Input
                name="stockCount"
                type="number"
                min="0"
                required
                placeholder="0"
                defaultValue={product?.stockCount ?? ""}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-semibold text-neutral-500">
                Low stock alert at
              </label>
              <Input
                name="lowStockThreshold"
                type="number"
                min="0"
                placeholder="10"
                defaultValue={product?.lowStockThreshold ?? ""}
              />
            </div>
          </div>

          {error && <div className="rounded-[10px] bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600">{error}</div>}

          <div className="mt-2 flex gap-2.5">
            <Button type="button" variant="outlined" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" fullWidth disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Save item"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
