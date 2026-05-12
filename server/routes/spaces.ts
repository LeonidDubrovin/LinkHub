import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db.ts";
import {
  sendJson,
  sendError,
  notFound,
  badRequest,
  internalError,
} from "../utils/api.ts";

const router = express.Router();

router.get("/spaces", async (req, res) => {
  try {
    const db = await getDb();
    const spaces = await db.all(`
      SELECT s.*, COUNT(c.id) as collectionCount
      FROM spaces s
      LEFT JOIN collections c ON c.space_id = s.id
      GROUP BY s.id
      ORDER BY s.name
    `);
    res.json(spaces);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/spaces", async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) return badRequest(res, "Name is required");
    const id = uuidv4();
    const db = await getDb();
    await db.run("INSERT INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)", id, name, icon || null, color || null);
    const space = await db.get("SELECT * FROM spaces WHERE id = ?", id);
    sendJson(res, space);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.put("/spaces/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;
    const db = await getDb();
    await db.run("UPDATE spaces SET name = ?, icon = ?, color = ? WHERE id = ?", name, icon, color, id);
    const space = await db.get("SELECT * FROM spaces WHERE id = ?", id);
    if (!space) return notFound(res, "Space not found");
    sendJson(res, space);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/spaces/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'inbox-space') return sendError(res, "Cannot delete system Inbox space", 403);
    const db = await getDb();
    const result = await db.run("DELETE FROM spaces WHERE id = ?", id);
    if ((result?.changes ?? 0) === 0) return notFound(res, "Space not found");
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

export default router;
