export type CatalogType = "note";

export type CatalogDocument = {
  pointId: string;
  type: CatalogType;
  text: string;
  payload: Record<string, unknown>;
};

export type SearchHit = {
  score: number;
  type: CatalogType;
  payload: Record<string, unknown>;
};

export type NoteSource = {
  id: string;
  title: string;
  contentHtml: string;
  tags: string[];
  authorId: string | null;
  authorName: string | null;
  avgRating: number;
  voteCount: number;
  commentCount: number;
  status: string;
  updatedAt: Date;
};
