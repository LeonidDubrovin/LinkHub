import "dotenv/config";
import express from "express";
import apiRoutes from "./server/routes/api.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 8400;
const PORT_POOL = Array.from({ length: 100 }, (_, i) => PORT + i);
const PORT_FILE = path.join(process.cwd(), ".server-port");

app.use(express.json({ limit: "50mb" }));

// Proxy Cloudflare challenge requests
app.all("/cdn-cgi/*", async (req, res) => {
  try {
    // Try to determine the target domain from the Referer header
    const referer = req.headers.referer;
    let targetOrigin = "";

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        // If referer is our proxy, extract the target URL
        if (refererUrl.pathname === "/api/proxy" && refererUrl.searchParams.has("url")) {
          const targetUrl = new URL(refererUrl.searchParams.get("url")!);
          targetOrigin = targetUrl.origin;
        } else {
          // If referer is already the target domain (unlikely in this setup, but possible)
          targetOrigin = refererUrl.origin;
        }
      } catch (e) {}
    }

    if (!targetOrigin) {
      return res.status(400).send("Could not determine target origin for Cloudflare proxy");
    }

    const targetUrl = `${targetOrigin}${req.originalUrl}`;

    const headers: Record<string, string> = {
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      "Accept": req.headers["accept"] || "*/*",
      "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.5",
      "Content-Type": req.headers["content-type"] || "",
    };

    if (req.headers.cookie) {
      headers["Cookie"] = req.headers.cookie;
    }

    // Forward the request to Cloudflare
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      // Only forward body if it exists and is not a GET/HEAD request
      // Note: express.json() might have parsed the body, so we need to stringify it if it's an object
      body: req.method !== "GET" && req.method !== "HEAD" ?
        (typeof req.body === 'object' && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : req.body)
        : undefined,
    });

    // Forward headers back to client
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'transfer-encoding', 'x-frame-options', 'content-security-policy', 'set-cookie'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    // Forward Set-Cookie properly
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) {
        res.setHeader("Set-Cookie", cookies);
      }
    } else {
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        res.setHeader("Set-Cookie", setCookie);
      }
    }

    res.status(response.status);

    // Pipe the response body
    if (response.body) {
      // Convert Web ReadableStream to Node Readable stream
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      pump().catch(err => {
        console.error("Error pumping Cloudflare response:", err);
        res.end();
      });
    } else {
      res.end();
    }
  } catch (error: any) {
    res.status(500).send(`Cloudflare proxy failed: ${error.message}`);
  }
});

// API Routes - mounted BEFORE Vite middleware in dev mode so Express handles them directly
app.use("/api", apiRoutes);

export async function startServer(isElectron = false): Promise<number> {
  if (process.env.NODE_ENV !== "production" && !isElectron) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Vite middleware handles non-API requests (SPA serving, HMR, etc.)
    // API routes are already handled above by Express
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = await import("fs/promises").then(fs => fs.readFile(path.resolve(__dirname, "index.html"), "utf-8"));
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
    const distPath = __dirname.endsWith("dist-electron")
      ? path.join(__dirname, "../dist")
      : path.join(__dirname, "dist");

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
