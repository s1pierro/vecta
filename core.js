const APP_NAME = 'Vecta';
const APP_VERSION = '0.1';

/**
 * Distance perpendiculaire d'un point à un segment.
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  const ix = lineStart.x + u * dx;
  const iy = lineStart.y + u * dy;
  return Math.hypot(point.x - ix, point.y - iy);
}

/**
 * Algorithme de Douglas-Peucker pour simplifier un tracé.
 * @param {{x:number,y:number}[]} points
 * @param {number} tolerance - Distance maximale (px) pour considérer un point redondant.
 * @returns {{x:number,y:number}[]}
 */
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points.slice();
  let maxDist = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

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
      selectedPath: null,
      selectables: 'objects'
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
  set selectedPath(v) {
    this.#state.selectedPath = v;
    this.#state.selectables = v ? 'nodes' : 'objects';
    this.#emit('selectablesChange', this.#state.selectables);
    this.#emit('selectedPathChange', v);
  }

  get selectables() { return this.#state.selectables; }
  set selectables(v) {
    this.#state.selectables = v;
    this.#emit('selectablesChange', v);
  }

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

  updateSelectedPath(props) {
    if (this.#state.selectedPath) {
      Object.assign(this.#state.selectedPath, props);
      this.#emit('pathsChange', this.#state.paths);
      this.#saveState();
    }
  }

  simplifySelectedPath(tolerance) {
    if (!this.#state.selectedPath) return;
    const path = this.#state.selectedPath;
    path.points = douglasPeucker(path.points, tolerance);
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
      this.#state.selectables = 'objects';
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

    // Section Selection Properties
    const sectionSelection = document.createElement('div');
    sectionSelection.className = 'panel-section panel-section-selection';
    sectionSelection.id = 'panelSelection';

    const selInfo = document.createElement('div');
    selInfo.className = 'selection-info';
    selInfo.innerHTML =
      '<div><span class="selection-prop-label">Couleur</span><span class="selection-prop-value" id="selColor"></span></div>' +
      '<div><span class="selection-prop-label">Taille</span><span class="selection-prop-value" id="selSize"></span></div>' +
      '<div><span class="selection-prop-label">Points</span><span class="selection-prop-value" id="selPoints"></span></div>';
    sectionSelection.appendChild(selInfo);

    const selActions = document.createElement('div');
    selActions.className = 'selection-actions';
    selActions.innerHTML =
      '<div class="simplify-control">' +
        '<span class="selection-prop-label">Tolérance</span>' +
        '<span class="selection-prop-value" id="selTolerance">5px</span>' +
        '<input type="range" id="selToleranceSlider" min="1" max="50" step="1" value="5">' +
      '</div>' +
      '<button class="panel-btn" id="simplifyBtn" title="Simplifier">' +
        '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke-dasharray="1 3"/></svg>' +
        '<span class="btn-label">Simplifier</span>' +
      '</button>';
    sectionSelection.appendChild(selActions);
    panel.appendChild(sectionSelection);

    sectionSelection.querySelector('#selToleranceSlider').addEventListener('input', (e) => {
      const val = e.target.value;
      sectionSelection.querySelector('#selTolerance').textContent = val + 'px';
    });

    sectionSelection.querySelector('#simplifyBtn').addEventListener('click', () => {
      const tol = parseInt(sectionSelection.querySelector('#selToleranceSlider').value, 10);
      this.#stateMachine.simplifySelectedPath(tol);
    });

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
    if (this.#stateMachine.selectedPath) {
      this.#stateMachine.updateSelectedPath({ color });
    }
    this.#stateMachine.currentColor = color;
  }

  #selectSize(size) {
    this.#el.querySelectorAll('.panel-size-btn').forEach(b => b.classList.remove('active'));
    this.#el.querySelector(`[data-size="${size}"]`).classList.add('active');
    if (this.#stateMachine.selectedPath) {
      this.#stateMachine.updateSelectedPath({ size });
    }
    this.#stateMachine.currentSize = size;
  }

  syncSelection(path) {
    const section = this.#el.querySelector('#panelSelection');
    if (!path) {
      section.classList.remove('visible');
      return;
    }
    section.classList.add('visible');
    const selColor = this.#el.querySelector('#selColor');
    const selSize = this.#el.querySelector('#selSize');
    const selPoints = this.#el.querySelector('#selPoints');
    if (selColor) selColor.textContent = path.color;
    if (selSize) selSize.textContent = path.size + 'px';
    if (selPoints) selPoints.textContent = path.points ? path.points.length : 0;

    this.#el.querySelectorAll('.panel-color-btn').forEach(b => b.classList.remove('active'));
    const colorBtn = this.#el.querySelector(`[data-color="${path.color}"]`);
    if (colorBtn) colorBtn.classList.add('active');
    this.#el.querySelectorAll('.panel-size-btn').forEach(b => b.classList.remove('active'));
    const sizeBtn = this.#el.querySelector(`[data-size="${path.size}"]`);
    if (sizeBtn) sizeBtn.classList.add('active');
  }
}

class DrawArea {
  #stateMachine;
  #el;
  #svg;
  #svgPaths;
  #svgCurrentPath;
  #svgSelection;
  #svgUI;
  #touchOverlay;
  #panX = 0;
  #panY = 0;
  #zoom = 1;
  #DOC_W = 2970;
  #DOC_H = 2100;
  _handleDragHandle = null;
  _handleDragOrigPoints = null;
  _handleDragOrigBBox = null;

  constructor(stateMachine) {
    this.#stateMachine = stateMachine;
  }

  get svgElement() { return this.#svg; }
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
    this.#svg.setAttribute('width', '100%');
    this.#svg.setAttribute('height', '100%');
    this.#applyTransform();

    this.#svgPaths = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.#svgPaths.setAttribute('id', 'svgPaths');

    this.#svgSelection = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.#svgSelection.setAttribute('id', 'svgSelection');

    this.#svgCurrentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.#svgCurrentPath.setAttribute('id', 'currentPath');

    this.#svg.appendChild(this.#svgPaths);
    this.#svg.appendChild(this.#svgSelection);
    this.#svg.appendChild(this.#svgCurrentPath);
    drawArea.appendChild(this.#svg);

    // UI layer — SVG en coordonnées écran, indépendant du zoom/pan
    this.#svgUI = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.#svgUI.setAttribute('id', 'drawAreaSvgUI');
    this.#svgUI.setAttribute('width', '100%');
    this.#svgUI.setAttribute('height', '100%');
    this.#svgUI.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    drawArea.appendChild(this.#svgUI);

    this.#el = drawArea;
    this.#touchOverlay = touchOverlay;
    container.appendChild(drawArea);
  }

  /**
   * Applique le transform (pan + zoom) au viewBox SVG.
   */
  #applyTransform() {
    const vw = this.#DOC_W / this.#zoom;
    const vh = this.#DOC_H / this.#zoom;
    this.#svg.setAttribute('viewBox', `${this.#panX} ${this.#panY} ${vw} ${vh}`);
  }

  /**
   * Convertit les coordonnées relatives à l'overlay tactile en coordonnées document SVG.
   * Prend en compte le pan, le zoom et le letterboxing du SVG.
   */
  #screenToDoc(overlayRelX, overlayRelY) {
    const svg = this.#svg;
    const overlayRect = this.#touchOverlay.getBoundingClientRect();
    const pt = svg.createSVGPoint();
    pt.x = overlayRelX + overlayRect.left;
    pt.y = overlayRelY + overlayRect.top;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: overlayRelX, y: overlayRelY };
    const docPt = pt.matrixTransform(ctm.inverse());
    return { x: docPt.x, y: docPt.y };
  }

  /**
   * Convertit les coordonnées document SVG en coordonnées écran relatives au container.
   * Inverse de #screenToDoc.
   */
  #docToScreen(docX, docY) {
    const svg = this.#svg;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: docX, y: docY };
    const pt = svg.createSVGPoint();
    pt.x = docX;
    pt.y = docY;
    const screenPt = pt.matrixTransform(ctm);
    const overlayRect = this.#touchOverlay.getBoundingClientRect();
    return { x: screenPt.x - overlayRect.left, y: screenPt.y - overlayRect.top };
  }

  /**
   * Déplace le viewport de dx/dy en coordonnées document.
   */
  #pan(dx, dy) {
    this.#panX -= dx;
    this.#panY -= dy;
    this.#applyTransform();
    this._redrawSelection();
  }

  /**
   * Zoome autour d'un point document (px, py) avec le facteur donné.
   */
  #zoomAt(px, py, factor) {
    const oldZoom = this.#zoom;
    const newZoom = Math.min(10, Math.max(0.1, oldZoom * factor));
    const s = newZoom / oldZoom;
    this.#panX = px - (px - this.#panX) / s;
    this.#panY = py - (py - this.#panY) / s;
    this.#zoom = newZoom;
    this.#applyTransform();
    this._redrawSelection();
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

    // Selection bounding box rectangle (draw tool)
    this._drawSelBBox();

    this._redrawSelection();
  }

  /**
   * Dessine le rectangle de sélection temporaire en mode sélection.
   */
  _drawSelBBox() {
    this.#svgSelection.innerHTML = '';
    if (!this._selBBoxStart || !this._selBBoxCurrent) return;
    const sx1 = this._selBBoxStart.x;
    const sy1 = this._selBBoxStart.y;
    const sx2 = this._selBBoxCurrent.x;
    const sy2 = this._selBBoxCurrent.y;
    const x = Math.min(sx1, sx2);
    const y = Math.min(sy1, sy2);
    const w = Math.abs(sx2 - sx1);
    const h = Math.abs(sy2 - sy1);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', 'rgba(79,195,247,0.1)');
    rect.setAttribute('stroke', '#4fc3f7');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '4 3');
    rect.setAttribute('pointer-events', 'none');
    this.#svgSelection.appendChild(rect);
  }

  /**
   * Redessine la boîte englobante et les poignées dans le layer UI (coordonnées écran).
   */
  _redrawSelection() {
    this.#svgUI.innerHTML = '';
    const selectedPath = this.#stateMachine.selectedPath;
    if (!selectedPath || !selectedPath.points || selectedPath.points.length < 2 ||
        this.#stateMachine.selectables !== 'nodes') {
      this._clearHandleDrag();
      return;
    }

    const bbox = this.#computeBBox(selectedPath.points);
    const padding = 4;
    const tl = this.#docToScreen(bbox.minX - padding, bbox.minY - padding);
    const br = this.#docToScreen(bbox.maxX + padding, bbox.maxY + padding);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', tl.x);
    rect.setAttribute('y', tl.y);
    rect.setAttribute('width', br.x - tl.x);
    rect.setAttribute('height', br.y - tl.y);
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#4fc3f7');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '6 3');
    rect.setAttribute('pointer-events', 'none');
    this.#svgUI.appendChild(rect);

    const handleSize = 10;
    const handles = [
      { name: 'n',  cx: (tl.x + br.x) / 2, cy: tl.y, cursor: 'ns-resize' },
      { name: 's',  cx: (tl.x + br.x) / 2, cy: br.y, cursor: 'ns-resize' },
      { name: 'w',  cx: tl.x, cy: (tl.y + br.y) / 2, cursor: 'ew-resize' },
      { name: 'e',  cx: br.x, cy: (tl.y + br.y) / 2, cursor: 'ew-resize' },
      { name: 'nw', cx: tl.x, cy: tl.y, cursor: 'nwse-resize' },
      { name: 'ne', cx: br.x, cy: tl.y, cursor: 'nesw-resize' },
      { name: 'sw', cx: tl.x, cy: br.y, cursor: 'nesw-resize' },
      { name: 'se', cx: br.x, cy: br.y, cursor: 'nwse-resize' },
    ];

    handles.forEach(h => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', h.cx - handleSize / 2);
      el.setAttribute('y', h.cy - handleSize / 2);
      el.setAttribute('width', handleSize);
      el.setAttribute('height', handleSize);
      el.setAttribute('rx', '2');
      el.setAttribute('fill', '#fff');
      el.setAttribute('stroke', '#4fc3f7');
      el.setAttribute('stroke-width', '2');
      el.setAttribute('pointer-events', 'none');
      this.#svgUI.appendChild(el);
    });

    // Poignées de nœuds — un petit cercle par point du tracé
    const nodeRadius = 5;
    const points = selectedPath.points;
    const nodeHandles = [];
    points.forEach((p, i) => {
      const sp = this.#docToScreen(p.x, p.y);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', sp.x);
      c.setAttribute('cy', sp.y);
      c.setAttribute('r', nodeRadius);
      c.setAttribute('fill', '#4fc3f7');
      c.setAttribute('stroke', '#fff');
      c.setAttribute('stroke-width', '2');
      c.setAttribute('pointer-events', 'none');
      this.#svgUI.appendChild(c);
      nodeHandles.push({ name: `node:${i}`, x: sp.x, y: sp.y });
    });

    // Stocker tous les centres pour hit detection (bbox + nœuds)
    const allHandles = handles.map(h => ({ name: h.name, x: h.cx, y: h.cy }));
    this._handleCenters = allHandles.concat(nodeHandles);
    this._handleHitRadius = Math.max(handleSize, nodeRadius * 2.5);
  }

  /**
   * Débute la déformation via une poignée.
   * Appelé quand l'overlay détecte un touch sur une poignée.
   */
  _startHandleDrag(handleName, screenX, screenY) {
    const doc = this.#screenToDoc(screenX, screenY);

    const path = this.#stateMachine.selectedPath;
    if (!path) return;

    this._handleDragHandle = handleName;
    this._handleDragOrigPoints = path.points.map(p => ({ x: p.x, y: p.y }));
    this._handleDragOrigBBox = this.#computeBBox(path.points);
    this._handleDragStartDoc = doc;

    this._handleDragMove = (ev) => this._onHandleDragMove(ev);
    this._handleDragEnd = (ev) => this._onHandleDragEnd(ev);
    this.#touchOverlay.addEventListener('touchmove', this._handleDragMove, { passive: false });
    this.#touchOverlay.addEventListener('touchend', this._handleDragEnd);
    this.#touchOverlay.addEventListener('touchcancel', this._handleDragEnd);
  }

  _onHandleDragMove(e) {
    if (!this._handleDragHandle || !this._handleDragOrigPoints) return;
    const touch = e.changedTouches[0];
    const containerRect = this.#el.getBoundingClientRect();
    const screenX = touch.clientX - containerRect.left;
    const screenY = touch.clientY - containerRect.top;
    const doc = this.#screenToDoc(screenX, screenY);

    this._deformPath(doc);
    this._redraw();
    e.preventDefault();
  }

  _onHandleDragEnd() {
    this.#touchOverlay.removeEventListener('touchmove', this._handleDragMove);
    this.#touchOverlay.removeEventListener('touchend', this._handleDragEnd);
    this.#touchOverlay.removeEventListener('touchcancel', this._handleDragEnd);
    this._handleDragOrigBBox = null;
    this._handleDragOrigPoints = null;
    this._handleDragStartDoc = null;
    this._handleDragHandle = null;
  }

  _clearHandleDrag() {
    if (this._handleDragHandle) {
      this.#touchOverlay.removeEventListener('touchmove', this._handleDragMove);
      this.#touchOverlay.removeEventListener('touchend', this._handleDragEnd);
      this.#touchOverlay.removeEventListener('touchcancel', this._handleDragEnd);
      this._handleDragHandle = null;
      this._handleDragOrigPoints = null;
      this._handleDragOrigBBox = null;
    }
  }

  /**
   * Déforme le tracé sélectionné selon le déplacement de la poignée.
   */
  _deformPath(newDocPos) {
    const path = this.#stateMachine.selectedPath;
    if (!path) return;

    // Cas spécial : déplacement d'un nœud individuel
    if (this._handleDragHandle.startsWith('node:')) {
      const nodeIndex = parseInt(this._handleDragHandle.split(':')[1], 10);
      if (isNaN(nodeIndex) || nodeIndex >= path.points.length) return;
      path.points[nodeIndex] = { x: newDocPos.x, y: newDocPos.y };
      this.#stateMachine.updateSelectedPath({ points: path.points });
      return;
    }

    const orig = this._handleDragOrigPoints;
    const bbox = this._handleDragOrigBBox;
    const handle = this._handleDragHandle;

    const bw = bbox.maxX - bbox.minX || 1;
    const bh = bbox.maxY - bbox.minY || 1;

    const dx = newDocPos.x - this._handleDragStartDoc.x;
    const dy = newDocPos.y - this._handleDragStartDoc.y;

    let scaleX = 1, scaleY = 1, doX = false, doY = false;
    let anchorX = 0, anchorY = 0;

    switch (handle) {
      case 'nw': { // scale from bottom-right
        const newW = bw - dx;
        const newH = bh - dy;
        scaleX = Math.max(0.1, Math.min(10, newW / bw));
        scaleY = Math.max(0.1, Math.min(10, newH / bh));
        anchorX = bbox.maxX; anchorY = bbox.maxY;
        doX = true; doY = true;
        break;
      }
      case 'ne': { // scale from bottom-left
        const newW = bw + dx;
        const newH = bh - dy;
        scaleX = Math.max(0.1, Math.min(10, newW / bw));
        scaleY = Math.max(0.1, Math.min(10, newH / bh));
        anchorX = bbox.minX; anchorY = bbox.maxY;
        doX = true; doY = true;
        break;
      }
      case 'sw': { // scale from top-right
        const newW = bw - dx;
        const newH = bh + dy;
        scaleX = Math.max(0.1, Math.min(10, newW / bw));
        scaleY = Math.max(0.1, Math.min(10, newH / bh));
        anchorX = bbox.maxX; anchorY = bbox.minY;
        doX = true; doY = true;
        break;
      }
      case 'se': { // scale from top-left
        const newW = bw + dx;
        const newH = bh + dy;
        scaleX = Math.max(0.1, Math.min(10, newW / bw));
        scaleY = Math.max(0.1, Math.min(10, newH / bh));
        anchorX = bbox.minX; anchorY = bbox.minY;
        doX = true; doY = true;
        break;
      }
      case 'n': {
        const newH = bh - dy;
        scaleY = Math.max(0.1, Math.min(10, newH / bh));
        anchorY = bbox.maxY;
        doY = true;
        break;
      }
      case 's': {
        const newH = bh + dy;
        scaleY = Math.max(0.1, Math.min(10, newH / bh));
        anchorY = bbox.minY;
        doY = true;
        break;
      }
      case 'w': {
        const newW = bw - dx;
        scaleX = Math.max(0.1, Math.min(10, newW / bw));
        anchorX = bbox.maxX;
        doX = true;
        break;
      }
      case 'e': {
        const newW = bw + dx;
        scaleX = Math.max(0.1, Math.min(10, newW / bw));
        anchorX = bbox.minX;
        doX = true;
        break;
      }
    }

    path.points = orig.map(p => ({
      x: doX ? anchorX + (p.x - anchorX) * scaleX : p.x,
      y: doY ? anchorY + (p.y - anchorY) * scaleY : p.y,
    }));
    this.#stateMachine.updateSelectedPath({ points: path.points });
  }

  #computeBBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
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

    // Cursor events — drawing or selection bbox
    overlay.engine.on('cursorActivate', (e) => {
      if (this.#stateMachine.mode === 'drawingTool') {
        const pt = this.#screenToDoc(e.touchX, e.touchY);
        this.#stateMachine.currentPath = [{ x: pt.x, y: pt.y }];
      } else if (this.#stateMachine.mode === 'selection' && this.#stateMachine.selectables === 'objects') {
        const doc = this.#screenToDoc(e.touchX, e.touchY);
        this._selBBoxStart = doc;
        this._selBBoxCurrent = doc;
      }
    });

    overlay.engine.on('cursorMove', (e) => {
      if (this.#stateMachine.mode === 'drawingTool') {
        const path = this.#stateMachine.currentPath;
        if (path) {
          const pt = this.#screenToDoc(e.touchX, e.touchY);
          path.push({ x: pt.x, y: pt.y });
          this._redraw();
        }
      } else if (this.#stateMachine.mode === 'selection' && this.#stateMachine.selectables === 'objects') {
        this._selBBoxCurrent = this.#screenToDoc(e.touchX, e.touchY);
        this._redraw();
      }
    });

    overlay.engine.on('cursorRelease', (e) => {
      if (this.#stateMachine.mode === 'drawingTool') {
        const path = this.#stateMachine.currentPath;
        if (path && path.length > 1) {
          this.#stateMachine.addPath({
            points: path,
            color: this.#stateMachine.currentColor,
            size: this.#stateMachine.currentSize
          });
        }
        this.#stateMachine.currentPath = null;
      } else if (this.#stateMachine.mode === 'selection' && this.#stateMachine.selectables === 'objects') {
        this._selectInBBox();
        this._selBBoxStart = null;
        this._selBBoxCurrent = null;
      }
    });
    this._selBBoxStart = null;
    this._selBBoxCurrent = null;

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
    });

    // Pan via catch (2-finger gesture)
    this._lastCatchDocPos = null;
    overlay.engine.on('catchAt', (e) => {
      const doc = this.#screenToDoc(e.x, e.y);
      this._lastCatchDocPos = doc;
    });
    overlay.engine.on('catchMove', (e) => {
      const doc = this.#screenToDoc(e.x, e.y);
      if (this._lastCatchDocPos) {
        const dx = doc.x - this._lastCatchDocPos.x;
        const dy = doc.y - this._lastCatchDocPos.y;
        this.#pan(dx, dy);
      }
      this._lastCatchDocPos = doc;
    });
    overlay.engine.on('catchDrop', () => {
      this._lastCatchDocPos = null;
    });

    // Zoom via pinch (2-finger gesture)
    overlay.engine.on('pinchStart', (e) => {
      const cx = (e.x1 + e.x2) / 2;
      const cy = (e.y1 + e.y2) / 2;
      const doc = this.#screenToDoc(cx, cy);
      this._pinchDocCenter = doc;
    });
    overlay.engine.on('pinchChange', (e) => {
      if (this._pinchDocCenter) {
        this.#zoomAt(this._pinchDocCenter.x, this._pinchDocCenter.y, e.scale / this._pinchLastScale);
      }
      this._pinchLastScale = e.scale;
    });
    overlay.engine.on('pinchEnd', () => {
      this._pinchDocCenter = null;
      this._pinchLastScale = 1;
    });
    this._pinchDocCenter = null;
    this._pinchLastScale = 1;

    // Handle hit detection via overlay touch (capture phase, before TNT)
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this.#touchOverlay.addEventListener('touchstart', this._handleTouchStart, { passive: false, capture: true });
  }

  _handleTouchStart(e) {
    if (this._handleDragHandle) return; // already dragging
    if (this.#stateMachine.mode !== 'selection') return;
    if (!this._handleCenters || this._handleCenters.length === 0) return;
    if (e.touches.length > 1) return; // multi-touch → let TNT handle

    const touch = e.touches[0];
    const rect = this.#el.getBoundingClientRect();
    const sx = touch.clientX - rect.left;
    const sy = touch.clientY - rect.top;

    // In 'objects' mode, don't intercept any handles (bbox selection uses cursor)
    if (this.#stateMachine.selectables === 'objects') return;

    // In 'nodes' mode, only match node handles (not bbox handles)
    let hit = null;
    let minDist = Infinity;
    for (const h of this._handleCenters) {
      if (!h.name.startsWith('node:')) continue;
      const d = Math.hypot(sx - h.x, sy - h.y);
      if (d < minDist) { minDist = d; hit = h; }
    }

    if (hit && minDist <= this._handleHitRadius * 1.5) {
      e.stopPropagation();
      this._startHandleDrag(hit.name, sx, sy);
    }
  }

  /**
   * Sélectionne le premier chemin dont un nœud est dans la boîte de sélection.
   */
  _selectInBBox() {
    if (!this._selBBoxStart || !this._selBBoxCurrent) return;
    const x1 = Math.min(this._selBBoxStart.x, this._selBBoxCurrent.x);
    const y1 = Math.min(this._selBBoxStart.y, this._selBBoxCurrent.y);
    const x2 = Math.max(this._selBBoxStart.x, this._selBBoxCurrent.x);
    const y2 = Math.max(this._selBBoxStart.y, this._selBBoxCurrent.y);

    // Ignorer si trop petit (c'était un tap)
    if (x2 - x1 < 5 && y2 - y1 < 5) return;

    const paths = this.#stateMachine.paths;
    let found = null;
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      for (const p of path.points) {
        if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
          found = path;
          break;
        }
      }
      if (found) break;
    }
    this.#stateMachine.selectedPath = found || null;
  }
}
