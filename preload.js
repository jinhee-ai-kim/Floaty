const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the toolbar UI (index.html).
contextBridge.exposeInMainWorld('floaty', {
  navigate: (url) => ipcRenderer.send('navigate', url),
  back: () => ipcRenderer.send('back'),
  forward: () => ipcRenderer.send('forward'),
  reload: () => ipcRenderer.send('reload'),
  home: () => ipcRenderer.send('home'),
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close'),

  // Settings / home page
  getHome: () => ipcRenderer.sendSync('get-home'),
  setHome: (url) => ipcRenderer.send('set-home', url),
  getRatio: () => ipcRenderer.sendSync('get-ratio'),
  setRatio: (ratio) => ipcRenderer.send('set-ratio', ratio),
  getTheme: () => ipcRenderer.sendSync('get-theme'),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getLaunch: () => ipcRenderer.sendSync('get-launch'),
  setLaunch: (on) => ipcRenderer.send('set-launch', on),
  openSettings: () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),

  // Receive navigation state updates from the main process.
  onNavState: (callback) =>
    ipcRenderer.on('nav-state', (_e, state) => callback(state)),
});
