import express from "express";
import { v4 as uuidv4 } from "uuid";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import db, { getDataDir } from "../db.js";
import { fetchBookmarkData } from "../services/scraper.js";
import { getConfig, saveConfig } from "../config.js";
import { CategorizationService } from "../services/categorizer.js";
import fs from "fs";
import path from "path";

import { categorizeWithAI } from "../services/ai.js";

const router = express.Router();
const categorizer = new CategorizationService();

router.get("/settings", (req, res) => {
  const config = getConfig();
  res.json({
    dataDir: getDataDir(),
    userAgent: config.userAgent || "Mozilla/5.0 (compatible; Twitterbot/1.0)",
    llm: {
      enabled: config.llm?.enabled ?? false,
      provider: config.llm?.provider ?? 'openrouter',
      apiKey: config.llm?.apiKey ?? '',
      model: config.llm?.model ?? 'stepfun/step-3.5-flash:free',
      autoCategorizeOnAdd: config.llm?.autoCategorizeOnAdd ?? true,
      fallbackToLocal: config.llm?.fallbackToLocal ?? true
    },
    localHeuristics: {
      enabled: config.localHeuristics?.enabled ?? true,
      domainCategoryRules: config.localHeuristics?.domainCategoryRules ?? {
        "youtube.com": "Videos",
        "youtu.be": "Videos",
        "github.com": "Programming",
        "npmjs.com": "Programming",
        "dribbble.com": "Design",
        "behance.com": "Design"
      }
    }
  });
});

router.post("/settings", (req, res) => {
  try {
    let { dataDir, userAgent, llm, localHeuristics } = req.body;
    if (!dataDir) return res.status(400).json({ error: "dataDir is required" });

    // Resolve to absolute path
    dataDir = path.resolve(dataDir);

    // Ensure the new directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to config
    const config = getConfig();
    config.dataDir = dataDir;
    if (userAgent !== undefined) config.userAgent = userAgent;
    if (llm !== undefined) config.llm = llm;
    if (localHeuristics !== undefined) config.localHeuristics = localHeuristics;
    saveConfig(config);

    // Note: To fully apply this, the app needs to be restarted.
    // We can copy the current database to the new location if it doesn't exist there.
    const currentDbPath = path.join(getDataDir(), "bookmarks.db");
    const newDbPath = path.join(dataDir, "bookmarks.db");

    if (fs.existsSync(currentDbPath) && !fs.existsSync(newDbPath)) {
      fs.copyFileSync(currentDbPath, newDbPath);
    }

    res.json({ success: true, message: "Settings saved. Please restart the application to fully apply changes." });
  } catch (error: any) {
    console.error("Failed to save settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// LLM Test Connection
router.post("/llm/test-connection", async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: "API key required" });
    }

    if (provider === 'openrouter') {
      // Test OpenRouter connection by fetching models
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        res.json({ success: true, message: "Connected to OpenRouter successfully" });
      } else {
        const error = await response.text();
        res.status(400).json({ success: false, error: `OpenRouter error: ${error}` });
      }
    } else {
      res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Categorization stats
router.get("/categorization/stats", (req, res) => {
  try {
    const stats = categorizer.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Categorize a single bookmark
router.post("/bookmarks/:id/categorize", async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.body;
    
    const result = await categorizer.categorizeBookmark(id, force ?? false);
    
    if (result.success) {
      // Return updated bookmark
      const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as any;
      res.json({ success: true, bookmark });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Categorize all uncategorized bookmarks
router.post("/bookmarks/categorize-all", async (req, res) => {
  try {
    const { onlyUntagged = true } = req.body;
    const result = await categorizer.categorizeAll(onlyUntagged);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

  if (bookmarks.length === 0) {
    return res.json([]);
  }

  // Fetch tags for all bookmarks in chunks to avoid SQLite variable limits
  const bookmarkIds = bookmarks.map(b => b.id);
  const allTags: any[] = [];
  const chunkSize = 500;
  
  for (let i = 0; i < bookmarkIds.length; i += chunkSize) {
    const chunk = bookmarkIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const tagsQuery = `
      SELECT bt.bookmark_id, t.* 
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id IN (${placeholders})
    `;
    const chunkTags = db.prepare(tagsQuery).all(...chunk) as any[];
    allTags.push(...chunkTags);
  }

  // Group tags by bookmark_id
  const tagsByBookmarkId = allTags.reduce((acc, tag) => {
    if (!acc[tag.bookmark_id]) {
      acc[tag.bookmark_id] = [];
    }
    // Remove bookmark_id from the tag object before sending to client
    const { bookmark_id, ...tagData } = tag;
    acc[tag.bookmark_id].push(tagData);
    return acc;
  }, {} as Record<string, any[]>);

  const bookmarksWithTags = bookmarks.map((b) => ({
    ...b,
    tags: tagsByBookmarkId[b.id] || []
  }));

  res.json(bookmarksWithTags);
});

async function createBookmark(url: string) {
  try {
    new URL(url);
  } catch (e) {
    return { id: null, title: url, success: false, error: "Invalid URL format" };
  }

  // 0. Check if already exists
  const existing = db
    .prepare("SELECT id, title FROM bookmarks WHERE url = ? AND is_deleted = 0")
    .get(url) as any;

  if (existing) {
    return { id: existing.id, title: existing.title, success: false, exists: true, error: "Bookmark already exists" };
  }

  // Insert immediately with basic info
  const bookmarkId = uuidv4();
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch (e) {}

  const insertBookmark = db.prepare(`
    INSERT INTO bookmarks (id, url, title, domain)
    VALUES (?, ?, ?, ?)
  `);

  insertBookmark.run(bookmarkId, url, url, domain);

  return { id: bookmarkId, title: url, success: true, needsRefresh: true };
}

router.get("/bookmarks/:id", (req, res) => {
  const { id } = req.params;
  const bookmark = db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color 
    FROM bookmarks b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.id = ? AND b.is_deleted = 0
  `).get(id) as any;

  if (!bookmark) {
    return res.status(404).json({ error: "Bookmark not found" });
  }

  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `).all(id);

  res.json({ ...bookmark, tags });
});

router.post("/bookmarks", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const result = await createBookmark(url);
    if (!result.success && result.error === "Invalid URL format") {
      return res.status(400).json({ error: "Invalid URL format" });
    }
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
    const config = getConfig();
    const userAgent = config.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const response = await fetch(bookmark.url, {
      headers: {
        "User-Agent": userAgent,
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch content: ${response.statusText}` });
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url: bookmark.url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    res.json(article);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("URL is required");

  try {
    const config = getConfig();
    // Use Googlebot User-Agent to bypass Cloudflare/WAF challenges on many sites
    const userAgent = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    
    const headers: Record<string, string> = {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "X-Forwarded-For": "66.249.66.1", // Googlebot IP range
    };
    
    // Forward cookies from the client
    if (req.headers.cookie) {
      headers["Cookie"] = req.headers.cookie;
    }

    const response = await fetch(url, { headers });

    // Forward Set-Cookie headers back to the client
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) {
        res.setHeader("Set-Cookie", cookies);
      }
    } else {
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        res.setHeader("Set-Cookie", setCookie);
      }
    }

    const serverHeader = response.headers.get("server")?.toLowerCase() || "";
    const isCloudflare = serverHeader.includes("cloudflare");
    
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("text/html")) {
      // If it's not HTML, just redirect to the original URL or pipe it
      return res.redirect(url);
    }

    let html = await response.text();
    
    // Inject <base> tag so relative assets load correctly
    // Use response.url in case there was a redirect
    const finalUrl = response.url || url;
    
    // If it's a Cloudflare challenge, we don't inject the base tag because it breaks the Turnstile iframe origin checks.
    // Instead, the browser will request /cdn-cgi/ from our domain, and we will proxy it below.
    if (!isCloudflare || (response.status !== 403 && response.status !== 503)) {
      const baseTag = `<base href="${finalUrl}">`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
      } else {
        html = baseTag + "\n" + html;
      }
    }

    res.setHeader("Content-Type", "text/html");
    // Explicitly do not set X-Frame-Options or CSP
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`Failed to load page: ${error.message}`);
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

    // Preserve existing data if scrape fails to find it
    const finalTitle = data.title || bookmark.title;
    const finalDescription = data.description || bookmark.description;
    const finalCoverImageUrl = data.cover_image_url || bookmark.cover_image_url;
    const finalContentText = data.content_text || bookmark.content_text;
    const finalDomain = data.domain || bookmark.domain;
    const finalCategoryId = bookmark.category_id || data.category_id;
    
    // For images, if the new scrape found none, keep the old ones
    let finalImagesJson = data.images_json;
    if ((!data.images_json || data.images_json === "[]") && bookmark.images_json) {
      finalImagesJson = bookmark.images_json;
    }

    const updateBookmark = db.prepare(`
      UPDATE bookmarks 
      SET title = ?, description = ?, cover_image_url = ?, content_text = ?, category_id = ?, domain = ?, images_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateBookmark.run(
      finalTitle,
      finalDescription,
      finalCoverImageUrl,
      finalContentText,
      finalCategoryId,
      finalDomain,
      finalImagesJson,
      id
    );

    // Add new suggested tags without deleting existing ones
    for (const tagName of data.suggestedTags) {
      let tag = db
        .prepare("SELECT id FROM tags WHERE name = ?")
        .get(tagName) as any;
      let tagId;

      if (!tag) {
        tagId = uuidv4();
        try {
          db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(
            tagId,
            tagName
          );
          // Fetch again in case it was ignored
          tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
          if (tag) tagId = tag.id;
        } catch (e) {
          tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
          if (tag) tagId = tag.id;
        }
      } else {
        tagId = tag.id;
      }

      db.prepare(
        "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
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

  res.json({ success: true });
});

router.post("/bookmarks/bulk-delete", (req, res) => {
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

  res.json({ success: true });
});

router.get("/backup", (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM categories").all();
    const bookmarks = db.prepare("SELECT * FROM bookmarks").all();
    const tags = db.prepare("SELECT * FROM tags").all();
    const bookmark_tags = db.prepare("SELECT * FROM bookmark_tags").all();

    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: {
        categories,
        bookmarks,
        tags,
        bookmark_tags,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  } catch (error: any) {
    console.error("Backup failed:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/restore", (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.data) {
      return res.status(400).json({ error: "Invalid backup file" });
    }

    const { categories, bookmarks, tags, bookmark_tags } = backup.data;

    // Defer foreign key constraints for the upcoming transaction
    db.pragma("defer_foreign_keys = ON");

    db.transaction(() => {
      // Clear existing data
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM categories").run();

      // Insert new data
      const insertCategory = db.prepare(
        "INSERT INTO categories (id, name, icon, color, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const c of categories || []) {
        insertCategory.run(c.id, c.name, c.icon, c.color, c.parent_id, c.created_at);
      }

      const insertBookmark = db.prepare(
        "INSERT INTO bookmarks (id, url, title, description, cover_image_url, content_text, category_id, domain, images_json, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const b of bookmarks || []) {
        insertBookmark.run(
          b.id,
          b.url,
          b.title,
          b.description,
          b.cover_image_url,
          b.content_text,
          b.category_id,
          b.domain,
          b.images_json,
          b.created_at,
          b.updated_at,
          b.is_deleted
        );
      }

      const insertTag = db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)");
      for (const t of tags || []) {
        insertTag.run(t.id, t.name);
      }

      const insertBookmarkTag = db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
      );
      for (const bt of bookmark_tags || []) {
        insertBookmarkTag.run(bt.bookmark_id, bt.tag_id);
      }
    })();

    res.json({ success: true });
  } catch (error: any) {
    console.error("Restore failed:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
