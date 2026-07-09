import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/about" },
  };
}

const SECTION_KEYS = [
  { title: "missionTitle", body: "missionBody" },
  { title: "qualityTitle", body: "qualityBody" },
  { title: "deliveryTitle", body: "deliveryBody" },
] as const;

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-7 px-4 py-6 md:px-6 md:py-10">
      <div>
        <h1 className="m-0 font-headline text-[28px] font-extrabold tracking-tight text-neutral-900 md:text-[34px]">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] leading-[1.7] text-neutral-600">{t("intro")}</p>
      </div>

      {SECTION_KEYS.map((section) => (
        <section key={section.title}>
          <h2 className="m-0 font-headline text-lg font-bold text-neutral-900 md:text-xl">
            {t(section.title)}
          </h2>
          <p className="mt-2 max-w-[640px] text-[14.5px] leading-[1.7] text-neutral-600">
            {t(section.body)}
          </p>
        </section>
      ))}
    </main>
  );
}
