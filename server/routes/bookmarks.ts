import express from "express";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import db from "../db.ts";
import { fetchBookmarkData } from "../services/scraper.ts";
import { CategorizationService } from "../services/categorizer.ts";
import { getConfig } from "../config.ts";
import {
  sendJson,
  sendError,
  notFound,
  badRequest,
  internalError,
  getBookmarksWithRelations,
  getBookmarkWithRelations,
  softDeleteBookmark,
  bulkSoftDeleteBookmarks,
  validateCollectionIds,
  buildFilteredBookmarksQuery,
} from "../utils/api.ts";

const router = express.Router();
const categorizer = new CategorizationService();

async function createBookmark(url: string, options: { collectionIds?: string[] } = {}) {
  try { new URL(url); } catch (e) {
    return { id: null, title: url, success: false, error: "Invalid URL format" };
  }
  const existing = db.prepare("SELECT id, title FROM bookmarks WHERE url = ? AND is_deleted = 0").get(url) as any;
  if (existing) return { id: existing.id, title: existing.title, success: false, exists: true, error: "Bookmark already exists" };

  let collectionIds = options.collectionIds && options.collectionIds.length > 0 ? options.collectionIds : ['inbox-collection'];
  if (collectionIds.length > 0) {
    const placeholders = collectionIds.map(() => '?').join(',');
    const existingCollections = db.prepare(`SELECT id FROM collections WHERE id IN (${placeholders})`).all(...collectionIds) as any[];
    if (existingCollections.length !== collectionIds.length) return { id: null, title: url, success: false, error: "One or more collections not found" };
  }

  const bookmarkId = uuidv4();
  let domain = "";
  try { domain = new URL(url).hostname; } catch (e) {}

  db.transaction(() => {
    db.prepare("INSERT INTO bookmarks (id, url, title, domain) VALUES (?, ?, ?, ?)").run(bookmarkId, url, url, domain);
    db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionIds[0] || null, bookmarkId);
    const insertLink = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
    for (const colId of collectionIds) insertLink.run(bookmarkId, colId);
  })();

  const config = getConfig();
  if (config.localHeuristics?.enabled || (config.llm?.enabled && config.llm?.autoCategorizeOnAdd)) {
    categorizer.categorizeBookmark(bookmarkId, false).catch((e) => {
      console.warn(`Auto-categorization failed for ${bookmarkId}:`, e.message);
    });
  }

  return { id: bookmarkId, title: url, success: true, needsRefresh: true, collectionIds };
}

router.get("/domains", (req, res) => {
  res.json(db.prepare(`
    SELECT domain, COUNT(*) as count FROM bookmarks WHERE is_deleted = 0 AND domain IS NOT NULL GROUP BY domain ORDER BY count DESC
  `).all());
});

router.get("/bookmarks", (req, res) => {
  const { collectionIds, spaceId, categoryId, tagId, domain } = req.query;
  let collIds: string[] = [];
  if (collectionIds) collIds = String(collectionIds).split(',').filter(Boolean);
  else if (categoryId) collIds = [String(categoryId)];

  const { query, params } = buildFilteredBookmarksQuery(collIds, spaceId as string | undefined, tagId as string | undefined, domain as string | undefined);
  const bookmarks = getBookmarksWithRelations(query, params);
  res.json(bookmarks);
});

router.get("/bookmarks/:id", async (req, res) => {
  const { id } = req.params;
  const bookmark = getBookmarkWithRelations(id);
  if (!bookmark) return notFound(res, "Bookmark not found");
  res.json(bookmark);
});

router.post("/bookmarks", async (req, res) => {
  const { url, collectionIds } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    const result = await createBookmark(url, { collectionIds });
    if (!result.success && result.error === "Invalid URL format") return res.status(400).json({ error: "Invalid URL format" });
    res.json(result);
  } catch (error: any) {
    console.error("Error adding bookmark:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/bookmarks/bulk", async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: "URLs array is required" });
  const results = [];
  for (const url of urls) {
    try { results.push(await createBookmark(url)); }
    catch (error: any) { console.error(`Error adding bookmark ${url}:`, error); results.push({ url, error: error.message, success: false }); }
  }
  res.json({ results });
});

router.get("/bookmarks/:id/readability", async (req, res) => {
  const bookmark = db.prepare("SELECT url FROM bookmarks WHERE id = ?").get(req.params.id) as any;
  if (!bookmark) return res.status(404).json({ error: "Not found" });
  try {
    const config = getConfig();
    const userAgent = config.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const response = await fetch(bookmark.url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) return res.status(response.status).json({ error: `Failed to fetch content: ${response.statusText}` });
    const html = await response.text();
    const dom = new JSDOM(html, { url: bookmark.url });
    const article = new Readability(dom.window.document).parse();
    res.json(article);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/bookmarks/:id/refresh", async (req, res) => {
  const { id } = req.params;
  try {
    const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as any;
    if (!bookmark) return res.status(404).json({ error: "Bookmark not found" });
    const data = await fetchBookmarkData(bookmark.url);
    const finalTitle = data.title || bookmark.title;
    const finalDescription = data.description || bookmark.description;
    const finalCoverImageUrl = data.cover_image_url || bookmark.cover_image_url;
    const finalContentText = data.content_text || bookmark.content_text;
    const finalDomain = data.domain || bookmark.domain;
    const finalCategoryId = bookmark.category_id || data.category_id;
    let finalImagesJson = data.images_json;
    if ((!data.images_json || data.images_json === "[]") && bookmark.images_json) finalImagesJson = bookmark.images_json;

    db.prepare(`UPDATE bookmarks SET title = ?, description = ?, cover_image_url = ?, content_text = ?, category_id = ?, domain = ?, images_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      finalTitle, finalDescription, finalCoverImageUrl, finalContentText, finalCategoryId, finalDomain, finalImagesJson, id
    );

    for (const tagName of data.suggestedTags) {
      let tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
      let tagId;
      if (!tag) {
        tagId = uuidv4();
        try {
          db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(tagId, tagName);
          tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
          if (tag) tagId = tag.id;
        } catch (e) {
          tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
          if (tag) tagId = tag.id;
        }
      } else { tagId = tag.id; }
      db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)").run(id, tagId);
    }

    const config = getConfig();
    if (config.llm?.enabled && config.llm?.autoCategorizeOnAdd) {
      categorizer.categorizeBookmark(id, true).catch((e) => {
        console.warn(`Auto-categorization failed for ${id}:`, e.message);
      });
    }

    res.json({ success: true, bookmark: { id, ...data } });
  } catch (error: any) {
    console.error("Error refreshing bookmark:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/bookmarks/:id", (req, res) => {
  const { id } = req.params;
  softDeleteBookmark(id);
  sendJson(res, { success: true });
});

router.get("/trash", (req, res) => {
  try {
    const bookmarks = db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.is_deleted = 1
      ORDER BY b.updated_at DESC
    `).all() as any[];
    const bookmarkIds = bookmarks.map(b => b.id);
    if (bookmarkIds.length === 0) { res.json([]); return; }

    const chunkSize = 500;
    const allCollections: any[] = [];
    for (let i = 0; i < bookmarkIds.length; i += chunkSize) {
      const chunk = bookmarkIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      allCollections.push(...db.prepare(`
        SELECT bc.bookmark_id, col.* FROM bookmark_collections bc
        JOIN collections col ON bc.collection_id = col.id
        WHERE bc.bookmark_id IN (${placeholders})
      `).all(...chunk) as any[]);
    }

    const collectionsByBookmarkId = allCollections.reduce((acc: any, row: any) => {
      if (!acc[row.bookmark_id]) acc[row.bookmark_id] = [];
      const { bookmark_id, ...coll } = row;
      acc[row.bookmark_id].push(coll);
      return acc;
    }, {} as Record<string, any[]>);

    res.json(bookmarks.map(b => ({
      ...b,
      tags: [],
      collections: collectionsByBookmarkId[b.id] || []
    })));
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/trash/:id/restore", (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare("UPDATE bookmarks SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    if (result.changes === 0) return notFound(res, "Bookmark not found");
    const bookmark = getBookmarkWithRelations(id);
    sendJson(res, bookmark);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/trash/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);
    db.prepare("DELETE FROM bookmarks WHERE id = ? AND is_deleted = 1").run(id);
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/bulk-delete", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return badRequest(res, "Invalid or empty ids array");
  bulkSoftDeleteBookmarks(ids);
  sendJson(res, { success: true });
});

export { createBookmark };
export default router;
