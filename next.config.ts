import type { NextConfig } from "next";

// Optional sub-folder deployment, e.g. NEXT_PUBLIC_BASE_PATH=/etijah for http://host/etijah/
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** Headers for pages that must never be indexed, cached by shared caches, or leak their URL. */
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "private, no-store" },
  // Quote links carry a secret token: never send it to hotel sites in the Referer header.
  { key: "Referrer-Policy", value: "no-referrer" },
];

/** Files the PDF routes read at runtime (serverless Chromium and the footer's Arabic font). */
// playwright-core also reads files of its own at runtime (browsers.json, …), so ship the package whole.
const pdfRuntimeFiles = ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**", "./assets/fonts/**"];

const nextConfig: NextConfig = {
  // Deployed on Vercel (Node.js functions): the travel programs, staff portal, B2B quotes and PDF
  // generator need MongoDB Atlas and server-side logic. Marketing pages stay prerendered.
  // `/en/` keeps its trailing slash, matching the URLs of the previous static site.
  trailingSlash: true,
  basePath,
  poweredByHeader: false,
  reactStrictMode: true,
  // Native / browser-driving packages are loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["sharp", "playwright-core", "@sparticuz/chromium"],
  // The PDF routes unpack Chromium from @sparticuz/chromium/bin at runtime and add an Arabic font
  // for the page footer; neither is imported statically, so ship them with those routes only.
  outputFileTracingIncludes: {
    "/**/pdf": pdfRuntimeFiles,
    "/**/reports/export": pdfRuntimeFiles,
  },
  experimental: {
    // Arabic (/) and English (/en) use separate root layouts, so the 404 page is global.
    globalNotFound: true,
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // Program and quote editors post structured JSON (images upload separately).
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      { source: "/staff/:path*", headers: privateHeaders },
      { source: "/staff", headers: privateHeaders },
      { source: "/q/:path*", headers: privateHeaders },
      { source: "/api/staff/:path*", headers: privateHeaders },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
