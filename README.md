# Vecta

**Vector drawing app** — mobile-first, touch-friendly, SVG-based.

🌐 **[Open App](https://s1pierro.github.io/vecta/)**

## Features

- **Drawing** — freehand paths with Douglas-Peucker simplification (tolerance slider)
- **Selection** — tap to select objects, drag bbox to select multiple
- **Node editing** — select individual nodes with bbox, move/delete/insert
- **Bezier curves** — 4 node types: Coin, Lisse, Symétrique, Auto
  - Orange diamond handles for control points (cpIn / cpOut)
  - Smooth nodes mirror handles colinearly (G1 continuity)
  - Symmetric nodes enforce equal-length handles (C2 continuity)
  - Auto nodes regenerate control points from adjacent nodes
- **Deformation** — 8-handle bounding box (corners + edges)
- **Pan & Zoom** — 2-finger catch to pan, pinch to zoom
- **Undo/Redo** — 50-state history

## Tech

- Vanilla ES6 modules (no build step)
- SVG with independent screen-coordinate UI layer
- [TNT.js](https://github.com/s1pierro/tnt.js) v0.8.5 — touch gesture engine with offset cursor

## Usage

Open `index.html` in any modern browser, or serve via GitHub Pages.

## Structure

| File | Description |
|------|-------------|
| `app.js` | Application bootstrap, LayoutManager, status bar |
| `core.js` | StateMachine, CorePanel, DrawArea (all logic) |
| `tnt.js` | Touch & No-Touch gesture engine (vendored) |
| `panel.css` | Responsive panel styles |
| `index.html` | Entry point |
| `manifest.json` | PWA manifest |
