import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the "native" binary target is used at runtime on any given
  // deployment (Windows locally, rhel-openssl-3.0.x on Vercel). Drop the
  // *other* platforms' query-engine binaries from every route's bundle —
  // each engine binary is ~15-25MB and Next.js would otherwise trace them
  // in as well.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@prisma/engines/**",
      "node_modules/.prisma/client/libquery_engine-darwin*",
      "node_modules/.prisma/client/libquery_engine-debian*",
      "node_modules/@prisma/client/libquery_engine-darwin*",
      "node_modules/@prisma/client/libquery_engine-debian*",
    ],
  },
};

export default nextConfig;
