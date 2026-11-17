import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // NPM forwards Host without the external :8443 port, so the Origin
      // header (`https://sechub.cloud.piradata.dev:8443`) would otherwise be
      // rejected as a Server Actions CSRF mismatch.
      allowedOrigins: [
        "sechub.cloud.piradata.dev:8443",
        "sechub.cloud.piradata.dev",
        "sechub.local.piradata.dev",
      ],
    },
  },
};

export default nextConfig;
