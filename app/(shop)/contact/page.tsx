import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Button from "@/components/ui/Button";

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
