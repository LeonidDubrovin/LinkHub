import express from "express";
import db from "../db.ts";
import {
  sendJson,
  sendError,
  badRequest,
  internalError,
} from "../utils/api.ts";

const router = express.Router();

router.get("/backup", (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM categories").all();
    const bookmarks = db.prepare("SELECT * FROM bookmarks WHERE is_deleted = 0").all();
    const tags = db.prepare("SELECT * FROM tags").all();
    const bookmark_tags = db.prepare("SELECT * FROM bookmark_tags").all();
    const spaces = db.prepare("SELECT * FROM spaces").all();
    const collections = db.prepare("SELECT * FROM collections").all();
    const bookmark_collections = db.prepare("SELECT * FROM bookmark_collections").all();

    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: { categories, bookmarks, tags, bookmark_tags, spaces, collections, bookmark_collections },
    };
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, (key, value) => typeof value === 'bigint' ? value.toString() : value));
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/restore", (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.data) return badRequest(res, "Invalid backup file");
    const { categories, bookmarks, tags, bookmark_tags, spaces, collections, bookmark_collections } = backup.data;
    db.pragma("defer_foreign_keys = ON");

    db.transaction(() => {
      db.prepare("DELETE FROM bookmark_collections").run();
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM collections").run();
      db.prepare("DELETE FROM spaces").run();
      db.prepare("DELETE FROM categories").run();

      const insertSpace = db.prepare("INSERT INTO spaces (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)");
      for (const s of spaces || []) insertSpace.run(s.id, s.name, s.icon, s.color, s.created_at);

      const insertCategory = db.prepare("INSERT INTO categories (id, name, icon, color, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)");
      for (const c of categories || []) insertCategory.run(c.id, c.name, c.icon, c.color, c.parent_id, c.created_at);

      const insertCollection = db.prepare("INSERT INTO collections (id, name, icon, color, space_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
      for (const c of collections || []) insertCollection.run(c.id, c.name, c.icon, c.color, c.space_id, c.parent_id, c.created_at);

      const insertBookmark = db.prepare("INSERT INTO bookmarks (id, url, title, description, cover_image_url, content_text, category_id, domain, images_json, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      for (const b of bookmarks || []) insertBookmark.run(b.id, b.url, b.title, b.description, b.cover_image_url, b.content_text, b.category_id, b.domain, b.images_json, b.created_at, b.updated_at, b.is_deleted);

      const insertTag = db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)");
      for (const t of tags || []) insertTag.run(t.id, t.name);

      const insertBookmarkTag = db.prepare("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
      for (const bt of bookmark_tags || []) insertBookmarkTag.run(bt.bookmark_id, bt.tag_id);

      const insertBookmarkCollection = db.prepare("INSERT INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
      for (const bc of bookmark_collections || []) insertBookmarkCollection.run(bc.bookmark_id, bc.collection_id);
    })();
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

export default router;
