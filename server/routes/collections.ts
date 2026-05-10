import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.ts";
import {
  sendJson,
  sendError,
  notFound,
  badRequest,
  internalError,
  validateCollectionIds,
} from "../utils/api.ts";

const router = express.Router();

router.get("/collections", (req, res) => {
  try {
    const { spaceId } = req.query;
    let query = `
      SELECT c.*, (SELECT COUNT(*) FROM bookmark_collections bc WHERE bc.collection_id = c.id) as bookmarkCount
      FROM collections c
    `;
    const params: any[] = [];
    if (spaceId) {
      query += " WHERE c.space_id = ?";
      params.push(spaceId);
    }
    query += " ORDER BY c.sort_order ASC, c.name ASC";
    res.json(db.prepare(query).all(...params));
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/collections", (req, res) => {
  try {
    const { name, icon, color, space_id, parent_id } = req.body;
    if (!name || !space_id) return badRequest(res, "Name and space_id are required");
    const maxOrder = db.prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM collections WHERE space_id = ? AND parent_id IS ?"
    ).get(space_id, parent_id || null) as { maxOrder: number };
    const id = uuidv4();
    db.prepare("INSERT INTO collections (id, name, icon, color, space_id, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, icon || "Folder", color || null, space_id, parent_id || null, maxOrder.maxOrder + 1);
    const collection = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
    sendJson(res, collection);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.put("/collections/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, parent_id, sort_order, space_id } = req.body;
    const existing = db.prepare("SELECT * FROM collections WHERE id = ?").get(id) as any;
    if (!existing) return notFound(res, "Collection not found");
    db.prepare("UPDATE collections SET name = ?, icon = ?, color = ?, parent_id = ?, sort_order = ?, space_id = ? WHERE id = ?")
      .run(name ?? existing.name, icon ?? existing.icon, color ?? existing.color, parent_id !== undefined ? (parent_id || null) : existing.parent_id, sort_order !== undefined ? sort_order : existing.sort_order, space_id ?? existing.space_id, id);
    const collection = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
    if (!collection) return notFound(res, "Collection not found");
    sendJson(res, collection);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.put("/collections/reorder", (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return badRequest(res, "orders array is required");
    db.transaction(() => {
      const update = db.prepare("UPDATE collections SET sort_order = ? WHERE id = ?");
      for (let i = 0; i < orders.length; i++) {
        update.run(i, orders[i]);
      }
    })();
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/collections/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'inbox-collection') return sendError(res, "Cannot delete system Inbox collection", 403);
    db.prepare("UPDATE collections SET parent_id = NULL WHERE parent_id = ?").run(id);
    db.prepare("DELETE FROM bookmark_collections WHERE collection_id = ?").run(id);
    const result = db.prepare("DELETE FROM collections WHERE id = ?").run(id);
    if (result.changes === 0) return notFound(res, "Collection not found");
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.get("/bookmarks/:id/collections", (req, res) => {
  try {
    const { id } = req.params;
    const collections = db.prepare(`
      SELECT c.* FROM collections c
      JOIN bookmark_collections bc ON c.id = bc.collection_id
      WHERE bc.bookmark_id = ? ORDER BY c.name
    `).all(id);
    res.json(collections);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/collections/:collectionId/bookmarks", (req, res) => {
  try {
    const { collectionId } = req.params;
    const { bookmarkIds } = req.body;
    if (!Array.isArray(bookmarkIds)) return badRequest(res, "bookmarkIds array is required");
    if (!validateCollectionIds([collectionId])) return notFound(res, "Collection not found");
    const insert = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
    const setCategory = db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ? AND category_id IS NULL");
    db.transaction(() => {
      for (const bmId of bookmarkIds) {
        insert.run(bmId, collectionId);
        setCategory.run(collectionId, bmId);
      }
    })();
    sendJson(res, { success: true, count: bookmarkIds.length });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/:id/collections/:collectionId", (req, res) => {
  try {
    const { id, collectionId } = req.params;
    if (!validateCollectionIds([collectionId])) return notFound(res, "Collection not found");
    db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)").run(id, collectionId);
    const bookmark = db.prepare("SELECT category_id FROM bookmarks WHERE id = ?").get(id) as any;
    if (!bookmark || !bookmark.category_id) {
      db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionId, id);
    }
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/:id/collections", (req, res) => {
  try {
    const { id } = req.params;
    const { collectionIds } = req.body;
    if (!Array.isArray(collectionIds)) return badRequest(res, "collectionIds array is required");
    if (collectionIds.length > 0 && !validateCollectionIds(collectionIds)) {
      return badRequest(res, "One or more collections not found");
    }
    db.transaction(() => {
      db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
      const insert = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
      for (const colId of collectionIds) insert.run(id, colId);
      db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionIds[0] || null, id);
    })();
    const collections = db.prepare(`
      SELECT c.* FROM collections c
      JOIN bookmark_collections bc ON c.id = bc.collection_id
      WHERE bc.bookmark_id = ?
    `).all(id);
    sendJson(res, { success: true, collections });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/bookmarks/:id/collections/:collectionId", (req, res) => {
  try {
    const { id, collectionId } = req.params;
    db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ? AND collection_id = ?").run(id, collectionId);
    const bookmark = db.prepare("SELECT category_id FROM bookmarks WHERE id = ?").get(id) as any;
    if (bookmark && bookmark.category_id === collectionId) {
      const another = db.prepare("SELECT collection_id FROM bookmark_collections WHERE bookmark_id = ? LIMIT 1").get(id) as any;
      db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(another ? another.collection_id : null, id);
    }
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

export default router;
