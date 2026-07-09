import type { MetadataRoute } from "next";

// Hardcoded bilingual name: manifest.ts runs outside a request scope, so
// next-intl's getTranslations() would throw here. Arabic-first matches the
// default storefront locale.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "صيدلية الشبراوي — Elshabrawy Pharmacy",
    short_name: "صيدلية الشبراوي",
    description: "صيدلية أونلاين — مستحضرات تجميل وفيتامينات ومكملات غذائية توصلك بسرعة.",
    start_url: "/",
    display: "standalone",
    lang: "ar",
    dir: "rtl",
    theme_color: "#0F52FF",
    background_color: "#ffffff",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
