import "dotenv/config";
import express from "express";
import apiRoutes from "./server/routes/api.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

app.use(express.json());

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

// API Routes
app.use("/api", apiRoutes);

export async function startServer(isElectron = false) {
  if (process.env.NODE_ENV !== "production" && !isElectron) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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

  return new Promise<void>((resolve) => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      resolve();
    });
  });
}

// Only start automatically if not imported by Electron
if (process.env.START_SERVER !== "false") {
  startServer();
}
