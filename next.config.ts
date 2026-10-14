import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dealer directory is read from disk by the search route.
  outputFileTracingIncludes: { "/api/dealers": ["./data/tx-dealers.json"] },
};

export default nextConfig;
