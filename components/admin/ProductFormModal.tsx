"use client";

import { useState, type FormEvent } from "react";
import { X, ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import { addProduct, updateProduct, addProductImages, deleteProductImage } from "@/lib/actions";
import type { AdminInventoryItem, CategoryRow } from "@/lib/queries";

interface ProductFormModalProps {
  categories: CategoryRow[];
  // When set, the modal edits this product instead of creating a new one.
  product?: AdminInventoryItem;
  onClose: () => void;
}

const labelClass = "mb-1.5 block font-label text-xs font-semibold text-neutral-500";
const textareaClass =
  "w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 py-2.5 font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-3 focus:ring-primary-500/20";

export default function ProductFormModal({ categories, product, onClose }: ProductFormModalProps) {
  const editing = Boolean(product);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [priceValue, setPriceValue] = useState(product?.price != null ? String(product.price) : "");
  const [galleryImages, setGalleryImages] = useState(product?.galleryImages ?? []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [galleryError, setGalleryError] = useState("");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImagePreview(file ? URL.createObjectURL(file) : (product?.imageUrl ?? null));
  }

  // Gallery uploads/deletes are independent of the main form submit — they
  // hit their own server actions immediately and update local state so the
  // modal reflects the change without waiting for a full page refetch (the
  // parent's inventory prop only refreshes once this modal closes).
  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !product) return;
    setUploadingImages(true);
    setGalleryError("");
    try {
      const formData = new FormData();
      formData.append("productId", product.id);
      formData.append("slug", product.slug);
      for (const file of Array.from(files)) formData.append("images", file);
      const inserted = await addProductImages(formData);
      setGalleryImages((prev) => [...prev, ...inserted]);
    } catch {
      setGalleryError("Couldn't upload one or more images. Please try again.");
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  }

  async function handleDeleteImage(id: string) {
    setDeletingImageId(id);
    setGalleryError("");
    try {
      await deleteProductImage(id);
      setGalleryImages((prev) => prev.filter((img) => img.id !== id));
    } catch {
      setGalleryError("Couldn't remove that image. Please try again.");
    } finally {
      setDeletingImageId(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const price = Number(formData.get("price"));
    const wasPriceRaw = String(formData.get("wasPrice") ?? "").trim();
    if (wasPriceRaw && Number(wasPriceRaw) < price) {
      setError("Was price can't be lower than the price.");
      setSubmitting(false);
      return;
    }

    try {
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
        style={{ animation: "ccScaleIn 200ms ease-out" }}
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

          {editing && product && (
            <div className="flex flex-col gap-2">
              <span className="font-label text-xs font-semibold text-neutral-500">Gallery images</span>
              {galleryImages.filter((img) => img.position !== 0).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {galleryImages
                    .filter((img) => img.position !== 0)
                    .map((img) => (
                      <div key={img.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          disabled={deletingImageId === img.id}
                          aria-label="Remove image"
                          className="absolute top-0.5 end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/60 text-white disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
              <label className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[10px] border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700">
                <ImagePlus className="h-4 w-4" />
                {uploadingImages ? "Uploading…" : "Add gallery images"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryUpload}
                  disabled={uploadingImages}
                  className="hidden"
                />
              </label>
              {galleryError && <div className="text-xs text-danger-500">{galleryError}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Medicine name</label>
              <Input name="name" required placeholder="e.g. Ibuprofen 400mg" defaultValue={product?.name ?? ""} />
            </div>
            <div>
              <label className={labelClass}>Brand</label>
              <Input name="brand" placeholder="e.g. Kahira Pharma" defaultValue={product?.brand ?? ""} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Category</label>
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

          <div>
            <label className={labelClass}>Short tagline</label>
            <Input name="sub" placeholder="e.g. Fast-acting pain relief" defaultValue={product?.sub ?? ""} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>SKU</label>
              <Input name="sku" placeholder="Auto" defaultValue={product?.sku ?? ""} />
            </div>
            <div>
              <label className={labelClass}>Price (EGP)</label>
              <Input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0"
                defaultValue={product?.price ?? ""}
                onChange={(e) => setPriceValue(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Was price</label>
              <Input
                name="wasPrice"
                type="number"
                min={priceValue || "0"}
                step="0.01"
                placeholder="—"
                defaultValue={product?.wasPrice ?? ""}
                title="Was price can't be lower than the price"
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-neutral-400">
            Set a higher &ldquo;was price&rdquo; to show a strikethrough discount on the product.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{editing ? "Stock count" : "Starting stock"}</label>
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
              <label className={labelClass}>Low stock alert at</label>
              <Input
                name="lowStockThreshold"
                type="number"
                min="0"
                placeholder="10"
                defaultValue={product?.lowStockThreshold ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Badge label</label>
              <Input name="badgeLabel" placeholder="e.g. Best seller" defaultValue={product?.badgeLabel ?? ""} />
            </div>
            <div>
              <label className={labelClass}>Badge style</label>
              <select
                name="badgeTone"
                defaultValue={product?.badgeTone ?? ""}
                className="h-[46px] w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 font-body text-sm text-neutral-900 outline-none focus:border-primary-500 focus:ring-3 focus:ring-primary-500/20"
              >
                <option value="">None</option>
                <option value="sale">Sale</option>
                <option value="bestseller">Best seller</option>
                <option value="new">New</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-3">
            <input
              type="checkbox"
              name="isPopular"
              defaultChecked={product?.isPopular ?? false}
              className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary-500"
            />
            <span className="font-label text-sm font-semibold text-neutral-700">Feature on the homepage</span>
          </label>

          <div className="mt-1 border-t border-neutral-200 pt-3.5">
            <div className="mb-1 font-label text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              Product details (optional)
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="What the product is and what it's used for"
              defaultValue={product?.description ?? ""}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Dosage / directions</label>
            <textarea
              name="dosage"
              rows={2}
              placeholder="How to use it"
              defaultValue={product?.dosage ?? ""}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Ingredients</label>
            <textarea
              name="ingredients"
              rows={2}
              placeholder="Active and inactive ingredients"
              defaultValue={product?.ingredients ?? ""}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Warnings</label>
            <textarea
              name="warnings"
              rows={2}
              placeholder="Precautions and contraindications"
              defaultValue={product?.warnings ?? ""}
              className={textareaClass}
            />
          </div>

          <div>
            <label className={labelClass}>Storage</label>
            <textarea
              name="storage"
              rows={2}
              placeholder="How to store it"
              defaultValue={product?.storage ?? ""}
              className={textareaClass}
            />
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
