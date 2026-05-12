import express from "express";
import { getDb } from "../db.ts";
import {
  sendJson,
  sendError,
  badRequest,
  internalError,
} from "../utils/api.ts";

const router = express.Router();

router.get("/backup", async (req, res) => {
  try {
    const db = await getDb();
    const bookmarks = await db.all("SELECT * FROM bookmarks WHERE is_deleted = 0");
    const tags = await db.all("SELECT * FROM tags");
    const bookmark_tags = await db.all("SELECT * FROM bookmark_tags");
    const spaces = await db.all("SELECT * FROM spaces");
    const collections = await db.all("SELECT * FROM collections");
    const bookmark_collections = await db.all("SELECT * FROM bookmark_collections");

    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: { bookmarks, tags, bookmark_tags, spaces, collections, bookmark_collections },
    };
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, (key, value) => typeof value === 'bigint' ? value.toString() : value));
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/restore", async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.data) return badRequest(res, "Invalid backup file");
    const { bookmarks, tags, bookmark_tags, spaces, collections, bookmark_collections } = backup.data;
    const db = await getDb();

    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("DELETE FROM bookmark_collections");
      await db.run("DELETE FROM bookmark_tags");
      await db.run("DELETE FROM tags");
      await db.run("DELETE FROM bookmarks");
      await db.run("DELETE FROM collections");
      await db.run("DELETE FROM spaces");

      for (const s of spaces || []) {
        await db.run(
          "INSERT INTO spaces (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)",
          s.id, s.name, s.icon, s.color, s.created_at
        );
      }
      for (const c of collections || []) {
        await db.run(
          "INSERT INTO collections (id, name, icon, color, space_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          c.id, c.name, c.icon, c.color, c.space_id, c.parent_id, c.created_at
        );
      }
      for (const b of bookmarks || []) {
        await db.run(
          "INSERT INTO bookmarks (id, url, title, description, cover_image_url, content_text, domain, images_json, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          b.id, b.url, b.title, b.description, b.cover_image_url, b.content_text, b.domain, b.images_json, b.created_at, b.updated_at, b.is_deleted
        );
      }
      for (const t of tags || []) {
        await db.run("INSERT INTO tags (id, name) VALUES (?, ?)", t.id, t.name);
      }
      for (const bt of bookmark_tags || []) {
        await db.run("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)", bt.bookmark_id, bt.tag_id);
      }
      for (const bc of bookmark_collections || []) {
        await db.run("INSERT INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)", bc.bookmark_id, bc.collection_id);
      }
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

export default router;
