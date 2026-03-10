import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverStarted = false;

async function createWindow() {
  // Set DATA_DIR before starting the server so the DB is stored in the user data folder
  process.env.DATA_DIR = app.getPath("userData");

  const { startServer } = await import("../server.js");

  // Determine icon path (dist in prod, public in dev)
  let iconPath = path.join(__dirname, "../dist/icon-clean.png");
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, "../public/icon-clean.png");
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
