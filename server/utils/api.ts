import express from "express";
import db from "../db.js";

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

export function buildFilteredBookmarksQuery(
  collIds: string[],
  spaceId: string | undefined,
  tagId: string | undefined,
  domain: string | undefined
): { query: string; params: any[] } {
  let query = `SELECT b.*, c.name as category_name, c.color as category_color FROM bookmarks b 
               LEFT JOIN categories c ON b.category_id = c.id 
               WHERE b.is_deleted = 0`;
  const params: any[] = [];

  if (collIds.length > 0) {
    const placeholders = collIds.map(() => '?').join(',');
    query = `WITH RECURSIVE targetCollections AS 
             (SELECT id FROM collections WHERE id IN (${placeholders}) 
              UNION ALL SELECT c.id FROM collections c JOIN targetCollections tc ON c.parent_id = tc.id)
             ` + query + ` AND EXISTS 
             (SELECT 1 FROM bookmark_collections bc 
              WHERE bc.bookmark_id = b.id AND bc.collection_id IN (SELECT id FROM targetCollections))`;
    params.push(...collIds);
  }
  if (spaceId) {
    const spacePlaceholders = '?';
    query = `WITH RECURSIVE spaceCollections AS 
             (SELECT id FROM collections WHERE space_id = ${spacePlaceholders} 
              UNION ALL SELECT c.id FROM collections c JOIN spaceCollections sc ON c.parent_id = sc.id)
             ` + query + ` AND EXISTS 
             (SELECT 1 FROM bookmark_collections bc 
              WHERE bc.bookmark_id = b.id AND bc.collection_id IN (SELECT id FROM spaceCollections))`;
    params.push(String(spaceId));
  }
  if (tagId) { query += " AND b.id IN (SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ?)"; params.push(tagId); }
  if (domain) { query += " AND b.domain = ?"; params.push(domain); }
  query += " ORDER BY b.created_at DESC";

  return { query, params };
}
