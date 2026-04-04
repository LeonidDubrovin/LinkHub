import express from "express";
import settingsRouter from "./settings.js";
import spacesRouter from "./spaces.js";
import collectionsRouter from "./collections.js";
import bookmarksRouter from "./bookmarks.js";
import proxyRouter from "./proxy.js";
import backupRouter from "./backup.js";

const router = express.Router();

router.use(settingsRouter);
router.use(spacesRouter);
router.use(collectionsRouter);
router.use(bookmarksRouter);
router.use(proxyRouter);
router.use(backupRouter);

export default router;
