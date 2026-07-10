import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/terms" },
  };
}

// Order matches how a customer would encounter these questions: who we are,
// who can buy, medical/product caveats, the commercial terms (price, order,
// payment, delivery, returns), then site-usage/legal boilerplate last.
const SECTION_KEYS = [
  { title: "aboutTitle", body: "aboutBody" },
  { title: "eligibilityTitle", body: "eligibilityBody" },
  { title: "medicalDisclaimerTitle", body: "medicalDisclaimerBody" },
  { title: "productInfoTitle", body: "productInfoBody" },
  { title: "pricingTitle", body: "pricingBody" },
  { title: "ordersTitle", body: "ordersBody" },
  { title: "paymentTitle", body: "paymentBody" },
  { title: "deliveryTitle", body: "deliveryBody" },
  { title: "returnsTitle", body: "returnsBody" },
  { title: "recallsTitle", body: "recallsBody" },
  { title: "reviewsTitle", body: "reviewsBody" },
  { title: "accountTitle", body: "accountBody" },
  { title: "prohibitedTitle", body: "prohibitedBody" },
  { title: "ipTitle", body: "ipBody" },
  { title: "liabilityTitle", body: "liabilityBody" },
  { title: "changesTitle", body: "changesBody" },
  { title: "lawTitle", body: "lawBody" },
  { title: "contactTitle", body: "contactBody" },
] as const;

export default async function TermsPage() {
  const t = await getTranslations("terms");

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      <div>
        <h1 className="m-0 font-headline text-[28px] font-extrabold tracking-tight text-neutral-900 md:text-[34px]">
          {t("title")}
        </h1>
        <p className="mt-2 text-[13px] text-neutral-400">{t("lastUpdated")}</p>
        <p className="mt-3 max-w-[680px] text-[15px] leading-[1.7] text-neutral-600">{t("intro")}</p>
      </div>

      {SECTION_KEYS.map((section) => (
        <section key={section.title}>
          <h2 className="m-0 font-headline text-base font-bold text-neutral-900 md:text-lg">
            {t(section.title)}
          </h2>
          <p className="mt-2 max-w-[680px] text-[14px] leading-[1.7] text-neutral-600">
            {t(section.body)}
          </p>
        </section>
      ))}
    </main>
  );
}
