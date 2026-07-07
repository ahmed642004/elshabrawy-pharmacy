import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

// Defaults to ./i18n/request.ts for the per-request locale/messages config.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
