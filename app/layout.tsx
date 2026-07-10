import type { Metadata } from "next";
import { Public_Sans, Inter, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getLocale, getTranslations } from "next-intl/server";
import { CartProvider } from "@/lib/cart-context";
import ToastProvider from "@/components/ui/ToastProvider";
import { getDeliverySettings } from "@/lib/queries";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// All three are variable fonts — omitting `weight` loads a single variable
// file per font instead of one file per weight (6+4+6 files → 3).
//
// Preload strategy: the default locale is Arabic, where globals.css swaps
// every font variable to Cairo — Public Sans/Inter are unused there, so
// preloading them would push ~80KiB of fonts into every first visit's
// critical path for nothing. They still load on demand (display: swap) for
// the English locale.
// display: "optional" everywhere: a late-arriving webfont never re-paints
// already-rendered text, so text LCP is recorded at first (fallback) paint
// instead of at font-swap time. With the size-adjusted fallback next/font
// generates, the visual difference is minimal, and repeat visits always get
// the webfont from cache.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap", // <--- Changed from optional
  preload: true, // <--- Changed from false to ensure fast delivery
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap", // <--- Changed from optional
  preload: true, // <--- Changed from false
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  display: "swap", // <--- Changed from optional
  preload: true, // Keep preloaded since Arabic is your default locale
});
export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([
    getTranslations("common"),
    getLocale(),
  ]);
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: t("siteTitle"),
      template: `%s | ${t("siteTitle")}`,
    },
    description: t("siteDescription"),
    applicationName: t("siteTitle"),
    openGraph: {
      siteName: t("siteTitle"),
      type: "website",
      locale: locale === "ar" ? "ar_EG" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, deliverySettings] = await Promise.all([getLocale(), getDeliverySettings()]);

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${publicSans.variable} ${inter.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <CartProvider deliverySettings={deliverySettings}>
            <ToastProvider>{children}</ToastProvider>
          </CartProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
