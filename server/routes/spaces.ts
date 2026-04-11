import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.ts";
import {
  sendJson,
  sendError,
  notFound,
  badRequest,
  internalError,
} from "../utils/api.ts";

const router = express.Router();

router.get("/spaces", (req, res) => {
  try {
    const spaces = db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM collections WHERE space_id = s.id) as collectionCount
      FROM spaces s ORDER BY s.name
    `).all();
    res.json(spaces);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/spaces", (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) return badRequest(res, "Name is required");
    const id = uuidv4();
    db.prepare("INSERT INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)").run(id, name, icon || null, color || null);
    const space = db.prepare("SELECT * FROM spaces WHERE id = ?").get(id);
    sendJson(res, space);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.put("/spaces/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;
    db.prepare("UPDATE spaces SET name = ?, icon = ?, color = ? WHERE id = ?").run(name, icon, color, id);
    const space = db.prepare("SELECT * FROM spaces WHERE id = ?").get(id);
    if (!space) return notFound(res, "Space not found");
    sendJson(res, space);
  } catch (error: any) {
    internalError(res, error);
  }
});

router.delete("/spaces/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'inbox-space') return sendError(res, "Cannot delete system Inbox space", 403);
    const result = db.prepare("DELETE FROM spaces WHERE id = ?").run(id);
    if (result.changes === 0) return notFound(res, "Space not found");
    sendJson(res, { success: true });
  } catch (error: any) {
    internalError(res, error);
  }
});

export default router;
