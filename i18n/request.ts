import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Locale strategy: cookie-based, no /ar-/en URL prefixes (see CLAUDE.md).
// Arabic is the default for first-time visitors — the customer base is
// Egyptian; the header's LocaleSwitcher writes this cookie to change it.
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get("NEXT_LOCALE")?.value === "en" ? "en" : "ar";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
