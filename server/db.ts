import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as tldts from "tldts";
import { getConfig } from "./config.js";

const appName = "LinkHub";

let dataDir = process.env.DATA_DIR;
if (!dataDir) {
  const config = getConfig();
  if (config.dataDir) {
    dataDir = config.dataDir;
  } else {
    dataDir = path.join(process.cwd(), "data");
  }
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
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    parent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    cover_image_url TEXT,
    content_text TEXT,
    category_id TEXT,
    domain TEXT,
    images_json TEXT,
    categorization_at DATETIME,
    categorization_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id)
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

  -- Collections table (replaces categories)
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    space_id TEXT NOT NULL,
    parent_id TEXT,
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
  CREATE INDEX IF NOT EXISTS idx_bc_bookmark ON bookmark_collections(bookmark_id);
  CREATE INDEX IF NOT EXISTS idx_bc_collection ON bookmark_collections(collection_id);
  `);
 
 // Migrations for existing databases
 try {
   db.exec("ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id)");
 } catch (e) { /* ignore if exists */ }
 
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

// Insert default categories if empty
const catCount = db
  .prepare("SELECT COUNT(*) as count FROM categories")
  .get() as { count: number };

 if (catCount.count === 0) {
   const insertCat = db.prepare(
     "INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)"
   );
   insertCat.run(uuidv4(), "Articles", "FileText", "#3b82f6");
   insertCat.run(uuidv4(), "Videos", "Video", "#ef4444");
   insertCat.run(uuidv4(), "Programming", "Code", "#10b981");
   insertCat.run(uuidv4(), "Design", "Palette", "#ec4899");
 }

 // Run spaces & collections migration (one-time, idempotent)
 runSpacesMigration(db, uuidv4);

  // Migration to Spaces & Collections model - idempotent (can run multiple times)
  function runSpacesMigration(db: Database, uuidv4: (options?: any) => string) {
    try {
      console.log("Running spaces & collections migration (idempotent)...");
      db.transaction(() => {
        // 1. Create Inbox space (system) - the only default space
        db.prepare("INSERT OR IGNORE INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)")
          .run('inbox-space', 'Inbox', 'Inbox', '#6b7280');

        // 2. Create Inbox collection in Inbox space (for unassigned bookmarks)
        db.prepare("INSERT OR IGNORE INTO collections (id, name, icon, color, space_id) VALUES (?, ?, ?, ?, ?)")
          .run('inbox-collection', 'Inbox', 'Inbox', '#6b7280', 'inbox-space');

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

        // 4. Migrate bookmarks to bookmark_collections
        const bookmarks = db.prepare("SELECT id, category_id FROM bookmarks WHERE is_deleted = 0").all() as any[];
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
      throw err;
    }
  }

 export const getDataDir = () => dataDir;
 export default db;
