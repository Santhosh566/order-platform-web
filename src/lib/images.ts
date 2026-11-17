/**
 * Product photos are served by the backend from MinIO. A key looks like
 * "products/PEN-01/9f2c…-400.jpg": each part is encoded, the slashes stay.
 */
export function imageUrl(key: string | null | undefined): string | null {
  if (!key) return null
  return '/api/public/images/' + key.split('/').map(encodeURIComponent).join('/')
}

/** Paragraphs of a plain-text description: separated by blank lines; single line breaks are kept inside. */
export function paragraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Categories flattened for a select: main ones, then their sub-categories indented under them. */
export function categoryOptions(
  tree: ReadonlyArray<{ id: number; name: string; active: boolean; children: ReadonlyArray<{ id: number; name: string; active: boolean }> }>,
): Array<{ value: string; label: string }> {
  return tree.flatMap((main) => [
    { value: String(main.id), label: main.name + (main.active ? '' : ' (off)') },
    ...main.children.map((sub) => ({
      value: String(sub.id),
      label: `${main.name} › ${sub.name}` + (sub.active ? '' : ' (off)'),
    })),
  ])
}
