"use client";

import { useState } from "react";
import Link from "next/link";
import { X, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { dismissRestockNotice } from "@/lib/actions";
import type { RestockedNotify } from "@/lib/queries";

// A dismissible banner bar under the header, not a modal — ReviewPrompt
// already owns the modal slot in the shop layout.
export default function RestockBanner({ items }: { items: RestockedNotify[] }) {
  const t = useTranslations("restock");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || items.length === 0) return null;

  function handleDismiss() {
    setDismissed(true);
    // Fire-and-forget: the local dismissal already hid the banner, so a
    // failed write just means it may reappear on the next navigation.
    dismissRestockNotice(items.map((i) => i.id)).catch(() => {});
  }

  return (
    <div className="border-b border-primary-100 bg-tertiary-100 px-4 py-2.5 md:px-10">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3">
        <PackageCheck className="h-4 w-4 shrink-0 text-primary-500" />
        <div className="min-w-0 flex-1 text-[13px] text-neutral-700">
          <span className="font-semibold">{t("title", { count: items.length })}</span>{" "}
          {items.map((item, i) => (
            <span key={item.id}>
              <Link href={`/product/${item.slug}`} onClick={handleDismiss} className="font-semibold text-primary-600 hover:underline">
                {item.name}
              </Link>
              {i < items.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={handleDismiss}
          className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
