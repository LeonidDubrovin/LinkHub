import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as tldts from "tldts";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { getBaseDataDir } from "./paths.ts";
import { getConfig } from "./config.ts";

let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;
let initPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;
let dataDir: string;

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = initializeDb();
  }
  return initPromise;
}

async function initializeDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  const baseDir = getBaseDataDir();
  dataDir = baseDir;

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

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.run("PRAGMA journal_mode = WAL");
  await db.run("PRAGMA foreign_keys = ON");

  // Create tables
  await db.exec(`
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

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS bookmark_collections (
      bookmark_id TEXT,
      collection_id TEXT,
      PRIMARY KEY (bookmark_id, collection_id),
      FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );
  `);

  // Legacy table — kept for one-time migration only
  await db.exec(`
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
    await db.run("ALTER TABLE bookmarks ADD COLUMN domain TEXT");
  } catch (e) { /* ignore if exists */ }

  try {
    await db.run("ALTER TABLE bookmarks ADD COLUMN images_json TEXT");
  } catch (e) { /* ignore if exists */ }

  try {
    await db.run("ALTER TABLE bookmarks ADD COLUMN categorization_at DATETIME");
  } catch (e) { /* ignore if exists */ }

  try {
    await db.run("ALTER TABLE bookmarks ADD COLUMN categorization_source TEXT");
  } catch (e) { /* ignore if exists */ }

  try {
    const allBookmarks = (await db.all(
      "SELECT id, url FROM bookmarks WHERE domain IS NULL"
    )) as { id: string; url: string }[];
    for (const b of allBookmarks) {
      try {
        const parsed = tldts.parse(b.url);
        const domain = parsed.domain || new URL(b.url).hostname;
        await db.run("UPDATE bookmarks SET domain = ? WHERE id = ?", domain, b.id);
      } catch (e) {}
    }
  } catch (e) {}

  // Migration: add sort_order column if missing
  try {
    await db.run("ALTER TABLE collections ADD COLUMN sort_order INTEGER DEFAULT 0");
  } catch (e) { /* ignore if exists */ }

  // One-time migration: categories → collections (only if bookmark_collections is empty)
  const linkCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM bookmark_collections"
  );
  if (linkCount && linkCount.count === 0) {
    console.log("Running one-time categories → collections migration...");
    await runSpacesMigration(db, uuidv4);
  }

  dbInstance = db;
  return db;
}

async function runSpacesMigration(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  uuidv4: (options?: any) => string
) {
  try {
    console.log("Running spaces & collections migration (idempotent)...");
    await db.run("BEGIN TRANSACTION");

    try {
      await db.run(
        "INSERT OR IGNORE INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)",
        "inbox-space",
        "General",
        "Folder",
        "#6b7280"
      );
      await db.run(
        "UPDATE spaces SET name = 'General', icon = 'Folder' WHERE id = 'inbox-space' AND name = 'Inbox'"
      );

      await db.run(
        "INSERT OR IGNORE INTO collections (id, name, icon, color, space_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        "inbox-collection",
        "Unsorted",
        "Inbox",
        "#6b7280",
        "inbox-space",
        -1
      );
      await db.run(
        "UPDATE collections SET name = 'Unsorted', sort_order = -1 WHERE id = 'inbox-collection' AND name = 'Inbox'"
      );

      const oldCategories = await db.all<any[]>("SELECT * FROM categories");
      for (const cat of oldCategories) {
        await db.run(
          `INSERT OR IGNORE INTO collections (id, name, icon, color, space_id, parent_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          cat.id,
          cat.name,
          cat.icon || "Folder",
          cat.color || "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"),
          "inbox-space",
          cat.parent_id || null,
          cat.created_at
        );
      }

      let bookmarks: any[] = [];
      try {
        bookmarks = await db.all<any[]>(
          "SELECT id, category_id FROM bookmarks WHERE is_deleted = 0"
        );
      } catch (e: any) {
        if (e.message?.includes("no such column: category_id")) {
          console.log("category_id column not found — skipping legacy bookmark migration (fresh database)");
        } else {
          throw e;
        }
      }
      for (const b of bookmarks) {
        if (b.category_id) {
          await db.run(
            "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
            b.id,
            b.category_id
          );
        } else {
          await db.run(
            "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
            b.id,
            "inbox-collection"
          );
        }
      }

      await db.run("COMMIT");
      console.log(
        `Migration complete: ${oldCategories.length} collections, ${bookmarks.length} bookmark links processed.`
      );
    } catch (err) {
      await db.run("ROLLBACK").catch(() => {});
      throw err;
    }
  } catch (err) {
    console.error("Spaces migration failed:", err);
  }
}

export const getDataDir = () => dataDir;
