import type { Metadata } from "next";
import { Public_Sans, Inter, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { CartProvider } from "@/lib/cart-context";
import ToastProvider from "@/components/ui/ToastProvider";
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
  display: "optional",
  preload: false,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "optional",
  preload: false,
});

// Arabic-capable font for the RTL locale — globals.css swaps the headline/
// body font variables to Cairo under html[dir="rtl"]. Only the arabic
// subset is preloaded (Arabic is the default locale); the latin subset
// loads on demand for Latin text.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  display: "optional",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: t("siteTitle"),
    description: t("siteDescription"),
    openGraph: {
      siteName: t("siteTitle"),
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${publicSans.variable} ${inter.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <CartProvider>
            <ToastProvider>{children}</ToastProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
