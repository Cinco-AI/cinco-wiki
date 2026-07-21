import { ObjectId } from "mongodb";

/**
 * Extract internal wiki note links from TipTap HTML.
 * Matches href="/&lt;24hex&gt;" or "/notes/&lt;id&gt;" style paths.
 */
export function extractInternalNoteLinks(html: string): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const hrefRe =
    /href=["'](?:https?:\/\/[^/"']+)?\/(?:notes\/)?([a-f0-9]{24})(?:\/)?["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    const id = match[1];
    if (id && ObjectId.isValid(id)) ids.add(id);
  }
  return [...ids];
}
