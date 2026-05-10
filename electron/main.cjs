const { app, BrowserWindow, globalShortcut, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let serverStarted = false;
let serverPort = 38472;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

async function createWindow() {
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
      process.env.DATA_DIR = path.join(exeDir, "data");
    } else {
      process.env.DATA_DIR = path.join(process.cwd(), "data");
    }
  }

  let iconPath = path.join(__dirname, "../dist/icon.png");
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, "../public/icon.png");
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "LinkHub",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Start the Express server only once, and ONLY in production
  // In development, npm run dev starts the server in Node.js to avoid native module ABI mismatches
  if (app.isPackaged && !serverStarted) {
    try {
      const { startServer } = await import("./server.js");
      serverPort = await startServer(true);
      serverStarted = true;
    } catch (e) {
      console.error("Failed to start server:", e);
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="font-family: sans-serif; padding: 2rem; text-align: center; background: #f8f9fa; color: #333;">
            <h1 style="color: #e11d48;">Fatal Error: Server Failed to Start</h1>
            <p>The internal server encountered an error and could not start.</p>
            <p>Error details: ${e.message || String(e)}</p>
            <p>Press <b>F12</b> to open Developer Tools and check the console.</p>
          </body>
        </html>
      `);
      return;
    }
  } else if (!app.isPackaged && !serverStarted) {
    const portFile = path.join(process.cwd(), ".server-port");
    try {
      const portStr = fs.readFileSync(portFile, "utf-8").trim();
      serverPort = parseInt(portStr, 10);
      console.log("Dev server port from file:", serverPort);
    } catch {
      serverPort = 3070;
      console.log("Port file not found, falling back to default port 3070");
    }
    serverStarted = true;
  }

  const appUrl = `http://127.0.0.1:${serverPort}`;
  console.log("Loading app from:", appUrl);
  mainWindow.loadURL(appUrl);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('context-menu', (e, props) => {
    const menu = Menu.buildFromTemplate([
     {
       label: 'Inspect Element',
       click: () => {
         mainWindow?.webContents.inspectElement(props.x, props.y);
       }
     },
     {
       label: 'Toggle Developer Tools',
       click: () => {
         mainWindow?.webContents.toggleDevTools();
       }
     },
     {
       label: 'Reload',
       click: () => {
         mainWindow?.webContents.reload();
       }
     }
   ]);
   menu.popup();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // ERR_ABORTED — normal on HMR reload, refresh, or close
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

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('WebContents crashed or was killed:', details.reason);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Single instance lock - focus existing window if another instance is launched
  const gotLock = app.requestSingleInstanceLock();

  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  createWindow();
  globalShortcut.register('CommandOrControl+Shift+I', () => mainWindow?.webContents.toggleDevTools());
  globalShortcut.register('F12', () => mainWindow?.webContents.toggleDevTools());
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
