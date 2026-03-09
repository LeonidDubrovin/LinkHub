import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startServer } from "../server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverStarted = false;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "LinkHub",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

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
