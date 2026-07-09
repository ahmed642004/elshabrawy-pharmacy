import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gjwkuhbhhueoxkmhoyrm.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Defaults to ./i18n/request.ts for the per-request locale/messages config.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
