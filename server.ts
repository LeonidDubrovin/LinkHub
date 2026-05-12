import "dotenv/config";
import express from "express";
import apiRoutes from "./server/routes/api.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export const app = express();
const PORT = 8400;
const PORT_POOL = Array.from({ length: 100 }, (_, i) => PORT + i);
const PORT_FILE = path.join(process.cwd(), ".server-port");

app.use(express.json({ limit: "50mb" }));

// API Routes - mounted BEFORE Vite middleware in dev mode so Express handles them directly
app.use("/api", apiRoutes);

export async function startServer(isElectron = false): Promise<number> {
  if (process.env.NODE_ENV !== "production" && !isElectron) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: 24679 } },
      appType: "spa",
    });
    // Vite middleware handles non-API requests (SPA serving, HMR, etc.)
    // API routes are already handled above by Express
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = await import("fs/promises").then(fs => fs.readFile(path.resolve(_dirname, "index.html"), "utf-8"));
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // In production or Electron, serve static files from dist
    // Resolve dist path depending on whether we are running bundled in dist-electron or directly
    const distPath = _dirname.endsWith("dist-electron")
      ? path.join(_dirname, "../dist")
      : path.join(_dirname, "dist");

    app.use(express.static(distPath));

    // Fallback for SPA routing
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return new Promise<number>((resolve, reject) => {
    if (isElectron) {
      const server = app.listen(0, "127.0.0.1", () => {
        const actualPort = (server.address() as any).port;
        console.log(`Server running on http://127.0.0.1:${actualPort}`);
        writePortFile(actualPort);
        resolve(actualPort);
      });
      server.on('error', (e: any) => reject(e));
      return;
    }

    const tryPort = (index: number) => {
      if (index >= PORT_POOL.length) {
        console.warn(`All ports in pool ${PORT_POOL.join(',')} are busy. Falling back to a random port.`);
        const fallbackServer = app.listen(0, "127.0.0.1", () => {
          const actualPort = (fallbackServer.address() as any).port;
          console.log(`Server running on http://127.0.0.1:${actualPort} (random)`);
          writePortFile(actualPort);
          resolve(actualPort);
        });
        fallbackServer.on('error', (e2: any) => reject(e2));
        return;
      }

      const port = PORT_POOL[index];
      const server = app.listen(port, "127.0.0.1", () => {
        const actualPort = (server.address() as any).port;
        console.log(`Server running on http://127.0.0.1:${actualPort}`);
        writePortFile(actualPort);
        resolve(actualPort);
      });

      server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE' || e.code === 'EACCES') {
          console.warn(`Port ${port} unavailable (${e.code}). Trying next...`);
          tryPort(index + 1);
        } else {
          console.error('Server error:', e);
          reject(e);
        }
      });
    };

    const envPort = parseInt(process.env.PORT || '', 10);
    if (envPort > 0) {
      PORT_POOL.unshift(envPort);
    }

    tryPort(0);
  });
}

function writePortFile(port: number) {
  try {
    fs.writeFileSync(PORT_FILE, String(port), "utf-8");
  } catch (e) {
    console.warn("Failed to write port file:", e);
  }
}

// Only start automatically if not imported by Electron
if (process.env.START_SERVER !== "false") {
  startServer();
}
