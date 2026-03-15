import { app, BrowserWindow, globalShortcut } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverStarted = false;
let serverPort = 3000;

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
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Ensure menu bar is completely removed
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Start the Express server only once, and ONLY in production
  // In development, npm run dev starts the server in Node.js to avoid native module ABI mismatches
  if (app.isPackaged && !serverStarted) {
    try {
      const { startServer } = await import("../server.js");
      serverPort = await startServer(true);
      serverStarted = true;
    } catch (e) {
      console.error("Failed to start server:", e);
    }
  }

  // Load the web app
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    if (mainWindow) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="font-family: sans-serif; padding: 2rem; text-align: center; background: #f8f9fa; color: #333;">
            <h1 style="color: #e11d48;">Failed to connect to local server</h1>
            <p>Error: ${errorCode} (${errorDescription})</p>
            <p>The local server might have crashed or failed to start.</p>
            <p>Press <b>F12</b> to open Developer Tools and check the console.</p>
          </body>
        </html>
      `);
    }
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('WebContents crashed');
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

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
