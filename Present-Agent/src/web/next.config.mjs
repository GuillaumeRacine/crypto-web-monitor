/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Restrict package import optimization to known-good packages to avoid
    // missing vendor-chunk issues with certain libs (e.g., @radix-ui/*).
    optimizePackageImports: [
      'lucide-react'
    ],
  },
};

export default nextConfig;

