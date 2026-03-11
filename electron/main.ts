import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverStarted = false;

async function createWindow() {
  // Set DATA_DIR before starting the server so the DB is stored in the correct location
  if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) {
    process.env.PORTABLE_EXECUTABLE_DIR = path.dirname(app.getPath("exe"));
  }
  
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  const configPath = path.join(exeDir, "linkhub.config.json");
  let customDataDir = null;
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.dataDir) {
        customDataDir = config.dataDir;
      }
    } catch (e) {
      console.error("Failed to read config:", e);
    }
  }

  if (!process.env.DATA_DIR) {
    if (customDataDir) {
      process.env.DATA_DIR = customDataDir;
    } else if (app.isPackaged) {
      // In production, store data next to the executable (portable mode)
      process.env.DATA_DIR = path.join(exeDir, "data");
    } else {
      // In development, store in the project root
      process.env.DATA_DIR = path.join(process.cwd(), "data");
    }
  }

  const { startServer } = await import("../server.js");

  // Determine icon path (dist in prod, public in dev)
  let iconPath = path.join(__dirname, "../dist/icon.png");
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, "../public/icon.png");
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "LinkHub",
    autoHideMenuBar: true, // Hide the top menu bar
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Ensure menu bar is completely removed
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Start the Express server only once
  if (!serverStarted) {
    await startServer(true);
    serverStarted = true;
  }

  // Load the web app
  mainWindow.loadURL("http://localhost:3000");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
