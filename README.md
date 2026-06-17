# Floaty 🪟

A minimal **always-on-top floating study browser** for Windows, built with Electron.

It's a small, resizable, draggable window that loads any website and stays on
top of everything else — perfect for keeping notes, docs, or a video pinned
while you work.

## Features

- Enter any website URL (or a search term) in the address bar
- Loads the site inside the window using Electron's `WebContentsView`
- **Always on top** of other windows (stays floating at all times)
- **Resizable** window with a selectable, locked **aspect ratio**
  (16:9, 4:3, 1:1, 3:4, 9:16)
- **Draggable** — grab the toolbar to move it anywhere
- **Back, Forward, Reload, Home** buttons
- **⚙ Settings** — choose your default home page (defaults to **YouTube**),
  the window ratio, the toolbar color theme, and whether Floaty **starts
  automatically when your computer turns on**
- **Video fullscreen, kept in the window** — pressing fullscreen on a YouTube
  (or any HTML5) video fills the whole Floaty window instead of taking over your
  screen, so it stays floating on top while you keep working
- Remembers the **last visited URL** and **home page** locally (a small JSON file, no database)
- Compact toolbar so it takes minimal screen space

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (includes npm)

## Run it

```bash
npm install
npm start
```

That's it — the floating browser window appears.

## How to use

| Control        | Action                                           |
| -------------- | ------------------------------------------------ |
| ‹ / ›          | Back / Forward                                   |
| ⟳              | Reload                                           |
| ⌂              | Go to your Home page                             |
| Address bar    | Type a URL or search term, then press **Enter**  |
| ⚙              | Settings — set the default home page             |
| —              | Minimize                                         |
| ✕              | Close                                            |
| Toolbar        | Click & drag anywhere on it to move the window   |
| Window edges   | Drag to resize (keeps 4:3 ratio)                 |

> **Tip — fullscreen video:** click the fullscreen button on a YouTube video to
> make it fill the whole Floaty window. It stays floating on top (it won't take
> over your screen). Press **Esc** or the fullscreen button again to exit.

## Build distributable apps (.exe / .dmg)

Packaging is handled by [electron-builder](https://www.electron.build/).

```bash
# Windows — produces an installer + a portable .exe in dist/
npm run dist:win

# macOS — produces a .dmg + .zip in dist/  (must be run ON a Mac)
npm run dist:mac
```

Outputs land in `dist/`:

| File                       | What it is                                  |
| -------------------------- | ------------------------------------------- |
| `Floaty Setup 1.0.0.exe`   | Windows installer (choose install location) |
| `Floaty 1.0.0.exe`         | Windows portable — just double-click to run |
| `Floaty-1.0.0.dmg`         | macOS disk image (built on a Mac)           |

> **macOS note:** cross-building a Mac app from Windows isn't supported by
> Apple's toolchain, so `npm run dist:mac` must run on a macOS machine. The app
> icon is already set up for it, so on a Mac it's just that one command.

### App icon

The icon is defined once in [`assets/icon.svg`](assets/icon.svg). Running any
`dist*` script (or `npm run icons`) regenerates `build/icon.png` and
`build/icon.ico` from it via `scripts/generate-icons.js`. Edit the SVG to change
the icon — no image editor needed.

## Project structure

```
Floaty/
├── package.json              # npm metadata, build config, dependencies
├── main.js                   # Electron main process (window, views, navigation, persistence)
├── preload.js                # Secure bridge between toolbar UI and main process
├── index.html                # Compact toolbar UI
├── renderer.js               # Toolbar UI logic
├── assets/icon.svg           # Source app icon
├── scripts/generate-icons.js # Builds build/icon.png + build/icon.ico from the SVG
└── README.md
```

## Notes

- The last visited URL and your chosen home page are saved to
  `floaty-state.json` in Electron's per-user `userData` folder (no database,
  just a plain file).
- The home page defaults to YouTube and can be changed any time via the ⚙
  Settings button. The fallback default lives in the `DEFAULT_HOME` constant
  near the top of `main.js`.
- **Start on startup** is handled by the operating system (via Electron's
  `app.setLoginItemSettings`), so it persists outside the app and works on both
  Windows and macOS. Toggle it any time in ⚙ Settings.
