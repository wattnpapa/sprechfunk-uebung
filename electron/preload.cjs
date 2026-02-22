const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronApp", {
    isElectron: true,
    versions: process.versions
});
