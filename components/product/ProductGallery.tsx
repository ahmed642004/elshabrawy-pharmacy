"use client";

import { useState } from "react";
import { Pill, X, ZoomIn } from "lucide-react";

const PLACEHOLDER_COUNT = 4;

export default function ProductGallery({ name, images = [] }: { name: string; images?: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hasImages = images.length > 0;
  const thumbCount = hasImages ? images.length : PLACEHOLDER_COUNT;
  const activeImage = hasImages ? images[activeIndex] : undefined;

  return (
    <>
      <div className="flex flex-col-reverse gap-3 md:flex-row-reverse">
        <div className="flex shrink-0 flex-row gap-2.5 overflow-x-auto md:w-[76px] md:flex-col md:overflow-x-visible md:overflow-y-auto">
          {Array.from({ length: thumbCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show image ${i + 1} of ${name}`}
              className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-neutral-100 md:h-[76px] md:w-[76px] ${
                i === activeIndex ? "border-2 border-primary-500" : "border border-neutral-300"
              }`}
            >
              {hasImages ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[i]} alt="" className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-6 w-6 text-neutral-300" strokeWidth={1.5} />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Zoom in on ${name}`}
          className="relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-[20px] border border-neutral-200 bg-neutral-100"
        >
          <div className="flex h-full w-full items-center justify-center">
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeImage} alt={name} className="h-full w-full object-cover" />
            ) : (
              <Pill className="h-16 w-16 text-neutral-300" strokeWidth={1.5} />
            )}
          </div>
          <span className="absolute right-3 bottom-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-neutral-900/55">
            <ZoomIn className="h-4 w-4 text-white" />
          </span>
        </button>
      </div>

      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/80 p-10"
        >
          <div className="relative aspect-square w-[min(680px,90vw)]">
            <div className="flex h-full w-full items-center justify-center rounded-[16px] bg-neutral-100">
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeImage} alt={name} className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-24 w-24 text-neutral-300" strokeWidth={1.5} />
              )}
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close"
              className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
