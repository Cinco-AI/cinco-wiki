import type { NoteQuery, NoteSort } from "@cinco-wiki/shared";

const SORT_VALUES = new Set<NoteSort>(["recent", "oldest", "top_rated", "most_commented"]);

/** Parse les paramètres d'URL du tableau de bord en `NoteQuery`. */
export function parseNoteQueryFromSearchParams(sp: URLSearchParams): NoteQuery {
  const query: NoteQuery = {};

  const q = sp.get("q")?.trim();
  if (q) query.q = q;

  // `/?mine` ou `/?mine=true`
  if (sp.has("mine")) {
    const mine = sp.get("mine");
    if (mine === null || mine === "" || mine === "true") query.mine = true;
  }

  const tags = sp.getAll("tags").map((t) => t.trim()).filter(Boolean);
  if (tags.length) query.tags = tags;

  const authorId = sp.get("authorId")?.trim();
  if (authorId) query.authorId = authorId;

  const dateFrom = sp.get("dateFrom")?.trim();
  if (dateFrom) query.dateFrom = dateFrom;

  const dateTo = sp.get("dateTo")?.trim();
  if (dateTo) query.dateTo = dateTo;

  const sort = sp.get("sort");
  if (sort && SORT_VALUES.has(sort as NoteSort)) query.sort = sort as NoteSort;

  return query;
}

/** Sérialise les filtres (sans pagination) vers des paramètres d'URL. */
export function noteQueryToSearchParams(query: NoteQuery): URLSearchParams {
  const sp = new URLSearchParams();

  if (query.q) sp.set("q", query.q);
  if (query.mine) sp.set("mine", "true");
  query.tags?.forEach((tag) => sp.append("tags", tag));
  if (query.authorId) sp.set("authorId", query.authorId);
  if (query.dateFrom) sp.set("dateFrom", query.dateFrom);
  if (query.dateTo) sp.set("dateTo", query.dateTo);
  if (query.sort && query.sort !== "recent") sp.set("sort", query.sort);

  return sp;
}
