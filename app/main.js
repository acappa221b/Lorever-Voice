// Lorever Voice Studio: the window, the files, and nothing else.
// The app never touches the game: it does not read the screen, does not run
// beside the game, and never writes into the game's folder. It saves takes in
// its own folder and, on Export, writes a zip where the narrator chooses.

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const audio = require("./audio");
const pack = require("./pack");

const LANGUAGE = "enUS";
let win;

function home() {
  const dir = path.join(app.getPath("userData"), "narration", LANGUAGE);
  fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  return dir;
}

function projectFile() {
  return path.join(home(), "project.json");
}

function loadProject() {
  try {
    return JSON.parse(fs.readFileSync(projectFile(), "utf8"));
  } catch {
    return { narrator: "", recordings: {} };
  }
}

function saveProject(project) {
  const tmp = projectFile() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(project, null, 1));
  fs.renameSync(tmp, projectFile());
}

function audioFile(id) {
  if (!/^[0-9a-f]{16}$/.test(id)) throw new Error("bad section id");
  return path.join(home(), "audio", `${id}.mp3`);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#262624",
    title: "Lorever Voice Studio",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("data", () => JSON.parse(fs.readFileSync(path.join(__dirname, "data", `${LANGUAGE}.json`), "utf8")));
ipcMain.handle("project", () => loadProject());

ipcMain.handle("narrator", (_, name) => {
  const p = loadProject();
  p.narrator = String(name || "").slice(0, 40);
  saveProject(p);
  return p.narrator;
});

// A take arrives as Float32 samples: trim, encode, save. Returns its length.
ipcMain.handle("save", async (_, id, index, samples) => {
  const trimmed = audio.trim(Float32Array.from(samples));
  if (trimmed.length < audio.SAMPLE_RATE * 0.3) return { ok: false, reason: "silent" };
  const { mp3, seconds } = await audio.encode(trimmed);
  fs.writeFileSync(audioFile(id), mp3);
  const p = loadProject();
  p.recordings[id] = { index, seconds: Math.round(seconds * 100) / 100, at: Date.now() };
  saveProject(p);
  return { ok: true, seconds: p.recordings[id].seconds };
});

ipcMain.handle("audio", (_, id) => {
  const file = audioFile(id);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
});

ipcMain.handle("remove", (_, id) => {
  const file = audioFile(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const p = loadProject();
  delete p.recordings[id];
  saveProject(p);
  return true;
});

ipcMain.handle("export", async () => {
  const p = loadProject();
  const ids = Object.keys(p.recordings).filter((id) => fs.existsSync(audioFile(id)));
  if (ids.length === 0) return { ok: false, reason: "empty" };
  const n = pack.names(LANGUAGE, p.narrator || "Narrator");
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Export your voice pack",
    defaultPath: path.join(app.getPath("desktop"), `${n.folder}.zip`),
    filters: [{ name: "Zip", extensions: ["zip"] }],
  });
  if (canceled || !filePath) return { ok: false, reason: "canceled" };
  const recordings = ids.map((id) => ({ id, index: p.recordings[id].index, seconds: p.recordings[id].seconds }));
  const version = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  const result = await pack.buildZip(LANGUAGE, p.narrator || "Narrator", recordings, async (id) => fs.readFileSync(audioFile(id)), version);
  fs.writeFileSync(filePath, result.buffer);
  shell.showItemInFolder(filePath);
  return { ok: true, file: filePath, folder: result.folder, count: result.count };
});

ipcMain.handle("open-folder", () => shell.openPath(home()));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => app.quit());
