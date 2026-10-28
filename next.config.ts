import type { NextConfig } from "next";

// Optional sub-folder deployment, e.g. NEXT_PUBLIC_BASE_PATH=/etijah for http://host/etijah/
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // Fully static site: `next build` emits plain HTML/CSS/JS in `out/`, which any
  // static host (Apache/XAMPP, Nginx, Vercel, Netlify…) can serve.
  output: "export",
  // `/en/` → `out/en/index.html`, so Apache serves routes without rewrite rules.
  trailingSlash: true,
  basePath,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Arabic (/) and English (/en) use separate root layouts, so the 404 page is global.
    globalNotFound: true,
    optimizePackageImports: ["lucide-react"],
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
