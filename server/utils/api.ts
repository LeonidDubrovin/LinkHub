import express from "express";
import db from "../db.ts";

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  exists?: boolean;
  needsRefresh?: boolean;
  id?: string;
  title?: string;
}

export function sendJson(res: express.Response, data: any, status: number = 200) {
  res.status(status).json(data);
}

export function sendError(res: express.Response, message: string, status: number = 500) {
  console.error(`API Error [${status}]:`, message);
  res.status(status).json({ error: message });
}

export function notFound(res: express.Response, message: string = "Not found") {
  sendError(res, message, 404);
}

export function badRequest(res: express.Response, message: string = "Bad request") {
  sendError(res, message, 400);
}

export function internalError(res: express.Response, error: any) {
  console.error("Internal server error:", error);
  sendError(res, error.message || "Internal server error", 500);
}

export function getBookmarkWithRelations(id: string) {
  const bookmark = db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color 
    FROM bookmarks b 
    LEFT JOIN categories c ON b.category_id = c.id 
    WHERE b.id = ? AND b.is_deleted = 0
  `).get(id) as any;

  if (!bookmark) return null;

  const tags = db.prepare(`
    SELECT t.* FROM tags t 
    JOIN bookmark_tags bt ON t.id = bt.tag_id 
    WHERE bt.bookmark_id = ?
  `).all(id);

  const collections = db.prepare(`
    SELECT c.* FROM collections c 
    JOIN bookmark_collections bc ON c.id = bc.collection_id 
    WHERE bc.bookmark_id = ? ORDER BY c.name
  `).all(id);

  return { ...bookmark, tags, collections };
}

export function getBookmarksWithRelations(
  query: string, 
  params: any[] = []
): any[] {
  const bookmarks = db.prepare(query).all(...params) as any[];
  if (bookmarks.length === 0) return [];

  const bookmarkIds = bookmarks.map(b => b.id);
  const chunkSize = 500;
  const allTags: any[] = [];
  const allCollections: any[] = [];

  for (let i = 0; i < bookmarkIds.length; i += chunkSize) {
    const chunk = bookmarkIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    allTags.push(...db.prepare(`
      SELECT bt.bookmark_id, t.* FROM tags t 
      JOIN bookmark_tags bt ON t.id = bt.tag_id 
      WHERE bt.bookmark_id IN (${placeholders})
    `).all(...chunk) as any[]);
    allCollections.push(...db.prepare(`
      SELECT bc.bookmark_id, c.* FROM bookmark_collections bc 
      JOIN collections c ON bc.collection_id = c.id 
      WHERE bc.bookmark_id IN (${placeholders})
    `).all(...chunk) as any[]);
  }

  const tagsByBookmarkId = allTags.reduce((acc, tag) => {
    if (!acc[tag.bookmark_id]) acc[tag.bookmark_id] = [];
    const { bookmark_id, ...tagData } = tag;
    acc[tag.bookmark_id].push(tagData);
    return acc;
  }, {} as Record<string, any[]>);

  const collectionsByBookmarkId = allCollections.reduce((acc, row) => {
    if (!acc[row.bookmark_id]) acc[row.bookmark_id] = [];
    const { bookmark_id, ...coll } = row;
    acc[row.bookmark_id].push(coll);
    return acc;
  }, {} as Record<string, any[]>);

  return bookmarks.map(b => ({ 
    ...b, 
    tags: tagsByBookmarkId[b.id] || [], 
    collections: collectionsByBookmarkId[b.id] || [] 
  }));
}

export function softDeleteBookmark(id: string) {
  db.transaction(() => {
    db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);
    db.prepare("UPDATE bookmarks SET is_deleted = 1 WHERE id = ?").run(id);
    db.prepare("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)").run();
  })();
}

export function bulkSoftDeleteBookmarks(ids: string[]) {
  db.transaction(() => {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM bookmark_collections WHERE bookmark_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id IN (${placeholders})`).run(...ids);
    db.prepare(`UPDATE bookmarks SET is_deleted = 1 WHERE id IN (${placeholders})`).run(...ids);
    db.prepare("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)").run();
  })();
}

export function validateCollectionIds(collectionIds: string[]): boolean {
  if (collectionIds.length === 0) return true;
  const placeholders = collectionIds.map(() => '?').join(',');
  const existingCollections = db.prepare(`SELECT id FROM collections WHERE id IN (${placeholders})`).all(...collectionIds) as any[];
  return existingCollections.length === collectionIds.length;
}

export function buildPaginatedBookmarksQuery(
  collIds: string[],
  spaceId: string | undefined,
  tagId: string | undefined,
  domain: string | undefined,
  searchQuery: string | undefined,
  filterBy: string | undefined,
  sortBy: string | undefined,
  limit: number,
  offset: number
): { dataQuery: string; countQuery: string; params: any[]; countParams: any[] } {
  const ctes: string[] = [];
  let baseFrom = `FROM bookmarks b LEFT JOIN categories c ON b.category_id = c.id`;
  let where = `WHERE b.is_deleted = 0`;
  const params: any[] = [];

  if (collIds.length > 0) {
    const placeholders = collIds.map(() => '?').join(',');
    ctes.push(`targetCollections AS (
      SELECT id FROM collections WHERE id IN (${placeholders})
      UNION ALL SELECT c.id FROM collections c JOIN targetCollections tc ON c.parent_id = tc.id
    )`);
    params.push(...collIds);
    where += ` AND EXISTS (
      SELECT 1 FROM bookmark_collections bc
      WHERE bc.bookmark_id = b.id AND bc.collection_id IN (SELECT id FROM targetCollections)
    )`;
  }

  if (spaceId) {
    ctes.push(`spaceCollections AS (
      SELECT id FROM collections WHERE space_id = ?
      UNION ALL SELECT c.id FROM collections c JOIN spaceCollections sc ON c.parent_id = sc.id
    )`);
    params.push(String(spaceId));
    where += ` AND EXISTS (
      SELECT 1 FROM bookmark_collections bc
      WHERE bc.bookmark_id = b.id AND bc.collection_id IN (SELECT id FROM spaceCollections)
    )`;
  }

  if (tagId) { where += " AND b.id IN (SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ?)"; params.push(tagId); }
  if (domain) { where += " AND b.domain = ?"; params.push(domain); }

  if (searchQuery && searchQuery.trim()) {
    where += " AND (b.title LIKE ? OR b.description LIKE ? OR b.url LIKE ?)";
    const pattern = `%${searchQuery.trim()}%`;
    params.push(pattern, pattern, pattern);
  }

  if (filterBy === "has_images") {
    where += " AND b.images_json IS NOT NULL AND b.images_json != '[]' AND b.images_json != ''";
  } else if (filterBy === "has_summary") {
    where += " AND b.description IS NOT NULL AND length(b.description) > 0";
  } else if (filterBy === "has_content") {
    where += " AND b.content_text IS NOT NULL AND length(b.content_text) > 0";
  }

  let orderBy = " ORDER BY b.created_at DESC";
  switch (sortBy) {
    case "date_asc": orderBy = " ORDER BY b.created_at ASC"; break;
    case "title_asc": orderBy = " ORDER BY b.title ASC, b.url ASC"; break;
    case "title_desc": orderBy = " ORDER BY b.title DESC, b.url DESC"; break;
    case "domain_asc": orderBy = " ORDER BY b.domain ASC"; break;
    case "domain_desc": orderBy = " ORDER BY b.domain DESC"; break;
  }

  const ctePrefix = ctes.length > 0 ? `WITH RECURSIVE ${ctes.join(", ")} ` : "";
  const dataQuery = `${ctePrefix}SELECT b.*, c.name as category_name, c.color as category_color ${baseFrom} ${where}${orderBy} LIMIT ? OFFSET ?`;
  const countQuery = `${ctePrefix}SELECT COUNT(*) as total ${baseFrom} ${where}`;

  const countParams = [...params];
  params.push(limit, offset);

  return { dataQuery, countQuery, params, countParams };
}
