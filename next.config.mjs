import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig = {
  devIndicators: false,
  agentRules: false,
  output: "standalone",
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
};

export default withPayload(nextConfig);
