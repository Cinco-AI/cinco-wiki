import { Hono } from "hono";
import * as cheerio from "cheerio";
import { z } from "zod";
import type { LinkPreview } from "@cinco-wiki/shared";
import { type AppEnv } from "../lib/http.js";

export const ogRoutes = new Hono<AppEnv>();

const querySchema = z.object({ url: z.string().url() });

// GET /og?url= — aperçu Open Graph d'une URL (requireAuth global, cf. index.ts).
ogRoutes.get("/", async (c) => {
  const { url } = querySchema.parse({ url: c.req.query("url") });
  return c.json(await fetchOgPreview(url));
});

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 512 * 1024; // on ne parse que le début du document.
const USER_AGENT =
  "Mozilla/5.0 (compatible; CincoWikiBot/1.0; +https://cinco.ai)";

/** hostname d'une URL, ou null si non parsable. */
function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/** Résout une URL d'image potentiellement relative en absolue. */
function absolutize(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

/** Premier contenu non vide parmi des balises meta (property puis name). */
function metaContent($: cheerio.CheerioAPI, ...keys: string[]): string | null {
  for (const key of keys) {
    const v =
      $(`meta[property="${key}"]`).attr("content") ??
      $(`meta[name="${key}"]`).attr("content");
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Récupère et parse les métadonnées Open Graph d'une URL.
 * Tolérant aux erreurs : en cas d'échec (réseau, timeout, contenu non HTML),
 * renvoie un aperçu aux champs null mais conserve url + domain.
 * Réutilisé par notes.ts pour résoudre les `links` en `LinkPreview[]`.
 */
export async function fetchOgPreview(url: string): Promise<LinkPreview> {
  const empty: LinkPreview = {
    url,
    title: null,
    description: null,
    image: null,
    domain: safeDomain(url),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
    if (!res.ok) return empty;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return empty;

    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    const $ = cheerio.load(html);

    const title =
      metaContent($, "og:title", "twitter:title") ||
      $("title").first().text().trim() ||
      null;
    const description = metaContent(
      $,
      "og:description",
      "twitter:description",
      "description",
    );
    const image = absolutize(
      metaContent($, "og:image", "og:image:url", "twitter:image"),
      res.url || url,
    );

    return { url, title, description, image, domain: safeDomain(url) };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
