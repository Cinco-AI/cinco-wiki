import { htmlToText } from "./sanitize.js";

/** Préfixe résumé + corps TipTap dans contentText. */
export function composeContentText(bodyText: string, summaryPrefix?: string): string {
  const body = bodyText.trim();
  const prefix = summaryPrefix?.trim();
  if (!prefix) return body;
  if (!body) return prefix;
  return `${prefix}\n\n${body}`;
}

/**
 * Conserve le préfixe (résumé de lien) lors d'une mise à jour du corps,
 * sans champ séparé en base.
 */
export function preserveContentTextPrefix(
  existingContentText: string,
  oldContentHtml: string,
  newBodyText: string,
): string {
  const oldBodyText = htmlToText(oldContentHtml);
  if (
    oldBodyText &&
    existingContentText.endsWith(oldBodyText) &&
    existingContentText.length > oldBodyText.length
  ) {
    const prefix = existingContentText
      .slice(0, existingContentText.length - oldBodyText.length)
      .replace(/\n\n$/, "");
    return composeContentText(newBodyText, prefix);
  }
  return newBodyText;
}
