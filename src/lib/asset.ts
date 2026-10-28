// Prefixes public-folder paths with the optional sub-folder base path (see next.config.ts).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${basePath}${path}`;
