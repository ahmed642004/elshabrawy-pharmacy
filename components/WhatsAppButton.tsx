"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { whatsappLink } from "@/lib/contact";

// Cart and checkout render their own fixed mobile bottom action bar; the FAB
// would sit on top of it, so it's hidden there.
const HIDDEN_PREFIXES = ["/cart", "/checkout"];

export default function WhatsAppButton() {
  const pathname = usePathname();
  const t = useTranslations("common");

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <a
      href={whatsappLink(t("whatsappPrefill"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappAria")}
      className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.45)] transition-transform hover:scale-105"
    >
      <MessageCircle className="h-7 w-7" strokeWidth={2} />
    </a>
  );
}
