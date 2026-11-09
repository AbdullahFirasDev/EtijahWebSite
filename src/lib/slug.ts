// URL slugs: lowercase Latin, digits and hyphens. Arabic titles fall back to the English
// title, then to a short code, so URLs stay readable and safe everywhere.
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const isSlug = (v: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 80;
