import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig = {
  devIndicators: false,
  agentRules: false,
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./supabase/prod-ca-2021.crt"],
  },
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ] },
    ];
  },
};

export default withPayload(nextConfig);
