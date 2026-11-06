const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { registerSetupHandlers } = require("./setup-ipc");

const webOrigin = app.isPackaged ? "https://devlink.ai.kr" : "http://localhost:5173";

function openExternal(url) {
  const target = URL.parse(url);
  if (target && ["http:", "https:"].includes(target.protocol) && !target.username && !target.password) {
    void shell.openExternal(target.href).catch(() => {});
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--devlink-version=${app.getVersion()}`, `--devlink-origin=${webOrigin}`],
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => {
    if (URL.parse(event.url)?.origin === webOrigin) return;
    event.preventDefault();
    openExternal(event.url);
  });
  window.webContents.on("will-redirect", (event) => {
    if (event.isMainFrame && URL.parse(event.url)?.origin !== webOrigin) event.preventDefault();
  });

  if (!app.isPackaged) registerSetupHandlers(window, webOrigin);

  void window.loadURL(webOrigin).catch(() => {
    if (!window.isDestroyed()) return window.loadFile(path.join(__dirname, "offline.html"));
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
