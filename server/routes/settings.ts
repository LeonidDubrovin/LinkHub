import express from "express";
import db, { getDataDir } from "../db.ts";
import { getConfig, saveConfig } from "../config.ts";
import { CategorizationService } from "../services/categorizer.ts";
import fs from "fs";
import path from "path";
import {
  sendJson,
  sendError,
  badRequest,
  internalError,
} from "../utils/api.ts";

const router = express.Router();
const categorizer = new CategorizationService();

router.get("/settings", (req, res) => {
  const config = getConfig();
  sendJson(res, {
    dataDir: getDataDir(),
    userAgent: config.userAgent || "Mozilla/5.0 (compatible; Twitterbot/1.0)",
    llm: {
      enabled: config.llm?.enabled ?? false,
      provider: config.llm?.provider ?? 'openrouter',
      apiKey: config.llm?.apiKey ? '••••••••' + config.llm.apiKey.slice(Math.max(0, config.llm.apiKey.length - 4)) : '',
      model: config.llm?.model ?? 'stepfun/step-3.5-flash:free',
      autoCategorizeOnAdd: config.llm?.autoCategorizeOnAdd ?? true,
      fallbackToLocal: config.llm?.fallbackToLocal ?? true
    },
    localHeuristics: {
      enabled: config.localHeuristics?.enabled ?? true,
      domainCategoryRules: config.localHeuristics?.domainCategoryRules ?? {
        "youtube.com": "Videos",
        "youtu.be": "Videos",
        "github.com": "Programming",
        "npmjs.com": "Programming",
        "dribbble.com": "Design",
        "behance.com": "Design"
      }
    }
  });
});

router.post("/settings", (req, res) => {
  try {
    let { dataDir, userAgent, llm, localHeuristics } = req.body;
    if (!dataDir) return badRequest(res, "dataDir is required");
    dataDir = path.resolve(dataDir);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const config = getConfig();
    config.dataDir = dataDir;
    if (userAgent !== undefined) config.userAgent = userAgent;
    if (llm !== undefined) config.llm = llm;
    if (localHeuristics !== undefined) config.localHeuristics = localHeuristics;
    saveConfig(config);
    const currentDbPath = path.join(getDataDir(), "bookmarks.db");
    const newDbPath = path.join(dataDir, "bookmarks.db");
    if (fs.existsSync(currentDbPath) && !fs.existsSync(newDbPath)) {
      fs.copyFileSync(currentDbPath, newDbPath);
    }
    sendJson(res, { success: true, message: "Settings saved. Please restart the application to fully apply changes." });
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/llm/test-connection", async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    if (!apiKey) return badRequest(res, "API key required");
    if (provider === 'openrouter') {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (response.ok) {
        sendJson(res, { success: true, message: "Connected to OpenRouter successfully" });
      } else {
        const error = await response.text();
        sendJson(res, { success: false, error: `OpenRouter error: ${error}` }, 400);
      }
    } else {
      badRequest(res, `Unsupported provider: ${provider}`);
    }
  } catch (error: any) {
    internalError(res, error);
  }
});

router.get("/categorization/stats", (req, res) => {
  try {
    sendJson(res, categorizer.getStats());
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/:id/categorize", async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.body;
    const result = await categorizer.categorizeBookmark(id, force ?? false);
    if (result.success) {
      const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as any;
      sendJson(res, { success: true, bookmark });
    } else {
      badRequest(res, result.error);
    }
  } catch (error: any) {
    internalError(res, error);
  }
});

router.post("/bookmarks/categorize-all", async (req, res) => {
  try {
    const { onlyUntagged = true } = req.body;
    const result = await categorizer.categorizeAll(onlyUntagged);
    sendJson(res, result);
  } catch (error: any) {
    internalError(res, error);
  }
});

export default router;
