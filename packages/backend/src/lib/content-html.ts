import { sanitizeContent } from "./sanitize.js";

const LINK_SUMMARY_MARKER = 'data-link-summary="true"';
const LINK_SUMMARY_BLOCK_RE = new RegExp(
  `^<(?:div|p)\\s+${LINK_SUMMARY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>[\\s\\S]*?<\\/(?:div|p)>\\s*`,
  "i",
);

/** Enveloppe le HTML produit par l'agent (déjà formaté), après assainissement. */
function buildLinkSummaryHtml(summaryHtml: string): string {
  const inner = sanitizeContent(summaryHtml.trim());
  if (!inner) return "";
  return `<div ${LINK_SUMMARY_MARKER}>${inner}</div>`;
}

export function extractLinkSummaryHtml(html: string): {
  summaryHtml: string | null;
  bodyHtml: string;
} {
  const match = html.match(LINK_SUMMARY_BLOCK_RE);
  if (!match) return { summaryHtml: null, bodyHtml: html };
  return {
    summaryHtml: match[0].trim(),
    bodyHtml: html.slice(match[0].length),
  };
}

/** Préfixe résumé de lien (HTML agent) + corps TipTap dans contentHtml. */
export function composeContentHtml(bodyHtml: string, summaryHtml?: string): string {
  const body = bodyHtml.trim();
  const summaryBlock = summaryHtml ? buildLinkSummaryHtml(summaryHtml) : "";
  if (!summaryBlock) return body;
  if (!body) return summaryBlock;
  return `${summaryBlock}\n${body}`;
}

