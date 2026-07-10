import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/ui/Button";
import { whatsappLink, PHONE_DISPLAY, PHONE_LINK } from "@/lib/contact";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-7 px-4 py-6 md:px-6 md:py-10">
      <div>
        <h1 className="m-0 font-headline text-[28px] font-extrabold tracking-tight text-neutral-900 md:text-[34px]">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] leading-[1.7] text-neutral-600">{t("intro")}</p>
      </div>

      <section className="rounded-[20px] border border-secondary-100 bg-secondary-50 p-6 md:p-7">
        <h2 className="m-0 font-headline text-lg font-bold text-neutral-900 md:text-xl">
          {t("whatsappTitle")}
        </h2>
        <p className="mt-2 max-w-[640px] text-[14.5px] leading-[1.7] text-neutral-600">
          {t("whatsappBody")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="primary">
              <MessageCircle className="h-[18px] w-[18px]" /> {t("whatsappCta")}
            </Button>
          </a>
          <a
            href={`tel:${PHONE_LINK}`}
            dir="ltr"
            className="flex items-center gap-2 font-label text-sm font-semibold text-neutral-700 no-underline hover:text-primary-500"
          >
            <Phone className="h-[18px] w-[18px]" /> {PHONE_DISPLAY}
          </a>
        </div>
        <p className="mt-3 text-[13px] text-neutral-500">{t("deliveryAreaNote")}</p>
      </section>

      <section>
        <h2 className="m-0 font-headline text-lg font-bold text-neutral-900 md:text-xl">
          {t("ordersTitle")}
        </h2>
        <p className="mt-2 max-w-[640px] text-[14.5px] leading-[1.7] text-neutral-600">
          {t("ordersBody")}
        </p>
        <div className="mt-4">
          <Link href="/account/orders">
            <Button variant="outlined">{t("ordersCta")}</Button>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="m-0 font-headline text-lg font-bold text-neutral-900 md:text-xl">
          {t("supportTitle")}
        </h2>
        <p className="mt-2 max-w-[640px] text-[14.5px] leading-[1.7] text-neutral-600">
          {t("supportBody")}
        </p>
      </section>
    </main>
  );
}
