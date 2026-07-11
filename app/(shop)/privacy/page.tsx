import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/privacy" },
  };
}

// Order: what we collect (incl. the GPS "use my location" flow specifically,
// since that's the one non-obvious data flow customers should know about)
// -> how it's used -> the specific third-party touchpoints (cookies,
// analytics, sharing) -> customer-facing rights/consequences last.
const SECTION_KEYS = [
  { title: "infoCollectTitle", body: "infoCollectBody" },
  { title: "locationTitle", body: "locationBody" },
  { title: "howWeUseTitle", body: "howWeUseBody" },
  { title: "paymentDataTitle", body: "paymentDataBody" },
  { title: "cookiesTitle", body: "cookiesBody" },
  { title: "analyticsTitle", body: "analyticsBody" },
  { title: "sharingTitle", body: "sharingBody" },
  { title: "reviewsTitle", body: "reviewsBody" },
  { title: "retentionTitle", body: "retentionBody" },
  { title: "yourRightsTitle", body: "yourRightsBody" },
  { title: "childrenTitle", body: "childrenBody" },
  { title: "securityTitle", body: "securityBody" },
  { title: "changesTitle", body: "changesBody" },
  { title: "lawTitle", body: "lawBody" },
  { title: "contactTitle", body: "contactBody" },
] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

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
