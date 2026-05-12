import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as tldts from "tldts";
import { getBaseDataDir } from "./paths.ts";
import { getConfig } from "./config.ts";

const appName = "LinkHub";

const baseDir = getBaseDataDir();
let dataDir = baseDir;

try {
  const config = getConfig();
  if (config.dataDir) {
    dataDir = config.dataDir;
  }
} catch (e) {
  console.error("Failed to read config for dataDir:", e);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "bookmarks.db");
console.log(`Using database at: ${dbPath}`);

// Initialize SQLite Database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    cover_image_url TEXT,
    content_text TEXT,
    domain TEXT,
    images_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id TEXT,
    tag_id TEXT,
    PRIMARY KEY (bookmark_id, tag_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Spaces table
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Collections table
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    space_id TEXT NOT NULL,
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES collections(id)
  );

  -- Bookmark ↔ Collection many-to-many
  CREATE TABLE IF NOT EXISTS bookmark_collections (
    bookmark_id TEXT,
    collection_id TEXT,
    PRIMARY KEY (bookmark_id, collection_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  );
  `);

 // Legacy table — kept for one-time migration only
 db.exec(`
   CREATE TABLE IF NOT EXISTS categories (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     icon TEXT,
     color TEXT,
     parent_id TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
 `);

 // Migrations for existing databases
 try {
   db.exec("ALTER TABLE bookmarks ADD COLUMN domain TEXT");
 } catch (e) { /* ignore if exists */ }

 try {
   db.exec("ALTER TABLE bookmarks ADD COLUMN images_json TEXT");
 } catch (e) { /* ignore if exists */ }

 try {
   db.exec("ALTER TABLE bookmarks ADD COLUMN categorization_at DATETIME");
 } catch (e) { /* ignore if exists */ }

 try {
   db.exec("ALTER TABLE bookmarks ADD COLUMN categorization_source TEXT");
 } catch (e) { /* ignore if exists */ }

 try {
   const allBookmarks = db.prepare("SELECT id, url FROM bookmarks WHERE domain IS NULL").all() as any[];
  const updateDomain = db.prepare("UPDATE bookmarks SET domain = ? WHERE id = ?");
  for (const b of allBookmarks) {
    try {
      const parsed = tldts.parse(b.url);
      const domain = parsed.domain || new URL(b.url).hostname;
      updateDomain.run(domain, b.id);
    } catch (e) {}
  }
} catch (e) {}

 // Migration: add sort_order column if missing
try {
  db.exec("ALTER TABLE collections ADD COLUMN sort_order INTEGER DEFAULT 0");
} catch (e) { /* ignore if exists */ }

 // One-time migration: categories → collections (only if bookmark_collections is empty)
 const linkCount = db.prepare("SELECT COUNT(*) as count FROM bookmark_collections").get() as { count: number };
 if (linkCount.count === 0) {
   console.log("Running one-time categories → collections migration...");
   runSpacesMigration(db, uuidv4);
 }

  // Migration to Spaces & Collections model - idempotent
  function runSpacesMigration(db: Database, uuidv4: (options?: any) => string) {
    try {
      console.log("Running spaces & collections migration (idempotent)...");
      db.transaction(() => {
         // 1. Create General space (system default)
         db.prepare("INSERT OR IGNORE INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)")
           .run('inbox-space', 'General', 'Folder', '#6b7280');

         db.prepare("UPDATE spaces SET name = 'General', icon = 'Folder' WHERE id = 'inbox-space' AND name = 'Inbox'")
           .run();

         // 2. Create Unsorted collection in General space (for uncategorized bookmarks)
         db.prepare("INSERT OR IGNORE INTO collections (id, name, icon, color, space_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
           .run('inbox-collection', 'Unsorted', 'Inbox', '#6b7280', 'inbox-space', -1);

         db.prepare("UPDATE collections SET name = 'Unsorted', sort_order = -1 WHERE id = 'inbox-collection' AND name = 'Inbox'")
           .run();

        // 3. Migrate existing categories to collections (preserve IDs) - all go to Inbox space
        const oldCategories = db.prepare("SELECT * FROM categories").all() as any[];
        const insertCollection = db.prepare(`
          INSERT OR IGNORE INTO collections (id, name, icon, color, space_id, parent_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cat of oldCategories) {
          insertCollection.run(
            cat.id,
            cat.name,
            cat.icon || 'Folder',
            cat.color || '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6, '0'),
            'inbox-space',
            cat.parent_id || null,
            cat.created_at
          );
        }

        // 4. Migrate bookmarks to bookmark_collections (skip if category_id column missing - fresh DB)
        let bookmarks: any[] = [];
        try {
          bookmarks = db.prepare("SELECT id, category_id FROM bookmarks WHERE is_deleted = 0").all() as any[];
        } catch (e: any) {
          if (e.message?.includes("no such column: category_id")) {
            console.log("category_id column not found — skipping legacy bookmark migration (fresh database)");
          } else {
            throw e;
          }
        }
        const insertLink = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
        for (const b of bookmarks) {
          if (b.category_id) {
            insertLink.run(b.id, b.category_id);
          } else {
            insertLink.run(b.id, 'inbox-collection');
          }
        }

        console.log(`Migration complete: ${oldCategories.length} collections, ${bookmarks.length} bookmark links processed.`);
      })();
    } catch (err) {
      console.error("Spaces migration failed:", err);
    }
  }

 export const getDataDir = () => dataDir;
 export default db;
