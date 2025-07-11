import { z } from "zod";

// バリデーションスキーマ
export const CreateBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  collection: z.number().optional(),
});

export const SearchBookmarksSchema = z.object({
  query: z.string(),
  tags: z.array(z.string()).optional(),
  page: z.number().min(0).optional(),
  perpage: z.number().min(1).max(50).optional(),
  sort: z
    .enum([
      "-created",
      "created",
      "-last_update",
      "last_update",
      "-title",
      "title",
      "-domain",
      "domain",
    ])
    .optional(),
  collection: z.number().optional(),
  word: z.boolean().optional(),
});

export const DeleteBookmarkSchema = z.object({
  id: z.number().int().positive(),
});

export const UpdateBookmarkSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  collection: z.number().optional(),
});

// Zodスキーマから型を生成
export type CreateBookmarkParams = z.infer<typeof CreateBookmarkSchema>;
export type SearchBookmarksParams = z.infer<typeof SearchBookmarksSchema>;
export type DeleteBookmarkParams = z.infer<typeof DeleteBookmarkSchema>;
export type UpdateBookmarkParams = z.infer<typeof UpdateBookmarkSchema>;

// APIレスポンスの型
export interface RaindropItem {
  _id: number;
  title: string;
  link: string;
  tags?: string[];
  created: string;
  lastUpdate: string;
}

export interface Collection {
  _id: number;
  title: string;
  count: number;
  created: string;
  parent?: { _id: number };
}

export interface SearchResponse {
  items: RaindropItem[];
  count: number;
}

export interface CollectionsResponse {
  items: Collection[];
}
