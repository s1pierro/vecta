const APP_NAME = 'Vecta';
const APP_VERSION = '0.1';

class StateMachine {
  #state;
  #listeners;
  #history = [];
  #historyIndex = -1;
  #maxHistory = 50;

  constructor() {
    this.#state = {
      mode: 'drawingTool',
      currentTool: 'draw',
      currentColor: '#ffffff',
      currentSize: 8,
      paths: [],
      currentPath: null,
      selectedPath: null
    };
    this.#listeners = {};
    this.#saveState();
  }

  get state() {
    const s = {};
    for (const k in this.#state) s[k] = this.#state[k];
    return s;
  }

  get mode() { return this.#state.mode; }
  set mode(v) { this.#state.mode = v; this.#emit('modeChange', v); }

  get currentTool() { return this.#state.currentTool; }
  set currentTool(v) { this.#state.currentTool = v; this.#emit('toolChange', v); }

  get currentColor() { return this.#state.currentColor; }
  set currentColor(v) { this.#state.currentColor = v; this.#emit('colorChange', v); }

  get currentSize() { return this.#state.currentSize; }
  set currentSize(v) { this.#state.currentSize = v; this.#emit('sizeChange', v); }

  get paths() { return this.#state.paths; }
  set paths(v) { this.#state.paths = v; this.#emit('pathsChange', v); }

  get currentPath() { return this.#state.currentPath; }
  set currentPath(v) { this.#state.currentPath = v; this.#emit('currentPathChange', v); }

  get selectedPath() { return this.#state.selectedPath; }
  set selectedPath(v) { this.#state.selectedPath = v; this.#emit('selectedPathChange', v); }

  on(event, callback) {
    if (!this.#listeners[event]) this.#listeners[event] = [];
    this.#listeners[event].push(callback);
  }

  #emit(event, data) {
    if (this.#listeners[event]) {
      this.#listeners[event].forEach(cb => cb(data));
    }
  }

  #createSnapshot() {
    return {
      mode: this.#state.mode,
      currentTool: this.#state.currentTool,
      currentColor: this.#state.currentColor,
      currentSize: this.#state.currentSize,
      paths: JSON.parse(JSON.stringify(this.#state.paths))
    };
  }

  #restoreState(snapshot) {
    this.#state.mode = snapshot.mode;
    this.#state.currentTool = snapshot.currentTool;
    this.#state.currentColor = snapshot.currentColor;
    this.#state.currentSize = snapshot.currentSize;
    this.#state.paths = JSON.parse(JSON.stringify(snapshot.paths));
    this.#state.selectedPath = null;
    this.#emit('pathsChange', this.#state.paths);
    this.#emit('modeChange', this.#state.mode);
    this.#emit('toolChange', this.#state.currentTool);
    this.#emit('colorChange', this.#state.currentColor);
    this.#emit('sizeChange', this.#state.currentSize);
  }

  #saveState() {
    if (this.#historyIndex < this.#history.length - 1) {
      this.#history = this.#history.slice(0, this.#historyIndex + 1);
    }
    this.#history.push(this.#createSnapshot());
    if (this.#history.length > this.#maxHistory) {
      this.#history.shift();
    }
    this.#historyIndex = this.#history.length - 1;
    this.#emit('historyChange');
  }

  undo() {
    if (this.#historyIndex > 0) {
      this.#historyIndex--;
      this.#restoreState(this.#history[this.#historyIndex]);
      this.#emit('historyChange');
    }
  }

  redo() {
    if (this.#historyIndex < this.#history.length - 1) {
      this.#historyIndex++;
      this.#restoreState(this.#history[this.#historyIndex]);
      this.#emit('historyChange');
    }
  }

  canUndo() { return this.#historyIndex > 0; }
  canRedo() { return this.#historyIndex < this.#history.length - 1; }

  addPath(path) {
    this.#state.paths.push(path);
    this.#emit('pathsChange', this.#state.paths);
    this.#saveState();
  }

  clearCanvas() {
    this.#state.paths = [];
    this.#emit('clearCanvas');
    this.#saveState();
  }

  setMode(newMode) {
    this.#state.currentPath = null;
    if (newMode !== 'selection') {
      this.#state.selectedPath = null;
      this.#emit('selectedPathChange', null);
    }
    this.#state.mode = newMode;
    this.#emit('modeChange', newMode);
  }
}

class CorePanel {
  #stateMachine;
  #el;

  constructor(stateMachine) {
    this.#stateMachine = stateMachine;
  }

  buildDom(container) {
    const panel = document.createElement('div');
    panel.id = 'corePanel';
    this.#el = panel;

    // Section Header
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'panel-section panel-section-header';

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'fullscreenBtn';
    fullscreenBtn.className = 'panel-btn';
    fullscreenBtn.title = 'Plein ecran';
    fullscreenBtn.innerHTML = '<svg class="expand-icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>' +
      '<svg class="compress-icon" viewBox="0 0 24 24" style="display:none"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>';
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearBtn';
    clearBtn.className = 'panel-btn';
    clearBtn.title = 'Effacer';
    clearBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
    clearBtn.addEventListener('click', () => {
      this.#stateMachine.clearCanvas();
    });

    const undoBtn = document.createElement('button');
    undoBtn.id = 'undoBtn';
    undoBtn.className = 'panel-btn';
    undoBtn.title = 'Annuler';
    undoBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg>';
    undoBtn.addEventListener('click', () => {
      this.#stateMachine.undo();
    });

    const redoBtn = document.createElement('button');
    redoBtn.id = 'redoBtn';
    redoBtn.className = 'panel-btn';
    redoBtn.title = 'Refaire';
    redoBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5"/></svg>';
    redoBtn.addEventListener('click', () => {
      this.#stateMachine.redo();
    });

    const appInfo = document.createElement('div');
    appInfo.className = 'panel-app-info';
    appInfo.innerHTML = `<span class="app-name">${APP_NAME}</span><span class="app-version">${APP_VERSION}</span>`;

    sectionHeader.appendChild(fullscreenBtn);
    sectionHeader.appendChild(clearBtn);
    sectionHeader.appendChild(undoBtn);
    sectionHeader.appendChild(redoBtn);
    sectionHeader.appendChild(appInfo);
    panel.appendChild(sectionHeader);

    // Separator 1
    const sep1 = document.createElement('div');
    sep1.className = 'panel-sep';
    panel.appendChild(sep1);

    // Section Tools
    const sectionTool = document.createElement('div');
    sectionTool.className = 'panel-section panel-section-tool';

    const tools = document.createElement('div');
    tools.id = 'panelTools';
    const toolButtons = ['draw', 'select', 'pan'];
    const toolIcons = {
      draw: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>',
      select: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>',
      pan: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>'
    };
    toolButtons.forEach(tool => {
      const btn = document.createElement('button');
      btn.className = 'panel-tool-btn' + (tool === 'draw' ? ' active' : '');
      btn.dataset.tool = tool;
      btn.innerHTML = `<svg viewBox="0 0 24 24">${toolIcons[tool]}</svg>`;
      btn.addEventListener('click', () => this.#selectTool(tool));
      tools.appendChild(btn);
    });
    sectionTool.appendChild(tools);
    panel.appendChild(sectionTool);

    // Separator 2
    const sep2 = document.createElement('div');
    sep2.className = 'panel-sep';
    panel.appendChild(sep2);

    // Section Colors
    const sectionColors = document.createElement('div');
    sectionColors.className = 'panel-section panel-section-colors';

    const colors = document.createElement('div');
    colors.id = 'panelColors';
    const colorList = ['#1a1a2e', '#ffffff', '#ff5252', '#4fc3f7', '#69f0ae', '#ffd54f', '#ba68c8', '#ff9800', '#212121'];
    colorList.forEach((color, i) => {
      const btn = document.createElement('button');
      btn.className = 'panel-color-btn' + (i === 0 ? ' active' : '');
      btn.dataset.color = color;
      btn.style.background = color;
      btn.addEventListener('click', () => this.#selectColor(color));
      colors.appendChild(btn);
    });
    sectionColors.appendChild(colors);
    panel.appendChild(sectionColors);

    // Separator 3
    const sep3 = document.createElement('div');
    sep3.className = 'panel-sep';
    panel.appendChild(sep3);

    // Section Sizes
    const sectionSizes = document.createElement('div');
    sectionSizes.className = 'panel-section panel-section-sizes';

    const sizes = document.createElement('div');
    sizes.id = 'panelSizes';
    const sizeList = [2, 4, 8, 16];
    sizeList.forEach((size, i) => {
      const btn = document.createElement('button');
      btn.className = 'panel-size-btn' + (i === 2 ? ' active' : '');
      btn.dataset.size = size;
      btn.style.width = (size + 4) + 'px';
      btn.style.height = (size + 4) + 'px';
      btn.addEventListener('click', () => this.#selectSize(size));
      sizes.appendChild(btn);
    });
    sectionSizes.appendChild(sizes);
    panel.appendChild(sectionSizes);

    container.appendChild(panel);

    document.addEventListener('fullscreenchange', () => {
      const expandIcon = fullscreenBtn.querySelector('.expand-icon');
      const compressIcon = fullscreenBtn.querySelector('.compress-icon');
      if (document.fullscreenElement) {
        expandIcon.style.display = 'none';
        compressIcon.style.display = 'block';
      } else {
        expandIcon.style.display = 'block';
        compressIcon.style.display = 'none';
      }
    });
  }

  #selectTool(tool) {
    this.#el.querySelectorAll('.panel-tool-btn').forEach(b => b.classList.remove('active'));
    this.#el.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    this.#stateMachine.currentTool = tool;

    const modeMap = {
      draw: 'drawingTool',
      select: 'selection',
      pan: 'drawingTool'
    };
    this.#stateMachine.setMode(modeMap[tool] || 'drawingTool');
  }

  #selectColor(color) {
    this.#el.querySelectorAll('.panel-color-btn').forEach(b => b.classList.remove('active'));
    this.#el.querySelector(`[data-color="${color}"]`).classList.add('active');
    this.#stateMachine.currentColor = color;
  }

  #selectSize(size) {
    this.#el.querySelectorAll('.panel-size-btn').forEach(b => b.classList.remove('active'));
    this.#el.querySelector(`[data-size="${size}"]`).classList.add('active');
    this.#stateMachine.currentSize = size;
  }
}

class DrawArea {
  #stateMachine;
  #el;
  #svg;
  #backgroundRect;
  #svgPaths;
  #svgCurrentPath;
  #touchOverlay;

  constructor(stateMachine) {
    this.#stateMachine = stateMachine;
  }

  get svgElement() { return this.#svg; }
  get backgroundRect() { return this.#backgroundRect; }
  get touchOverlayElement() { return this.#touchOverlay; }
  get container() { return this.#el; }

  buildDom(container) {
    const drawArea = document.createElement('div');
    drawArea.id = 'drawArea';

    const touchOverlay = document.createElement('div');
    touchOverlay.id = 'touchOverlay';
    drawArea.appendChild(touchOverlay);

    this.#svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.#svg.setAttribute('id', 'drawAreaSvg');
    this.#svg.setAttribute('viewBox', '0 0 2970 2100');
    this.#svg.setAttribute('width', '2970');
    this.#svg.setAttribute('height', '2100');

    this.#backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.#backgroundRect.setAttribute('id', 'backgroundRect');
    this.#backgroundRect.setAttribute('width', '100%');
    this.#backgroundRect.setAttribute('height', '100%');
    this.#backgroundRect.setAttribute('fill', '#1a1a2e');

    this.#svgPaths = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.#svgPaths.setAttribute('id', 'svgPaths');

    this.#svgCurrentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.#svgCurrentPath.setAttribute('id', 'currentPath');

    this.#svg.appendChild(this.#backgroundRect);
    this.#svg.appendChild(this.#svgPaths);
    this.#svg.appendChild(this.#svgCurrentPath);
    drawArea.appendChild(this.#svg);
    this.#el = drawArea;
    this.#touchOverlay = touchOverlay;
    container.appendChild(drawArea);
  }

  #screenToDoc(screenX, screenY) {
    if (!this.#svg) return { x: screenX, y: screenY };
    const rect = this.#svg.getBoundingClientRect();
    const docX = screenX - rect.left;
    const docY = screenY - rect.top;
    return { x: docX, y: docY };
  }

  #pointsToSvgPath(points) {
    if (!points || points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  _redraw() {
    if (!this.#svg || !this.#svgPaths) return;

    this.#svgPaths.innerHTML = '';

    const paths = this.#stateMachine.paths;
    const selectedPath = this.#stateMachine.selectedPath;

    paths.forEach((path, index) => {
      if (path.points.length < 2) return;
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', this.#pointsToSvgPath(path.points));
      pathEl.setAttribute('stroke', path.color);
      pathEl.setAttribute('stroke-width', path.size);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      pathEl.setAttribute('data-index', index);

      if (selectedPath === path) {
        pathEl.setAttribute('class', 'selected');
      }

      this.#svgPaths.appendChild(pathEl);
    });

    const currentPath = this.#stateMachine.currentPath;
    if (currentPath && currentPath.length >= 2) {
      this.#svgCurrentPath.setAttribute('d', this.#pointsToSvgPath(currentPath));
      this.#svgCurrentPath.setAttribute('stroke', this.#stateMachine.currentColor);
      this.#svgCurrentPath.setAttribute('stroke-width', this.#stateMachine.currentSize);
      this.#svgCurrentPath.setAttribute('fill', 'none');
      this.#svgCurrentPath.setAttribute('stroke-linecap', 'round');
      this.#svgCurrentPath.setAttribute('stroke-linejoin', 'round');
    } else {
      this.#svgCurrentPath.setAttribute('d', '');
    }
  }

  _findPathAtPoint(x, y) {
    const paths = this.#stateMachine.paths;
    const threshold = 10;

    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      if (path.points.length < 2) continue;

      for (let j = 0; j < path.points.length; j++) {
        const dx = path.points[j].x - x;
        const dy = path.points[j].y - y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return path;
        }
      }
    }
    return null;
  }

  bindDrawEvents(overlay) {
    this.#stateMachine.on('pathsChange', () => this._redraw());
    this.#stateMachine.on('currentPathChange', () => this._redraw());
    this.#stateMachine.on('selectedPathChange', () => this._redraw());

    overlay.engine.on('cursorActivate', (e) => {
      if (this.#stateMachine.mode !== 'drawingTool') return;
      const pt = this.#screenToDoc(e.touchX, e.touchY);
      this.#stateMachine.currentPath = [{ x: pt.x, y: pt.y }];
    });

    overlay.engine.on('cursorMove', (e) => {
      if (this.#stateMachine.mode !== 'drawingTool') return;
      const path = this.#stateMachine.currentPath;
      if (path) {
        const pt = this.#screenToDoc(e.touchX, e.touchY);
        path.push({ x: pt.x, y: pt.y });
        this._redraw();
      }
    });

    overlay.engine.on('cursorRelease', (e) => {
      if (this.#stateMachine.mode !== 'drawingTool') return;
      const path = this.#stateMachine.currentPath;
      if (path && path.length > 1) {
        this.#stateMachine.addPath({
          points: path,
          color: this.#stateMachine.currentColor,
          size: this.#stateMachine.currentSize
        });
      }
      this.#stateMachine.currentPath = null;
    });

    overlay.engine.on('tap', (e) => {
      if (this.#stateMachine.mode === 'selection') {
        const pt = this.#screenToDoc(e.x, e.y);
        const found = this._findPathAtPoint(pt.x, pt.y);
        this.#stateMachine.selectedPath = found || null;
      }
    });

    overlay.engine.on('tntBang', () => {
      console.log('[TNT] tntBang');
      this.#stateMachine.clearCanvas();
      const newColor = this.#stateMachine.currentColor;
      this.#stateMachine.currentColor = newColor;
      this.#backgroundRect.setAttribute('fill', newColor);
    });
  }
}
