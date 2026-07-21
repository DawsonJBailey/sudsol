/** @type {import('next').NextConfig} */
const nextConfig = {
  // The pest-identification API routes read reference photos from
  // public/pest-examples/ at runtime; make sure those files are traced into
  // the route bundles so they're present under a standalone/serverless build.
  outputFileTracingIncludes: {
    "/api/identify-pest": ["./public/pest-examples/**"],
    "/api/lawn-assistant": ["./public/pest-examples/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
};

module.exports = nextConfig;
