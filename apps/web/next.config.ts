import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nauka/shared", "@nauka/content", "@nauka/ai"],
  serverExternalPackages: ["@anthropic-ai/sdk"],
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
