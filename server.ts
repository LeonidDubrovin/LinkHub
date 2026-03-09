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
