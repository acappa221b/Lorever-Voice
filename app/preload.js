// The only doors between the page and the app.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  data: () => ipcRenderer.invoke("data"),
  project: () => ipcRenderer.invoke("project"),
  setNarrator: (name) => ipcRenderer.invoke("narrator", name),
  save: (id, index, samples) => ipcRenderer.invoke("save", id, index, samples),
  audio: (id) => ipcRenderer.invoke("audio", id),
  remove: (id) => ipcRenderer.invoke("remove", id),
  exportPack: () => ipcRenderer.invoke("export"),
  openFolder: () => ipcRenderer.invoke("open-folder"),
});
