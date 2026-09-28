/** Node identity helpers shared by the preview, the YAML generator and the UI. */

export function deviceSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 31);
  return slug || "max7219-clock";
}

export function nodeId(name: string): string {
  return deviceSlug(name).replace(/-/g, "_");
}
