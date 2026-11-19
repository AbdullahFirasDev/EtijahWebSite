import { readMediaFile } from "@/server/media";

/** Serves re-encoded uploads from Vercel Blob (file names are validated against a strict pattern). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const media = await readMediaFile(file);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(media.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(media.size),
      // File names are content-unique (UUID per upload), so they can be cached forever,
      // by browsers and by the Vercel CDN (the function runs once per file and region).
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
