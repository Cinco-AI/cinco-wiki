import sanitizeHtml from "sanitize-html";

/**
 * Assainit le HTML rich-text produit par TipTap (§6.3).
 * Autorise le formatage attendu, bloque scripts / styles dangereux (XSS).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "code", "pre",
    "blockquote", "ul", "ol", "li", "a", "span", "mark", "div",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    div: ["data-link-summary"],
    p: ["data-link-summary"],
    span: ["style"],
    mark: ["style"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    "*": ["data-type", "data-checked"], // checklist TipTap
  },
  allowedStyles: {
    "*": {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i],
      "background-color": [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i],
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** Texte brut dérivé du HTML (extrait de card côté API). */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
