const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");

function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1100,
        minHeight: 700,
        autoHideMenuBar: true,
        title: "Sprechfunk Uebung",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "preload.cjs")
        }
    });

    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
