import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db.ts";
import {
  sendJson,
  sendError,
  notFound,
  badRequest,
  internalError,
  validateCollectionIds,
} from "../utils/api.ts";

const router = express.Router();

router.get("/collections", async (req, res) => {
  try {
    const db = await getDb();
    const { spaceId } = req.query;
    let query = `
      SELECT c.*, COUNT(b.id) as bookmarkCount
      FROM collections c
      LEFT JOIN bookmark_collections bc ON bc.collection_id = c.id
      LEFT JOIN bookmarks b ON b.id = bc.bookmark_id AND b.is_deleted = 0
    `;
    const params: any[] = [];
    if (spaceId) {
      query += " WHERE c.space_id = ?";
      params.push(spaceId);
    }
    query += " GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC";
    res.json(await db.all(query, ...params));
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/collections", async (req, res) => {
  try {
    const { name, icon, color, space_id, parent_id } = req.body;
    if (!name || !space_id) return badRequest(res, "Name and space_id are required");
    const db = await getDb();
    const maxOrder = (await db.get(
      "SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM collections WHERE space_id = ? AND parent_id IS ?",
      space_id,
      parent_id || null
    )) as { maxOrder: number } | undefined;
    const id = uuidv4();
    await db.run(
      "INSERT INTO collections (id, name, icon, color, space_id, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      name,
      icon || "Folder",
      color || null,
      space_id,
      parent_id || null,
      (maxOrder?.maxOrder ?? -1) + 1
    );
    const collection = await db.get("SELECT * FROM collections WHERE id = ?", id);
    sendJson(res, collection);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.put("/collections/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, parent_id, sort_order, space_id } = req.body;
    const db = await getDb();
    const existing = (await db.get("SELECT * FROM collections WHERE id = ?", id)) as any;
    if (!existing) return notFound(res, "Collection not found");
    await db.run(
      "UPDATE collections SET name = ?, icon = ?, color = ?, parent_id = ?, sort_order = ?, space_id = ? WHERE id = ?",
      name ?? existing.name,
      icon ?? existing.icon,
      color ?? existing.color,
      parent_id !== undefined ? (parent_id || null) : existing.parent_id,
      sort_order !== undefined ? sort_order : existing.sort_order,
      space_id ?? existing.space_id,
      id
    );
    const collection = await db.get("SELECT * FROM collections WHERE id = ?", id);
    if (!collection) return notFound(res, "Collection not found");
    sendJson(res, collection);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.put("/collections/reorder", async (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return badRequest(res, "orders array is required");
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      for (let i = 0; i < orders.length; i++) {
        await db.run("UPDATE collections SET sort_order = ? WHERE id = ?", i, orders[i]);
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

router.delete("/collections/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'inbox-collection') return sendError(res, "Cannot delete system Inbox collection", 403);
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("UPDATE collections SET parent_id = NULL WHERE parent_id = ?", id);
      await db.run("DELETE FROM bookmark_collections WHERE collection_id = ?", id);
      const orphaned = (await db.all(`
        SELECT b.id FROM bookmarks b
        LEFT JOIN bookmark_collections bc ON bc.bookmark_id = b.id
        WHERE b.is_deleted = 0 AND bc.bookmark_id IS NULL
      `)) as { id: string }[];
      for (const o of orphaned) {
        await db.run(
          "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
          o.id,
          "inbox-collection"
        );
      }
      const result = await db.run("DELETE FROM collections WHERE id = ?", id);
      if ((result?.changes ?? 0) === 0) throw new Error("Collection not found");
      await db.run("COMMIT");
    } catch (e: any) {
      await db.run("ROLLBACK").catch(() => {});
      throw e;
    }
    sendJson(res, { success: true });
  } catch (error: any) {
    if (error.message === "Collection not found") return notFound(res, error.message);
    internalError(res, error);
  }
});

router.get("/bookmarks/:id/collections", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const collections = await db.all(`
      SELECT c.* FROM collections c
      JOIN bookmark_collections bc ON c.id = bc.collection_id
      WHERE bc.bookmark_id = ? ORDER BY c.name
    `, id);
    res.json(collections);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/collections/:collectionId/bookmarks", async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { bookmarkIds, replace } = req.body;
    if (!Array.isArray(bookmarkIds)) return badRequest(res, "bookmarkIds array is required");
    if (!(await validateCollectionIds([collectionId]))) return notFound(res, "Collection not found");
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      for (const bmId of bookmarkIds) {
        if (replace) {
          await db.run("DELETE FROM bookmark_collections WHERE bookmark_id = ?", bmId);
        }
        await db.run(
          "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
          bmId,
          collectionId
        );
        await db.run(
          "UPDATE bookmarks SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 1",
          bmId
        );
      }
      await db.run("COMMIT");
    } catch (e) {
      await db.run("ROLLBACK").catch(() => {});
      throw e;
    }
    sendJson(res, { success: true, count: bookmarkIds.length });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/:id/collections/:collectionId", async (req, res) => {
  try {
    const { id, collectionId } = req.params;
    if (!(await validateCollectionIds([collectionId]))) return notFound(res, "Collection not found");
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
        id,
        collectionId
      );
      await db.run(
        "UPDATE bookmarks SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 1",
        id
      );
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

router.post("/bookmarks/:id/collections", async (req, res) => {
  try {
    const { id } = req.params;
    const { collectionIds } = req.body;
    if (!Array.isArray(collectionIds)) return badRequest(res, "collectionIds array is required");
    if (collectionIds.length > 0 && !(await validateCollectionIds(collectionIds))) {
      return badRequest(res, "One or more collections not found");
    }
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("DELETE FROM bookmark_collections WHERE bookmark_id = ?", id);
      for (const colId of collectionIds) {
        await db.run(
          "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
          id,
          colId
        );
      }
      await db.run(
        "UPDATE bookmarks SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 1",
        id
      );
      await db.run("COMMIT");
    } catch (e) {
      await db.run("ROLLBACK").catch(() => {});
      throw e;
    }
    const collections = await db.all(`
      SELECT c.* FROM collections c
      JOIN bookmark_collections bc ON c.id = bc.collection_id
      WHERE bc.bookmark_id = ?
    `, id);
    sendJson(res, { success: true, collections });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/bookmarks/:id/collections/:collectionId", async (req, res) => {
  try {
    const { id, collectionId } = req.params;
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "DELETE FROM bookmark_collections WHERE bookmark_id = ? AND collection_id = ?",
        id,
        collectionId
      );
      const hasCollections = await db.get(
        "SELECT 1 FROM bookmark_collections WHERE bookmark_id = ? LIMIT 1",
        id
      );
      if (!hasCollections) {
        await db.run(
          "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
          id,
          "inbox-collection"
        );
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
