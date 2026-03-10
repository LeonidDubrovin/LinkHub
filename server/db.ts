import Database from "better-sqlite3";
import os from "os";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as tldts from "tldts";

const appName = "LinkHub";
let dataDir = process.env.DATA_DIR || process.cwd();

// Fallback for production if DATA_DIR is not set
if (!process.env.DATA_DIR && process.env.NODE_ENV === "production") {
  if (process.platform === "win32") {
    dataDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      appName
    );
  } else if (process.platform === "darwin") {
    dataDir = path.join(os.homedir(), "Library", "Application Support", appName);
  } else {
    dataDir = path.join(os.homedir(), ".config", appName);
  }
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "bookmarks.db");
console.log(`Using database at: ${dbPath}`);

// Initialize SQLite Database
const db = new Database(dbPath);

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
`);

// Migrations for existing databases
try {
  db.exec("ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id)");
} catch (e) { /* ignore if exists */ }

try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN domain TEXT");
} catch (e) { /* ignore if exists */ }

try {
  const allBookmarks = db.prepare("SELECT id, url FROM bookmarks").all() as any[];
  const updateDomain = db.prepare("UPDATE bookmarks SET domain = ? WHERE id = ?");
  for (const b of allBookmarks) {
    try {
      const parsed = tldts.parse(b.url);
      const domain = parsed.domain || new URL(b.url).hostname;
      updateDomain.run(domain, b.id);
    } catch (e) {}
  }
} catch (e) {}

try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN images_json TEXT");
} catch (e) { /* ignore if exists */ }

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

export default db;
