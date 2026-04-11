import express from "express";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import db from "../db.ts";
import { fetchBookmarkData } from "../services/scraper.ts";
import { getConfig } from "../config.ts";
import {
  sendJson,
  sendError,
  notFound,
  badRequest,
  getBookmarksWithRelations,
  getBookmarkWithRelations,
  softDeleteBookmark,
  bulkSoftDeleteBookmarks,
  validateCollectionIds,
  buildFilteredBookmarksQuery,
} from "../utils/api.ts";

const router = express.Router();

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

router.post("/bookmarks/bulk-delete", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return badRequest(res, "Invalid or empty ids array");
  bulkSoftDeleteBookmarks(ids);
  sendJson(res, { success: true });
});

export { createBookmark };
export default router;
