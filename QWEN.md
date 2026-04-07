# Vectux (Vecta) - Project Context

## Project Overview

**Vecta** is a vector drawing web application designed primarily for mobile/touch devices. It provides a touch-friendly interface for freehand drawing with support for multiple colors, stroke sizes, and orientation-aware responsive layout.

### Key Features
- **Freehand drawing** with a relocated (offset) cursor to avoid finger occlusion on touch screens
- **Touch gesture recognition** via the custom `TNT.js` (Touch & No-Touch) engine
- **Vector path storage** in SVG format
- **Selection mode** to select previously drawn paths
- **Pan mode** for navigating the canvas
- **Undo/Redo** with up to 50 history states
- **Clear canvas** via button or 5-finger "tntBang" gesture
- **Responsive layout** that adapts to landscape/portrait orientation
- **PWA support** (installable via `manifest.json`)
- **Fullscreen mode** toggle

## Architecture

### File Structure

| File | Description |
|------|-------------|
| `index.html` | Main HTML entry point; loads all scripts and sets up the canvas layout |
| `app.js` | Application bootstrap; initializes `Application`, `LayoutManager`, and wires up status bar |
| `core.js` | Core logic: `StateMachine` (state management + undo/redo), `CorePanel` (UI panel with tools/colors/sizes), `DrawArea` (SVG rendering and event binding) |
| `tnt.js` | Custom touch gesture engine (`TouchEngine`, `CursorKinematics`, `TouchOverlay`) — handles taps, presses, long-presses, pinches, grabs, and the 5-finger "bang" gesture |
| `panel.css` | Responsive CSS for the control panel (landscape = left sidebar, portrait = top bar) |
| `manifest.json` | PWA manifest for installability |
| `icon.svg` | Application icon |

### Core Classes

- **`StateMachine`** — Centralized state management with getter/setter properties, event emission, and undo/redo history (snapshots of mode, tool, color, size, paths)
- **`CorePanel`** — Builds the DOM for the control panel (fullscreen, clear, undo, redo buttons; tool selection; color palette; stroke sizes)
- **`DrawArea`** — Manages the SVG drawing surface, redraws paths, handles coordinate transformation, and binds touch events to drawing actions
- **`TouchOverlay` / `TouchEngine`** — Full touch gesture recognition with a relocated cursor paradigm (cursor stays at a fixed distance from the finger)
- **`Application`** — Top-level orchestrator; builds the DOM, initializes all subsystems, and updates the status bar
- **`LayoutManager`** — Handles orientation-based layout switching (portrait vs landscape)

## Technologies

- **Vanilla JavaScript** (ES6+ with private class fields `#`)
- **SVG** for vector rendering
- **CSS** with orientation-based media queries
- **Eruda** — Mobile debug console (loaded from CDN)
- **svg-path-commander** — SVG path utilities (loaded from CDN, referenced but not actively used in current code)

## Building and Running

This is a **static web application** — no build step required.

- **Development**: Serve the directory with any static file server (e.g., `python3 -m http.server 8080`, `npx serve`, or similar)
- **Dependencies**: None locally; external libraries loaded from CDN (`eruda`, `svg-path-commander`)
- **Browser support**: Modern browsers with touch event support (mobile-focused)

## Development Conventions

- **Private class fields** (`#`) are used extensively for encapsulation
- **Event-driven architecture**: `StateMachine` emits events that subsystems subscribe to
- **State snapshots**: Undo/redo works via deep-cloned state snapshots stored in a bounded history array (max 50)
- **DOM construction**: UI components build their own DOM programmatically via `buildDom()` methods (no templating framework)
- **Touch gesture states**: The TNT.js engine implements a state machine for touch gestures (idle → tapping → pressing → longPressing, with branching to grabbing, pinching, or catching)

## Key Technical Details

### Touch Gesture System (TNT.js v0.8.5)
The application uses a custom touch abstraction that solves finger occlusion by placing a cursor at a fixed offset distance from the touch point. Key gestures:
- `tap`, `press`, `longPress` — single-finger time-based gestures
- `cursorActivate/move/release` — drawing gestures with relocated cursor
- `pinchStart/pinchChange/pinchEnd` — two-finger pinch
- `catchAt/catchMove/catchDrop` — two-finger pan
- `tntBang` — 5-finger gesture to clear canvas and reset background color

### Canvas
- SVG viewBox: `2970 x 2100` (A4 landscape ratio at 10x scale)
- Background color can be changed via the `tntBang` gesture
- Paths are stored as point arrays and converted to SVG path data on redraw
