import express from "express";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import db from "../db.js";
import { fetchBookmarkData } from "../services/scraper.js";

import { categorizeWithAI } from "../services/ai.js";

const router = express.Router();

router.get("/categories", (req, res) => {
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.json(categories);
});

router.get("/tags", (req, res) => {
  const tags = db.prepare("SELECT * FROM tags ORDER BY name").all();
  res.json(tags);
});

router.get("/domains", (req, res) => {
  const domains = db.prepare(`
    SELECT domain, COUNT(*) as count 
    FROM bookmarks 
    WHERE is_deleted = 0 AND domain IS NOT NULL 
    GROUP BY domain 
    ORDER BY count DESC
  `).all();
  res.json(domains);
});

router.get("/bookmarks", (req, res) => {
  const { categoryId, tagId, domain } = req.query;

  let query = `
    SELECT b.*, c.name as category_name, c.color as category_color 
    FROM bookmarks b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.is_deleted = 0
  `;
  const params: any[] = [];

  if (categoryId) {
    query += ` AND b.category_id IN (
      WITH RECURSIVE CategoryTree AS (
        SELECT id FROM categories WHERE id = ?
        UNION ALL
        SELECT c.id FROM categories c
        JOIN CategoryTree ct ON c.parent_id = ct.id
      )
      SELECT id FROM CategoryTree
    )`;
    params.push(categoryId);
  }

  if (tagId) {
    query +=
      " AND b.id IN (SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ?)";
    params.push(tagId);
  }

  if (domain) {
    query += " AND b.domain = ?";
    params.push(domain);
  }

  query += " ORDER BY b.created_at DESC";

  const bookmarks = db.prepare(query).all(...params) as any[];

  // Fetch tags for each bookmark
  const bookmarksWithTags = bookmarks.map((b) => {
    const tags = db
      .prepare(
        `
      SELECT t.* FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
    `
      )
      .all(b.id);
    return { ...b, tags };
  });

  res.json(bookmarksWithTags);
});

async function createBookmark(url: string) {
  // 0. Check if already exists
  const existing = db
    .prepare("SELECT id, title FROM bookmarks WHERE url = ? AND is_deleted = 0")
    .get(url) as any;

  if (existing) {
    return { id: existing.id, title: existing.title, success: false, exists: true, error: "Bookmark already exists" };
  }

  const data = await fetchBookmarkData(url);

  // 5. Save to DB
  const bookmarkId = uuidv4();
  const insertBookmark = db.prepare(`
    INSERT INTO bookmarks (id, url, title, description, cover_image_url, content_text, category_id, domain, images_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertBookmark.run(
    bookmarkId,
    url,
    data.title,
    data.description,
    data.cover_image_url,
    data.content_text,
    data.category_id,
    data.domain,
    data.images_json
  );

  // Save Tags
  for (const tagName of data.suggestedTags) {
    let tag = db
      .prepare("SELECT id FROM tags WHERE name = ?")
      .get(tagName) as any;
    let tagId;

    if (!tag) {
      tagId = uuidv4();
      db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(
        tagId,
        tagName
      );
    } else {
      tagId = tag.id;
    }

    db.prepare(
      "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
    ).run(bookmarkId, tagId);
  }

  return { id: bookmarkId, title: data.title, success: true };
}

router.post("/bookmarks", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const result = await createBookmark(url);
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
    try {
      const result = await createBookmark(url);
      results.push(result);
    } catch (error: any) {
      console.error(`Error adding bookmark ${url}:`, error);
      results.push({ url, error: error.message, success: false });
    }
  }

  res.json({ results });
});

router.get("/bookmarks/:id/readability", async (req, res) => {
  const bookmark = db
    .prepare("SELECT url FROM bookmarks WHERE id = ?")
    .get(req.params.id) as any;

  if (!bookmark) return res.status(404).json({ error: "Not found" });

  try {
    const response = await fetch(bookmark.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();
    const dom = new JSDOM(html, { url: bookmark.url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    res.json(article);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/bookmarks/:id/refresh", async (req, res) => {
  const { id } = req.params;

  try {
    const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as any;
    if (!bookmark) {
      return res.status(404).json({ error: "Bookmark not found" });
    }

    const data = await fetchBookmarkData(bookmark.url);

    const updateBookmark = db.prepare(`
      UPDATE bookmarks 
      SET title = ?, description = ?, cover_image_url = ?, content_text = ?, category_id = ?, domain = ?, images_json = ?
      WHERE id = ?
    `);

    updateBookmark.run(
      data.title,
      data.description,
      data.cover_image_url,
      data.content_text,
      data.category_id,
      data.domain,
      data.images_json,
      id
    );

    // Update tags
    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);

    for (const tagName of data.suggestedTags) {
      let tag = db
        .prepare("SELECT id FROM tags WHERE name = ?")
        .get(tagName) as any;
      let tagId;

      if (!tag) {
        tagId = uuidv4();
        db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(
          tagId,
          tagName
        );
      } else {
        tagId = tag.id;
      }

      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
      ).run(id, tagId);
    }

    res.json({ success: true, bookmark: { id, ...data } });
  } catch (error: any) {
    console.error("Error refreshing bookmark:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/bookmarks/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);
  db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
  
  // Clean up orphaned tags
  db.prepare(`
    DELETE FROM tags 
    WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)
  `).run();

  // Clean up orphaned categories (categories with no bookmarks and no child categories)
  db.prepare(`
    DELETE FROM categories
    WHERE id NOT IN (SELECT DISTINCT category_id FROM bookmarks WHERE category_id IS NOT NULL)
    AND id NOT IN (SELECT DISTINCT parent_id FROM categories WHERE parent_id IS NOT NULL)
  `).run();

  res.json({ success: true });
});

router.post("/bookmarks/bulk-delete", express.json(), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid or empty ids array" });
  }

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM bookmarks WHERE id IN (${placeholders})`).run(...ids);
  
  // Clean up orphaned tags
  db.prepare(`
    DELETE FROM tags 
    WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)
  `).run();

  // Clean up orphaned categories
  db.prepare(`
    DELETE FROM categories
    WHERE id NOT IN (SELECT DISTINCT category_id FROM bookmarks WHERE category_id IS NOT NULL)
    AND id NOT IN (SELECT DISTINCT parent_id FROM categories WHERE parent_id IS NOT NULL)
  `).run();

  res.json({ success: true });
});

export default router;
