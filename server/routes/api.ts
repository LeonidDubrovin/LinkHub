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

const router = express.Router();
const categorizer = new CategorizationService();

// Validate URL is safe for proxy (not internal/private)
function isSafeProxyUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost, loopback, private ranges, cloud metadata
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname === '0.0.0.0' || hostname.endsWith('.local')) return false;
    // Block private IP ranges
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 169 && parts[1] === 254) return false; // Cloud metadata
    }
    return true;
  } catch {
    return false;
  }
}

// Validate URL is safe for proxy (not internal/private)
function isSafeProxyUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost, loopback, private ranges, cloud metadata
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname === '0.0.0.0' || hostname.endsWith('.local')) return false;
    // Block private IP ranges
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 169 && parts[1] === 254) return false; // Cloud metadata
    }
    return true;
  } catch {
    return false;
  }
}

router.get("/settings", (req, res) => {
  const config = getConfig();
  res.json({
    dataDir: getDataDir(),
    userAgent: config.userAgent || "Mozilla/5.0 (compatible; Twitterbot/1.0)",
    llm: {
      enabled: config.llm?.enabled ?? false,
      provider: config.llm?.provider ?? 'openrouter',
      apiKey: config.llm?.apiKey ? '••••••••' + config.llm.apiKey.slice(-4) : '',
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

 // ============ SPACES ============

 router.get("/spaces", (req, res) => {
   try {
     const spaces = db.prepare(`
       SELECT s.*, 
         (SELECT COUNT(*) FROM collections WHERE space_id = s.id) as collectionCount
       FROM spaces s
       ORDER BY s.name
     `).all();
     res.json(spaces);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

 router.post("/spaces", (req, res) => {
   try {
     const { name, icon, color } = req.body;
     if (!name) {
       return res.status(400).json({ error: "Name is required" });
     }
     const id = uuidv4();
     const insertSpace = db.prepare(
       "INSERT INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)"
     );
     insertSpace.run(id, name, icon || null, color || null);
     const space = db.prepare("SELECT * FROM spaces WHERE id = ?").get(id);
     res.json(space);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

 router.put("/spaces/:id", (req, res) => {
   try {
     const { id } = req.params;
     const { name, icon, color } = req.body;
     const update = db.prepare(
       "UPDATE spaces SET name = ?, icon = ?, color = ? WHERE id = ?"
     );
     update.run(name, icon, color, id);
     const space = db.prepare("SELECT * FROM spaces WHERE id = ?").get(id);
     if (!space) {
       return res.status(404).json({ error: "Space not found" });
     }
     res.json(space);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

  router.delete("/spaces/:id", (req, res) => {
    try {
      const { id } = req.params;
      // Prevent deletion of system Inbox space
      if (id === 'inbox-space') {
        return res.status(403).json({ error: "Cannot delete system Inbox space" });
      }
      // Delete space cascades to collections (via FK) but bookmarks remain
      const deleteSpace = db.prepare("DELETE FROM spaces WHERE id = ?");
      const result = deleteSpace.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

 // ============ COLLECTIONS ============

 router.get("/collections", (req, res) => {
   try {
     const { spaceId } = req.query;
     let query = `
       SELECT c.*, 
         (SELECT COUNT(*) FROM bookmark_collections bc WHERE bc.collection_id = c.id) as bookmarkCount
       FROM collections c
     `;
     const params: any[] = [];
     
     if (spaceId) {
       query += " WHERE c.space_id = ?";
       params.push(spaceId);
     }
     
     query += " ORDER BY c.name";
     
     const collections = db.prepare(query).all(...params);
     res.json(collections);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

 router.post("/collections", (req, res) => {
   try {
     const { name, icon, color, space_id, parent_id } = req.body;
     if (!name || !space_id) {
       return res.status(400).json({ error: "Name and space_id are required" });
     }
     const id = uuidv4();
     const insertCollection = db.prepare(
       "INSERT INTO collections (id, name, icon, color, space_id, parent_id) VALUES (?, ?, ?, ?, ?, ?)"
     );
     insertCollection.run(id, name, icon || "Folder", color || null, space_id, parent_id || null);
     const collection = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
     res.json(collection);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

 router.put("/collections/:id", (req, res) => {
   try {
     const { id } = req.params;
     const { name, icon, color, parent_id } = req.body;
     const update = db.prepare(
       "UPDATE collections SET name = ?, icon = ?, color = ?, parent_id = ? WHERE id = ?"
     );
     update.run(name, icon, color, parent_id || null, id);
     const collection = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
     if (!collection) {
       return res.status(404).json({ error: "Collection not found" });
     }
     res.json(collection);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

  router.delete("/collections/:id", (req, res) => {
    try {
      const { id } = req.params;
      // Prevent deletion of system collections
      if (id === 'inbox-collection') {
        return res.status(403).json({ error: "Cannot delete system Inbox collection" });
      }
      // First, re-parent any child collections to root (set parent_id = NULL)
      db.prepare("UPDATE collections SET parent_id = NULL WHERE parent_id = ?").run(id);
      // Then unlink all bookmarks from this collection
      db.prepare("DELETE FROM bookmark_collections WHERE collection_id = ?").run(id);
      // Then delete the collection
      const deleteColl = db.prepare("DELETE FROM collections WHERE id = ?");
      const result = deleteColl.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

 // ============ BOOKMARK-COLLECTION ASSOCIATIONS ============

 router.get("/bookmarks/:id/collections", (req, res) => {
   try {
     const { id } = req.params;
     const collections = db.prepare(`
       SELECT c.* FROM collections c
       JOIN bookmark_collections bc ON c.id = bc.collection_id
       WHERE bc.bookmark_id = ?
       ORDER BY c.name
     `).all(id);
     res.json(collections);
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

  router.post("/bookmarks/:id/collections", (req, res) => {
    try {
      const { id } = req.params;
      const { collectionIds } = req.body;
      if (!Array.isArray(collectionIds)) {
        return res.status(400).json({ error: "collectionIds array is required" });
      }
      // Allow empty array to remove all collections

      // Validate collections exist (skip if empty array)
      if (collectionIds.length > 0) {
        const placeholders = collectionIds.map(() => '?').join(',');
        const existing = db.prepare(`SELECT id FROM collections WHERE id IN (${placeholders})`).all(...collectionIds) as any[];
        if (existing.length !== collectionIds.length) {
          return res.status(400).json({ error: "One or more collections not found" });
        }
      }

     // Replace all existing links with new ones
     db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
     const insert = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
     for (const colId of collectionIds) {
       insert.run(id, colId);
     }

     // Update legacy category_id to first collection for backward compatibility
     db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionIds[0] || null, id);

     const collections = db.prepare(`
       SELECT c.* FROM collections c
       JOIN bookmark_collections bc ON c.id = bc.collection_id
       WHERE bc.bookmark_id = ?
     `).all(id);
     res.json({ success: true, collections });
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
 });

 router.delete("/bookmarks/:id/collections/:collectionId", (req, res) => {
   try {
     const { id, collectionId } = req.params;
     db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ? AND collection_id = ?").run(id, collectionId);
     
     // If removed collection was the legacy category_id, clear it or set to another
     const bookmark = db.prepare("SELECT category_id FROM bookmarks WHERE id = ?").get(id) as any;
     if (bookmark && bookmark.category_id === collectionId) {
       // Find another collection for this bookmark, or null
       const another = db.prepare("SELECT collection_id FROM bookmark_collections WHERE bookmark_id = ? LIMIT 1").get(id) as any;
       const newCatId = another ? another.collection_id : null;
       db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(newCatId, id);
     }
     
     res.json({ success: true });
   } catch (error: any) {
     res.status(500).json({ error: error.message });
   }
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
  const { collectionIds, spaceId, categoryId, tagId, domain } = req.query;

  // Parse collectionIds (comma-separated) into array
  let collIds: string[] = [];
  if (collectionIds) {
    collIds = String(collectionIds).split(',').filter(Boolean);
  } else if (categoryId) {
    // Legacy: treat categoryId as collectionId
    collIds = [String(categoryId)];
  }

  // Base query (keep legacy category joins)
  let query = `
    SELECT b.*, c.name as category_name, c.color as category_color 
    FROM bookmarks b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.is_deleted = 0
  `;
  const params: any[] = [];

  // Filter by collection tree (if collectionIds provided)
  if (collIds.length > 0) {
    const placeholders = collIds.map(() => '?').join(',');
    const cte = `
      WITH RECURSIVE targetCollections AS (
        SELECT id FROM collections WHERE id IN (${placeholders})
        UNION ALL
        SELECT c.id FROM collections c JOIN targetCollections tc ON c.parent_id = tc.id
      )
    `;
    query = cte + query + ` AND EXISTS (
      SELECT 1 FROM bookmark_collections bc 
      WHERE bc.bookmark_id = b.id 
        AND bc.collection_id IN (SELECT id FROM targetCollections)
    )`;
    params.push(...collIds);
  }

  // Filter by space (all collections in space including nested)
  if (spaceId) {
    const spaceCte = `
      WITH RECURSIVE spaceCollections AS (
        SELECT id FROM collections WHERE space_id = ?
        UNION ALL
        SELECT c.id FROM collections c JOIN spaceCollections sc ON c.parent_id = sc.id
      )
    `;
    query = spaceCte + query + ` AND EXISTS (
      SELECT 1 FROM bookmark_collections bc 
      WHERE bc.bookmark_id = b.id 
        AND bc.collection_id IN (SELECT id FROM spaceCollections)
    )`;
    params.push(String(spaceId));
  }

  if (tagId) {
    query += " AND b.id IN (SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ?)";
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

  // Fetch tags for all bookmarks in chunks
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

  // Fetch collections for all bookmarks in chunks
  const allCollections: any[] = [];
  for (let i = 0; i < bookmarkIds.length; i += chunkSize) {
    const chunk = bookmarkIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const collQuery = `
      SELECT bc.bookmark_id, c.* 
      FROM bookmark_collections bc
      JOIN collections c ON bc.collection_id = c.id
      WHERE bc.bookmark_id IN (${placeholders})
    `;
    const chunkColls = db.prepare(collQuery).all(...chunk) as any[];
    allCollections.push(...chunkColls);
  }

  // Group tags by bookmark_id
  const tagsByBookmarkId = allTags.reduce((acc, tag) => {
    if (!acc[tag.bookmark_id]) acc[tag.bookmark_id] = [];
    const { bookmark_id, ...tagData } = tag;
    acc[tag.bookmark_id].push(tagData);
    return acc;
  }, {} as Record<string, any[]>);

  // Group collections by bookmark_id
  const collectionsByBookmarkId = allCollections.reduce((acc, row) => {
    if (!acc[row.bookmark_id]) acc[row.bookmark_id] = [];
    const { bookmark_id, ...coll } = row;
    acc[row.bookmark_id].push(coll);
    return acc;
  }, {} as Record<string, any[]>);

  // Combine
  const bookmarksWithData = bookmarks.map((b) => ({
    ...b,
    tags: tagsByBookmarkId[b.id] || [],
    collections: collectionsByBookmarkId[b.id] || []
  }));

  res.json(bookmarksWithData);
});

async function createBookmark(url: string, options: { collectionIds?: string[] } = {}) {
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

   // 1. Validate collectionIds BEFORE inserting bookmark
   let collectionIds = options.collectionIds && options.collectionIds.length > 0
     ? options.collectionIds
     : ['inbox-collection'];

   if (collectionIds.length > 0) {
     const placeholders = collectionIds.map(() => '?').join(',');
     const existingCollections = db.prepare(`SELECT id FROM collections WHERE id IN (${placeholders})`).all(...collectionIds) as any[];
     if (existingCollections.length !== collectionIds.length) {
       return { id: null, title: url, success: false, error: "One or more collections not found" };
     }
   }

   // 2. Insert bookmark and collection links in a transaction
   const bookmarkId = uuidv4();
   let domain = "";
   try {
     domain = new URL(url).hostname;
   } catch (e) {}

   db.transaction(() => {
     const insertBookmark = db.prepare(`
       INSERT INTO bookmarks (id, url, title, domain)
       VALUES (?, ?, ?, ?)
     `);
     insertBookmark.run(bookmarkId, url, url, domain);

     // Set legacy category_id to first collection for backward compatibility
     db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionIds[0] || null, bookmarkId);

     // Create bookmark-collection links
     const insertLink = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
     for (const colId of collectionIds) {
       insertLink.run(bookmarkId, colId);
     }
   })();

   return { id: bookmarkId, title: url, success: true, needsRefresh: true, collectionIds };
 }

   // 0. Check if already exists
   const existing = db
     .prepare("SELECT id, title FROM bookmarks WHERE url = ? AND is_deleted = 0")
     .get(url) as any;

   if (existing) {
     return { id: existing.id, title: existing.title, success: false, exists: true, error: "Bookmark already exists" };
   }

   // 1. Validate collectionIds BEFORE inserting bookmark
   let collectionIds = options.collectionIds && options.collectionIds.length > 0
     ? options.collectionIds
     : ['inbox-collection'];

   if (collectionIds.length > 0) {
     const placeholders = collectionIds.map(() => '?').join(',');
     const existingCollections = db.prepare(`SELECT id FROM collections WHERE id IN (${placeholders})`).all(...collectionIds) as any[];
     if (existingCollections.length !== collectionIds.length) {
       return { id: null, title: url, success: false, error: "One or more collections not found" };
     }
   }

   // 2. Insert bookmark and collection links in a transaction
   const bookmarkId = uuidv4();
   let domain = "";
   try {
     domain = new URL(url).hostname;
   } catch (e) {}

   db.transaction(() => {
     const insertBookmark = db.prepare(`
       INSERT INTO bookmarks (id, url, title, domain)
       VALUES (?, ?, ?, ?)
     `);
     insertBookmark.run(bookmarkId, url, url, domain);

     // Set legacy category_id to first collection for backward compatibility
     db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionIds[0] || null, bookmarkId);

     // Create bookmark-collection links
     const insertLink = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
     for (const colId of collectionIds) {
       insertLink.run(bookmarkId, colId);
     }
   })();

   return { id: bookmarkId, title: url, success: true, needsRefresh: true, collectionIds };
 }

 router.get("/bookmarks/:id", async (req, res) => {
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

   // Fetch tags
   const tags = db.prepare(`
     SELECT t.* FROM tags t
     JOIN bookmark_tags bt ON t.id = bt.tag_id
     WHERE bt.bookmark_id = ?
   `).all(id);

   // Fetch collections
   const collections = db.prepare(`
     SELECT c.* FROM collections c
     JOIN bookmark_collections bc ON c.id = bc.collection_id
     WHERE bc.bookmark_id = ?
     ORDER BY c.name
   `).all(id);

   res.json({ ...bookmark, tags, collections });
 });

 router.post("/bookmarks", async (req, res) => {
   const { url, collectionIds } = req.body;
   if (!url) return res.status(400).json({ error: "URL is required" });

   try {
     const result = await createBookmark(url, { collectionIds });
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

  // Validate URL is safe (block internal/private addresses)
  if (!isSafeProxyUrl(url)) {
    return res.status(403).send("Access to internal addresses is not allowed");
  }

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
  db.transaction(() => {
    db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);
    db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
    db.prepare(`
      DELETE FROM tags 
      WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)
    `).run();
  })();

  res.json({ success: true });
});

router.post("/bookmarks/bulk-delete", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid or empty ids array" });
  }

  const placeholders = ids.map(() => '?').join(',');
  db.transaction(() => {
    db.prepare(`DELETE FROM bookmark_collections WHERE bookmark_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM bookmarks WHERE id IN (${placeholders})`).run(...ids);
    db.prepare(`
      DELETE FROM tags 
      WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)
    `).run();
  })();

  res.json({ success: true });
});

router.get("/backup", (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM categories").all();
    const bookmarks = db.prepare("SELECT * FROM bookmarks").all();
    const tags = db.prepare("SELECT * FROM tags").all();
    const bookmark_tags = db.prepare("SELECT * FROM bookmark_tags").all();
    const spaces = db.prepare("SELECT * FROM spaces").all();
    const collections = db.prepare("SELECT * FROM collections").all();
    const bookmark_collections = db.prepare("SELECT * FROM bookmark_collections").all();

    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: {
        categories,
        bookmarks,
        tags,
        bookmark_tags,
        spaces,
        collections,
        bookmark_collections,
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

    const { categories, bookmarks, tags, bookmark_tags, spaces, collections, bookmark_collections } = backup.data;

    // Defer foreign key constraints for the upcoming transaction
    db.pragma("defer_foreign_keys = ON");

    db.transaction(() => {
      // Clear existing data
      db.prepare("DELETE FROM bookmark_collections").run();
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM collections").run();
      db.prepare("DELETE FROM spaces").run();
      db.prepare("DELETE FROM categories").run();

      // Insert spaces first
      const insertSpace = db.prepare(
        "INSERT INTO spaces (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)"
      );
      for (const s of spaces || []) {
        insertSpace.run(s.id, s.name, s.icon, s.color, s.created_at);
      }

      // Insert categories
      const insertCategory = db.prepare(
        "INSERT INTO categories (id, name, icon, color, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const c of categories || []) {
        insertCategory.run(c.id, c.name, c.icon, c.color, c.parent_id, c.created_at);
      }

      // Insert collections
      const insertCollection = db.prepare(
        "INSERT INTO collections (id, name, icon, color, space_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const c of collections || []) {
        insertCollection.run(c.id, c.name, c.icon, c.color, c.space_id, c.parent_id, c.created_at);
      }

      // Insert bookmarks
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

      // Insert tags
      const insertTag = db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)");
      for (const t of tags || []) {
        insertTag.run(t.id, t.name);
      }

      // Insert bookmark_tags
      const insertBookmarkTag = db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
      );
      for (const bt of bookmark_tags || []) {
        insertBookmarkTag.run(bt.bookmark_id, bt.tag_id);
      }

      // Insert bookmark_collections
      const insertBookmarkCollection = db.prepare(
        "INSERT INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)"
      );
      for (const bc of bookmark_collections || []) {
        insertBookmarkCollection.run(bc.bookmark_id, bc.collection_id);
      }
    })();

    res.json({ success: true });
  } catch (error: any) {
    console.error("Restore failed:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
