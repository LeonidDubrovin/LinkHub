import express from "express";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { getDb } from "../db.ts";
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
  buildPaginatedBookmarksQuery,
} from "../utils/api.ts";

const router = express.Router();
const categorizer = new CategorizationService();

async function createBookmark(url: string, options: { collectionIds?: string[] } = {}) {
  try { new URL(url); } catch (e) {
    return { id: null, title: url, success: false, error: "Invalid URL format" };
  }
  const db = await getDb();
  const existing = (await db.get("SELECT id, title, is_deleted FROM bookmarks WHERE url = ?", url)) as any;
  if (existing) {
    if (existing.is_deleted === 1) {
      const collectionIds = options.collectionIds && options.collectionIds.length > 0 ? options.collectionIds : ['inbox-collection'];
      await db.run("BEGIN TRANSACTION");
      try {
        await db.run("UPDATE bookmarks SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", existing.id);
        for (const colId of collectionIds) {
          await db.run(
            "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
            existing.id,
            colId
          );
        }
        await db.run("COMMIT");
      } catch (e) {
        await db.run("ROLLBACK").catch(() => {});
        throw e;
      }
      return { id: existing.id, title: existing.title, success: true, exists: true, restored: true, error: "Bookmark restored from trash" };
    }
    return { id: existing.id, title: existing.title, success: false, exists: true, error: "Bookmark already exists" };
  }

  let collectionIds = options.collectionIds && options.collectionIds.length > 0 ? options.collectionIds : ['inbox-collection'];
  if (collectionIds.length > 0) {
    const placeholders = collectionIds.map(() => '?').join(',');
    const existingCollections = (await db.all(`SELECT id FROM collections WHERE id IN (${placeholders})`, ...collectionIds)) as any[];
    if (existingCollections.length !== collectionIds.length) return { id: null, title: url, success: false, error: "One or more collections not found" };
  }

  const bookmarkId = uuidv4();
  let domain = "";
  try { domain = new URL(url).hostname; } catch (e) {}

  await db.run("BEGIN TRANSACTION");
  try {
    await db.run("INSERT INTO bookmarks (id, url, title, domain) VALUES (?, ?, ?, ?)", bookmarkId, url, url, domain);
    for (const colId of collectionIds) {
      await db.run(
        "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
        bookmarkId,
        colId
      );
    }
    await db.run("COMMIT");
  } catch (e) {
    await db.run("ROLLBACK").catch(() => {});
    throw e;
  }

  const config = getConfig();
  if (config.localHeuristics?.enabled || (config.llm?.enabled && config.llm?.autoCategorizeOnAdd)) {
    categorizer.categorizeBookmark(bookmarkId, false).catch((e: any) => {
      console.warn(`Auto-categorization failed for ${bookmarkId}:`, e.message);
    });
  }

  return { id: bookmarkId, title: url, success: true, needsRefresh: true, collectionIds };
}

router.get("/domains", async (req, res) => {
  try {
    const db = await getDb();
    const domains = await db.all(`
      SELECT domain, COUNT(*) as count FROM bookmarks WHERE is_deleted = 0 AND domain IS NOT NULL GROUP BY domain ORDER BY count DESC
    `);
    res.json(domains);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.get("/bookmarks", async (req, res) => {
  try {
    const { collectionIds, spaceId, categoryId, tagId, domain, page, limit, q, sort, filter } = req.query;
    let collIds: string[] = [];
    if (collectionIds) collIds = String(collectionIds).split(',').filter(Boolean);
    else if (categoryId) collIds = [String(categoryId)];

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    const { dataQuery, countQuery, params, countParams } = buildPaginatedBookmarksQuery(
      collIds,
      spaceId as string | undefined,
      tagId as string | undefined,
      domain as string | undefined,
      q as string | undefined,
      filter as string | undefined,
      sort as string | undefined,
      limitNum,
      offset
    );

    const db = await getDb();
    const bookmarks = await getBookmarksWithRelations(dataQuery, params);
    const countResult = (await db.get(countQuery, ...countParams)) as { total: number } | undefined;

    res.json({
      data: bookmarks,
      total: countResult?.total ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.get("/bookmarks/:id", async (req, res) => {
  const { id } = req.params;
  const bookmark = await getBookmarkWithRelations(id);
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
  try {
    const db = await getDb();
    const bookmark = (await db.get("SELECT url FROM bookmarks WHERE id = ?", req.params.id)) as any;
    if (!bookmark) return res.status(404).json({ error: "Not found" });
    const config = getConfig();
    const userAgent = config.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const response = await fetch(bookmark.url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(30000),
    });
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
    const db = await getDb();
    const bookmark = (await db.get("SELECT * FROM bookmarks WHERE id = ?", id)) as any;
    if (!bookmark) return res.status(404).json({ error: "Bookmark not found" });
    const data = await fetchBookmarkData(bookmark.url);
    const finalTitle = data.title || bookmark.title;
    const finalDescription = data.description || bookmark.description;
    const finalCoverImageUrl = data.cover_image_url || bookmark.cover_image_url;
    const finalContentText = data.content_text || bookmark.content_text;
    const finalDomain = data.domain || bookmark.domain;
    let finalImagesJson = data.images_json;
    if ((!data.images_json || data.images_json === "[]") && bookmark.images_json) finalImagesJson = bookmark.images_json;

    await db.run(
      `UPDATE bookmarks SET title = ?, description = ?, cover_image_url = ?, content_text = ?, domain = ?, images_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      finalTitle, finalDescription, finalCoverImageUrl, finalContentText, finalDomain, finalImagesJson, id
    );

    for (const tagName of data.suggestedTags) {
      let tag = (await db.get("SELECT id FROM tags WHERE name = ?", tagName)) as any;
      let tagId: string;
      if (!tag) {
        tagId = uuidv4();
        try {
          await db.run("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)", tagId, tagName);
          tag = (await db.get("SELECT id FROM tags WHERE name = ?", tagName)) as any;
          if (tag) tagId = tag.id;
        } catch (e) {
          tag = (await db.get("SELECT id FROM tags WHERE name = ?", tagName)) as any;
          if (tag) tagId = tag.id;
        }
      } else { tagId = tag.id; }
      await db.run("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)", id, tagId);
    }

    const config = getConfig();
    if (config.llm?.enabled && config.llm?.autoCategorizeOnAdd) {
      categorizer.categorizeBookmark(id, true).catch((e: any) => {
        console.warn(`Auto-categorization failed for ${id}:`, e.message);
      });
    }

    res.json({ success: true, bookmark: { id, ...data } });
  } catch (error: any) {
    console.error("Error refreshing bookmark:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/bookmarks/:id", async (req, res) => {
  const { id } = req.params;
  await softDeleteBookmark(id);
  sendJson(res, { success: true });
});

router.get("/trash", async (req, res) => {
  try {
    const { page, limit, q, sort } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    let where = "WHERE b.is_deleted = 1";
    const params: any[] = [];

    if (q && String(q).trim()) {
      where += " AND (b.title LIKE ? OR b.description LIKE ? OR b.url LIKE ?)";
      const pattern = `%${String(q).trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    let orderBy = " ORDER BY b.updated_at DESC";
    switch (sort) {
      case "date_asc": orderBy = " ORDER BY b.updated_at ASC"; break;
      case "title_asc": orderBy = " ORDER BY b.title ASC, b.url ASC"; break;
      case "title_desc": orderBy = " ORDER BY b.title DESC, b.url DESC"; break;
      case "domain_asc": orderBy = " ORDER BY b.domain ASC"; break;
      case "domain_desc": orderBy = " ORDER BY b.domain DESC"; break;
    }

    const dataQuery = `SELECT b.* FROM bookmarks b ${where}${orderBy} LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as total FROM bookmarks b ${where}`;

    const db = await getDb();
    const bookmarks = (await db.all(dataQuery, ...params, limitNum, offset)) as any[];
    const countResult = (await db.get(countQuery, ...params)) as { total: number } | undefined;
    const bookmarkIds = bookmarks.map(b => b.id);

    let tagsByBookmarkId: Record<string, any[]> = {};
    let collectionsByBookmarkId: Record<string, any[]> = {};
    if (bookmarkIds.length > 0) {
      const chunkSize = 500;
      const allTags: any[] = [];
      const allCollections: any[] = [];
      for (let i = 0; i < bookmarkIds.length; i += chunkSize) {
        const chunk = bookmarkIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        allTags.push(...(await db.all(`
          SELECT bt.bookmark_id, t.* FROM tags t
          JOIN bookmark_tags bt ON t.id = bt.tag_id
          WHERE bt.bookmark_id IN (${placeholders})
        `, ...chunk)) as any[]);
        allCollections.push(...(await db.all(`
          SELECT bc.bookmark_id, col.* FROM bookmark_collections bc
          JOIN collections col ON bc.collection_id = col.id
          WHERE bc.bookmark_id IN (${placeholders})
        `, ...chunk)) as any[]);
      }

      tagsByBookmarkId = allTags.reduce((acc: any, row: any) => {
        if (!acc[row.bookmark_id]) acc[row.bookmark_id] = [];
        const { bookmark_id, ...tag } = row;
        acc[row.bookmark_id].push(tag);
        return acc;
      }, {} as Record<string, any[]>);

      collectionsByBookmarkId = allCollections.reduce((acc: any, row: any) => {
        if (!acc[row.bookmark_id]) acc[row.bookmark_id] = [];
        const { bookmark_id, ...coll } = row;
        acc[row.bookmark_id].push(coll);
        return acc;
      }, {} as Record<string, any[]>);
    }

    res.json({
      data: bookmarks.map(b => ({
        ...b,
        tags: tagsByBookmarkId[b.id] || [],
        collections: collectionsByBookmarkId[b.id] || []
      })),
      total: countResult?.total ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/trash/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const bookmark = (await db.get("SELECT * FROM bookmarks WHERE id = ?", id)) as any;
    if (!bookmark) return notFound(res, "Bookmark not found");

    if (bookmark.is_deleted === 1) {
      await db.run("UPDATE bookmarks SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
    }

    const hasCollections = (await db.get("SELECT 1 FROM bookmark_collections WHERE bookmark_id = ? LIMIT 1", id)) as any;
    if (!hasCollections) {
      await db.run("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)", id, 'inbox-collection');
    }

    const restored = await getBookmarkWithRelations(id);
    sendJson(res, restored);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/trash/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("DELETE FROM bookmark_collections WHERE bookmark_id = ?", id);
      await db.run("DELETE FROM bookmark_tags WHERE bookmark_id = ?", id);
      await db.run("DELETE FROM bookmarks WHERE id = ? AND is_deleted = 1", id);
      await db.run("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)");
      await db.run("COMMIT");
    } catch (e) {
      await db.run("ROLLBACK").catch(() => {});
      throw e;
    }
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/bulk-delete", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return badRequest(res, "Invalid or empty ids array");
  await bulkSoftDeleteBookmarks(ids);
  sendJson(res, { success: true });
});

export { createBookmark };
export default router;
