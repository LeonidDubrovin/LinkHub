import express from "express";
import { getFaviconPath, downloadAndCacheFavicon } from "../services/scraper.js";
import { getDb } from "../db.js";
import fs from "fs";

import spacesRoutes from "./spaces.js";
import collectionsRoutes from "./collections.js";
import bookmarksRoutes from "./bookmarks.js";
import settingsRoutes from "./settings.js";
import proxyRoutes from "./proxy.js";
import backupRoutes from "./backup.js";

const router = express.Router();

router.use(spacesRoutes);
router.use(collectionsRoutes);
router.use(bookmarksRoutes);
router.use(settingsRoutes);
router.use(proxyRoutes);
router.use(backupRoutes);

router.get("/tags", async (req, res) => {
  try {
    const db = await getDb();
    const tags = await db.all(`
      SELECT t.*, COUNT(bt.bookmark_id) as bookmarkCount
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      LEFT JOIN bookmarks b ON bt.bookmark_id = b.id AND b.is_deleted = 0
      GROUP BY t.id
      ORDER BY bookmarkCount DESC, t.name
    `);
    res.json(tags);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function sanitizeDomain(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9._-]/g, "");
}

router.get("/favicons/:domain", async (req, res) => {
  const rawDomain = req.params.domain;
  const domain = sanitizeDomain(rawDomain);
  if (!domain) {
    return res.status(400).send("Invalid domain");
  }
  const filePath = getFaviconPath(domain);

  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return res.sendFile(filePath);
  }

  const success = await downloadAndCacheFavicon(domain);
  if (success && fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  res.status(204).end();
});

export default router;
