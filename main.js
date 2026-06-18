const { app, BaseWindow, WebContentsView, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// ---- Constants -------------------------------------------------------------
const TOOLBAR_HEIGHT = 44;          // compact toolbar
const DEFAULT_HOME = 'https://www.youtube.com';  // default start/home page
const DEFAULT_RATIO = '4:3';        // default window ratio "width:height"
const DEFAULT_THEME = 'dark';       // default toolbar color theme
const THEMES = ['dark', 'white', 'pink', 'sky', 'purple', 'green', 'ivory'];

let baseWindow = null;   // the frameless container window
let toolbarView = null;  // our custom UI (index.html)
let contentView = null;  // the actual website
let settingsOpen = false; // is the settings panel expanded?
let htmlFullscreen = false; // is the website in HTML5 fullscreen (e.g. a video)?

// Back/forward API moved to `webContents.navigationHistory` in Electron 35+.
// This helper works on both the new and the older (<=34) APIs.
function nav(wc) {
  const h = wc.navigationHistory;
  if (h && typeof h.canGoBack === 'function') {
    return {
      canGoBack: () => h.canGoBack(),
      canGoForward: () => h.canGoForward(),
      goBack: () => h.goBack(),
      goForward: () => h.goForward(),
    };
  }
  return {
    canGoBack: () => wc.canGoBack(),
    canGoForward: () => wc.canGoForward(),
    goBack: () => wc.goBack(),
    goForward: () => wc.goForward(),
  };
}

// ---- Tiny "no database" persistence ---------------------------------------
function storeFile() {
  return path.join(app.getPath('userData'), 'floaty-state.json');
}

// In-memory copy of persisted state: { lastUrl, homeUrl, ratio, theme }
let state = { lastUrl: '', homeUrl: DEFAULT_HOME, ratio: DEFAULT_RATIO, theme: DEFAULT_THEME };

function loadState() {
  try {
    const raw = fs.readFileSync(storeFile(), 'utf-8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      if (typeof data.homeUrl === 'string' && data.homeUrl) state.homeUrl = data.homeUrl;
      if (typeof data.lastUrl === 'string' && data.lastUrl) state.lastUrl = data.lastUrl;
      if (typeof data.ratio === 'string' && /^\d+:\d+$/.test(data.ratio)) state.ratio = data.ratio;
      if (typeof data.theme === 'string' && THEMES.includes(data.theme)) state.theme = data.theme;
    }
  } catch (_) {
    // first run or unreadable file -> keep defaults
  }
  return state;
}

function persist() {
  try {
    fs.writeFileSync(storeFile(), JSON.stringify(state), 'utf-8');
  } catch (_) {
    // ignore write errors (e.g. read-only disk); not critical
  }
}

function saveLastUrl(url) {
  state.lastUrl = url;
  persist();
}

function getHome() {
  return state.homeUrl || DEFAULT_HOME;
}

function setHome(url) {
  const normalized = normalizeUrl(url);
  state.homeUrl = normalized || DEFAULT_HOME;
  persist();
  return state.homeUrl;
}

function getTheme() {
  return THEMES.includes(state.theme) ? state.theme : DEFAULT_THEME;
}

function setTheme(theme) {
  state.theme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  persist();
  return state.theme;
}

// Whether the app launches automatically when the computer starts (the OS
// stores this, so it doesn't need to live in our own state file).
function getLaunchAtLogin() {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch (_) {
    return false;
  }
}

function setLaunchAtLogin(on) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on });
  } catch (_) {
    // not supported on this platform / sandbox -> ignore
  }
}

function getRatio() {
  return state.ratio || DEFAULT_RATIO;
}

// Apply a "w:h" ratio: lock future resizing to it and resize the current
// window (keeping its width) to match.
function applyRatio(str) {
  const m = /^(\d+):(\d+)$/.exec(str || '');
  if (!m) return;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return;

  state.ratio = `${w}:${h}`;
  persist();

  if (!windowAlive()) return;
  baseWindow.setAspectRatio(w / h);

  const b = baseWindow.getBounds();
  baseWindow.setBounds({
    x: b.x,
    y: b.y,
    width: b.width,
    height: Math.round(b.width * h / w),
  });
}

// ---- URL helpers -----------------------------------------------------------
function normalizeUrl(input) {
  let url = (input || '').trim();
  if (!url) return null;

  // Already a full URL
  if (/^https?:\/\//i.test(url)) return url;

  // Looks like a domain (has a dot, no spaces) -> assume https
  if (/^[^\s]+\.[^\s]+$/.test(url)) return 'https://' + url;

  // Otherwise treat it as a search query
  return 'https://www.google.com/search?q=' + encodeURIComponent(url);
}

// ---- Layout ----------------------------------------------------------------
function layoutViews() {
  if (!baseWindow) return;
  const { width, height } = baseWindow.getContentBounds();

  if (htmlFullscreen) {
    // Video/page fullscreen: the website fills the entire window box,
    // covering the toolbar — but it stays inside our window, not the screen.
    contentView.setBounds({ x: 0, y: 0, width, height });
    return;
  }

  // Settings open: the toolbar view expands over the whole window so its
  // (opaque) settings panel hides the website behind it.
  if (settingsOpen) {
    toolbarView.setBounds({ x: 0, y: 0, width, height });
    return;
  }

  // Normal: toolbar on top, website fills the rest.
  toolbarView.setBounds({ x: 0, y: 0, width, height: TOOLBAR_HEIGHT });
  contentView.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width,
    height: Math.max(0, height - TOOLBAR_HEIGHT),
  });
}

// ---- Send navigation state to the toolbar ---------------------------------
function sendNavState() {
  if (!toolbarView || !contentView) return;
  if (toolbarView.webContents.isDestroyed() || contentView.webContents.isDestroyed()) return;
  const wc = contentView.webContents;
  toolbarView.webContents.send('nav-state', {
    url: wc.getURL(),
    canGoBack: nav(wc).canGoBack(),
    canGoForward: nav(wc).canGoForward(),
    isLoading: wc.isLoading(),
  });
}

// ---- App bootstrap ---------------------------------------------------------
function createWindow() {
  loadState();

  // Initial size derived from the saved ratio (base width 640).
  const [rw, rh] = getRatio().split(':').map(Number);
  const initialWidth = 640;
  const initialHeight = Math.round(initialWidth * rh / rw);

  baseWindow = new BaseWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: 320,
    minHeight: 240,
    frame: false,            // frameless so we can drag via the toolbar
    alwaysOnTop: true,       // <-- always stay on top
    resizable: true,         // <-- resizable
    fullscreenable: false,   // keep HTML5 fullscreen inside our window box
    title: 'Floaty',
  });

  // Always stay above other windows (even full-screen apps where possible).
  baseWindow.setAlwaysOnTop(true, 'screen-saver');

  // Lock the window to the saved ratio while resizing.
  baseWindow.setAspectRatio(rw / rh);

  // 1) Toolbar UI view
  toolbarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  toolbarView.webContents.loadFile('index.html');

  // 2) Website content view
  contentView = new WebContentsView();

  baseWindow.contentView.addChildView(toolbarView);
  baseWindow.contentView.addChildView(contentView);

  layoutViews();
  baseWindow.on('resize', layoutViews);

  // Load the last visited site (or the home page on first run)
  const startUrl = state.lastUrl || getHome();
  contentView.webContents.loadURL(startUrl);

  // Wire up content events -> toolbar + persistence
  const wc = contentView.webContents;
  wc.on('did-navigate', (_e, url) => { saveLastUrl(url); sendNavState(); });
  wc.on('did-navigate-in-page', () => sendNavState());
  wc.on('did-start-loading', sendNavState);
  wc.on('did-stop-loading', sendNavState);
  wc.on('page-title-updated', sendNavState);

  // Keep HTML5 fullscreen (e.g. a YouTube video) confined to our window box
  // instead of taking over the whole screen.
  wc.on('enter-html-full-screen', () => {
    htmlFullscreen = true;
    if (windowAlive()) baseWindow.contentView.addChildView(contentView); // bring to front
    layoutViews();
  });
  wc.on('leave-html-full-screen', () => {
    htmlFullscreen = false;
    layoutViews();
  });

  // Open target="_blank" / external windows in the same view instead of popups
  wc.setWindowOpenHandler(({ url }) => {
    wc.loadURL(url);
    return { action: 'deny' };
  });

  baseWindow.on('closed', () => {
    baseWindow = null;
    toolbarView = null;
    contentView = null;
  });
}

// ---- IPC from toolbar UI ---------------------------------------------------
// These handlers are global and can, in principle, fire while the window is
// tearing down. Guard against a missing/destroyed window or content view.
function windowAlive() {
  return baseWindow && !baseWindow.isDestroyed();
}

function contentWc() {
  if (contentView && !contentView.webContents.isDestroyed()) {
    return contentView.webContents;
  }
  return null;
}

ipcMain.on('navigate', (_e, rawUrl) => {
  const wc = contentWc();
  const url = normalizeUrl(rawUrl);
  if (wc && url) wc.loadURL(url);
});

ipcMain.on('back', () => {
  const wc = contentWc();
  if (wc && nav(wc).canGoBack()) nav(wc).goBack();
});

ipcMain.on('forward', () => {
  const wc = contentWc();
  if (wc && nav(wc).canGoForward()) nav(wc).goForward();
});

ipcMain.on('reload', () => {
  const wc = contentWc();
  if (wc) wc.reload();
});

ipcMain.on('home', () => {
  const wc = contentWc();
  if (wc) wc.loadURL(getHome());
});

// ---- Settings panel --------------------------------------------------------
ipcMain.on('get-home', (e) => { e.returnValue = getHome(); });

ipcMain.on('set-home', (_e, url) => { setHome(url); });

ipcMain.on('get-ratio', (e) => { e.returnValue = getRatio(); });

ipcMain.on('set-ratio', (_e, ratio) => { applyRatio(ratio); });

ipcMain.on('get-theme', (e) => { e.returnValue = getTheme(); });

ipcMain.on('set-theme', (_e, theme) => { setTheme(theme); });

ipcMain.on('get-launch', (e) => { e.returnValue = getLaunchAtLogin(); });

ipcMain.on('set-launch', (_e, on) => { setLaunchAtLogin(on); });

// Open external links (e.g. the credit) in the user's default browser.
ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.on('open-settings', () => {
  if (!windowAlive()) return;
  settingsOpen = true;
  baseWindow.contentView.addChildView(toolbarView); // bring toolbar to front
  layoutViews();
});

ipcMain.on('close-settings', () => {
  if (!windowAlive()) return;
  settingsOpen = false;
  layoutViews();
});

ipcMain.on('minimize', () => {
  if (windowAlive()) baseWindow.minimize();
});

ipcMain.on('close', () => {
  if (windowAlive()) baseWindow.close();
});

// ---- Lifecycle -------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
