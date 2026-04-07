/**
 * SubWindow — a draggable, resizable floating panel.
 * Generic reusable window with header (title + close button), body, and resize handle.
 */
class SubWindow {
  #id;
  #title;
  #contentBuilder;
  #el = null;
  #visible = false;
  #position;  // {left, top}
  #size;      // {width, height}

  constructor(options = {}) {
    this.#id = options.id || `subwindow-${Date.now()}`;
    this.#title = options.title || 'Window';
    this.#contentBuilder = options.content || null; // function that returns DOM
    this.#position = { left: options.left || '10vw', top: options.top || '10vh' };
    this.#size = { width: options.width || '33vw', height: options.height || '50vh' };
    this._listeners = {};
  }

  get id() { return this.#id; }
  get title() { return this.#title; }
  get visible() { return this.#visible; }
  get element() { return this.#el; }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  #emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Build the modal DOM structure and append it to the given container.
   * @param {HTMLElement} container - Where to mount the modal
   */
  buildDom(container) {
    const modal = document.createElement('div');
    modal.id = this.#id;
    modal.className = 'sub-window';
    modal.style.cssText = `
      position:fixed;
      left:${this.#position.left};top:${this.#position.top};
      width:${this.#size.width};height:${this.#size.height};
      min-width:200px;min-height:150px;
      z-index:9999;
      background:rgba(15,15,30,0.96);
      border:1px solid rgba(255,255,255,0.15);
      border-radius:8px;
      display:none;
      flex-direction:column;
      overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      backdrop-filter:blur(8px);
    `;
    this.#el = modal;

    // Header
    const header = document.createElement('div');
    header.className = 'sub-window-header';
    header.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:6px 10px;background:rgba(255,255,255,0.05);
      border-bottom:1px solid rgba(255,255,255,0.1);
      cursor:grab;user-select:none;flex-shrink:0;
    `;
    header.innerHTML =
      `<span class="sub-window-title" style="font-size:0.7em;font-family:'SF Mono','Fira Code',monospace;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">${this.#title}</span>` +
      '<button class="sub-window-close" title="Close" style="width:18px;height:18px;border-radius:50%;border:none;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>';
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'sub-window-body';
    body.style.cssText = `
      flex:1;overflow-y:auto;padding:8px;
      display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;
    `;
    if (this.#contentBuilder) {
      const content = this.#contentBuilder();
      if (content) body.appendChild(content);
    }
    modal.appendChild(body);

    container.appendChild(modal);

    // Close button
    header.querySelector('.sub-window-close').addEventListener('click', () => this.hide());

    // Double-tap to toggle
    header.addEventListener('dblclick', () => this.toggle());

    // Drag
    let dragging = false, dragX, dragY;
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      dragX = e.clientX - modal.offsetLeft;
      dragY = e.clientY - modal.offsetTop;
      e.preventDefault();
    });
    header.addEventListener('touchstart', (e) => {
      dragging = true;
      const t = e.touches[0];
      dragX = t.clientX - modal.offsetLeft;
      dragY = t.clientY - modal.offsetTop;
    }, { passive: true });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      modal.style.left = (e.clientX - dragX) + 'px';
      modal.style.top = (e.clientY - dragY) + 'px';
    });
    window.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      modal.style.left = (t.clientX - dragX) + 'px';
      modal.style.top = (t.clientY - dragY) + 'px';
    }, { passive: true });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('touchend', () => { dragging = false; });

    // Resize
    let resizing = false, resizeStartX, resizeStartY, resizeStartW, resizeStartH;
    modal.addEventListener('mousedown', (e) => {
      const rect = modal.getBoundingClientRect();
      if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
        resizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartW = rect.width;
        resizeStartH = rect.height;
        e.preventDefault();
        e.stopPropagation();
      }
    });
    modal.addEventListener('touchstart', (e) => {
      const rect = modal.getBoundingClientRect();
      const t = e.touches[0];
      if (t.clientX > rect.right - 20 && t.clientY > rect.bottom - 20) {
        resizing = true;
        resizeStartX = t.clientX;
        resizeStartY = t.clientY;
        resizeStartW = rect.width;
        resizeStartH = rect.height;
      }
    }, { passive: true });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const w = Math.max(200, resizeStartW + (e.clientX - resizeStartX));
      const h = Math.max(150, resizeStartH + (e.clientY - resizeStartY));
      modal.style.width = w + 'px';
      modal.style.height = h + 'px';
    });
    window.addEventListener('touchmove', (e) => {
      if (!resizing) return;
      const t = e.touches[0];
      const w = Math.max(200, resizeStartW + (t.clientX - resizeStartX));
      const h = Math.max(150, resizeStartH + (t.clientY - resizeStartY));
      modal.style.width = w + 'px';
      modal.style.height = h + 'px';
    }, { passive: true });
    window.addEventListener('mouseup', () => { resizing = false; });
    window.addEventListener('touchend', () => { resizing = false; });
  }

  show() {
    if (this.#el) {
      this.#el.style.display = 'flex';
      this.#visible = true;
      this.#emit('show');
    }
  }

  hide() {
    if (this.#el) {
      this.#el.style.display = 'none';
      this.#visible = false;
      this.#emit('hide');
    }
  }

  toggle() {
    if (this.#visible) this.hide();
    else this.show();
  }

  setTitle(title) {
    this.#title = title;
    const titleEl = this.#el?.querySelector('.sub-window-title');
    if (titleEl) titleEl.textContent = title;
  }
}

/**
 * SubWindowManager — manages a collection of SubWindows.
 * Provides add/remove/toggle/list API and emits events.
 */
class SubWindowManager {
  #windows = new Map();
  #container;
  _listeners = {};

  constructor(container) {
    this.#container = container || document.body;
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  #emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Register and build a new sub-window.
   * @param {string} id - Unique window ID
   * @param {object} options - SubWindow constructor options
   * @returns {SubWindow}
   */
  addWindow(id, options = {}) {
    if (this.#windows.has(id)) return this.#windows.get(id);
    const win = new SubWindow({ id, ...options });
    win.buildDom(this.#container);
    this.#windows.set(id, win);
    win.on('show', () => this.#emit('visibilityChange', { id, visible: true }));
    win.on('hide', () => this.#emit('visibilityChange', { id, visible: false }));
    this.#emit('windowAdded', win);
    return win;
  }

  /**
   * Get a registered sub-window by ID.
   * @param {string} id
   * @returns {SubWindow|null}
   */
  getWindow(id) {
    return this.#windows.get(id) || null;
  }

  /**
   * Remove a sub-window by ID.
   * @param {string} id
   */
  removeWindow(id) {
    const win = this.#windows.get(id);
    if (win && win.element) win.element.remove();
    this.#windows.delete(id);
    this.#emit('windowRemoved', { id });
  }

  /**
   * Toggle a sub-window's visibility.
   * @param {string} id
   */
  toggleWindow(id) {
    const win = this.#windows.get(id);
    if (win) win.toggle();
  }

  /**
   * Show all registered windows.
   */
  showAll() {
    this.#windows.forEach(w => w.show());
  }

  /**
   * Hide all registered windows.
   */
  hideAll() {
    this.#windows.forEach(w => w.hide());
  }

  /**
   * Get list of all registered windows.
   * @returns {Array<{id: string, title: string, visible: boolean}>}
   */
  getWindows() {
    const result = [];
    this.#windows.forEach((win, id) => {
      result.push({ id, title: win.title, visible: win.visible });
    });
    return result;
  }

  /**
   * Get the raw count of registered windows (for status display).
   */
  get count() { return this.#windows.size; }
}

class LayoutManager {
  #corePanel;
  #drawArea;
  #appGround;

  constructor(corePanel, drawArea) {
    this.#corePanel = corePanel;
    this.#drawArea = drawArea;
    this.#appGround = document.getElementById('app-ground');
    this.#init();
  }

  #init() {
    window.addEventListener('resize', () => this.#handleResize());
    this.#handleResize();
  }

  #handleResize() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    this.applyLayout(isPortrait ? 'portrait' : 'landscape');
  }

  applyLayout(orientation) {
    this.#appGround.classList.remove('landscape', 'portrait');
    this.#appGround.classList.add(orientation);
  }
}

class Application {
  #statesMachine;
  #selectionManager;
  #subWindowManager;
  #corePanel;
  #drawArea;
  #touchOverlay;
  #layoutManager;

  constructor(options = {}) {
    this.#statesMachine = new StateMachine();
    this.#selectionManager = new SelectionManager(this.#statesMachine);
    this.#statesMachine.setSelectionManager(this.#selectionManager);
    this.#subWindowManager = new SubWindowManager(document.body);
    this.#corePanel = new CorePanel(this.#statesMachine, this.#selectionManager, this.#subWindowManager);
    this.#drawArea = new DrawArea(this.#statesMachine, this.#selectionManager);

    this.buildDom(options.container || document.body);
    this.#init();
  }

  get drawArea() {
    return this.#drawArea;
  }

  get subWindowManager() {
    return this.#subWindowManager;
  }

  buildDom(container) {
    let appGround = document.getElementById('app-ground');
    if (!appGround) {
      appGround = document.createElement('div');
      appGround.id = 'app-ground';
      appGround.className = 'landscape';
      container.appendChild(appGround);
    }

    const panelContainer = document.createElement('div');
    panelContainer.id = 'corePanelContainer';
    this.#corePanel.buildDom(panelContainer);
    appGround.appendChild(panelContainer);

    const drawContainer = document.createElement('div');
    drawContainer.id = 'drawAreaContainer';
    this.#drawArea.buildDom(drawContainer);
    appGround.appendChild(drawContainer);

    const statusBar = document.createElement('div');
    statusBar.id = 'statusBar';
    statusBar.innerHTML =
      '<span><span class="label">Mode:</span><span class="value" id="statusMode">-</span></span>' +
      '<span><span class="label">Selectables:</span><span class="value" id="statusSelectables">objects</span></span>' +
      '<span><span class="label">Tool:</span><span class="value" id="statusTool">-</span></span>' +
      '<span><span class="label">Couleur:</span><span class="value" id="statusColor">-</span></span>' +
      '<span><span class="label">Taille:</span><span class="value" id="statusSize">-</span></span>' +
      '<span><span class="label">Sélection:</span><span class="value" id="statusSelected">-</span></span>';
    container.appendChild(statusBar);

    // Raw states bar — debug overlay, stacked above status bar
    const rawBar = document.createElement('div');
    rawBar.id = 'rawStatesBar';
    rawBar.innerHTML =
      '<div class="raw-state-group">' +
        '<span class="raw-label">mode</span>' +
        '<span class="raw-chip" data-state="mode:drawingTool">drawingTool</span>' +
        '<span class="raw-chip" data-state="mode:selection">selection</span>' +
      '</div>' +
      '<div class="raw-state-group">' +
        '<span class="raw-label">tool</span>' +
        '<span class="raw-chip" data-state="tool:draw">draw</span>' +
        '<span class="raw-chip" data-state="tool:select">select</span>' +
        '<span class="raw-chip" data-state="tool:pan">pan</span>' +
      '</div>' +
      '<div class="raw-state-group">' +
        '<span class="raw-label">selectMode</span>' +
        '<span class="raw-chip" data-state="selMode:object">object</span>' +
        '<span class="raw-chip" data-state="selMode:node">node</span>' +
      '</div>' +
      '<div class="raw-state-group">' +
        '<span class="raw-label">selectables</span>' +
        '<span class="raw-chip" data-state="sel:objects">objects</span>' +
        '<span class="raw-chip" data-state="sel:nodes">nodes</span>' +
        '<span class="raw-chip" data-state="sel:nodeSelection">nodeSelection</span>' +
      '</div>' +
      '<div class="raw-state-group">' +
        '<span class="raw-chip raw-toggle" data-state="has:currentPath">currentPath</span>' +
        '<span class="raw-chip raw-toggle" data-state="has:selectedPath">selectedPath</span>' +
        '<span class="raw-chip raw-toggle" data-state="has:selectedNodes">selectedNodes</span>' +
      '</div>' +
      '<div class="raw-state-group">' +
        '<span class="raw-label">tnt</span>' +
        '<span class="raw-chip" data-state="tnt:idle">idle</span>' +
        '<span class="raw-chip" data-state="tnt:tapping">tapping</span>' +
        '<span class="raw-chip" data-state="tnt:grabbing">grabbing</span>' +
        '<span class="raw-chip" data-state="tnt:pinching">pinching</span>' +
        '<span class="raw-chip" data-state="tnt:catching">catching</span>' +
      '</div>';
    container.appendChild(rawBar);

    // Register raw-states modal as a SubWindow
    const rawContentFn = () => {
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      body.innerHTML =
        '<div class="raw-state-group">' +
          '<span class="raw-label">mode</span>' +
          '<span class="raw-chip" data-state="mode:drawingTool">drawingTool</span>' +
          '<span class="raw-chip" data-state="mode:selection">selection</span>' +
        '</div>' +
        '<div class="raw-state-group">' +
          '<span class="raw-label">tool</span>' +
          '<span class="raw-chip" data-state="tool:draw">draw</span>' +
          '<span class="raw-chip" data-state="tool:select">select</span>' +
          '<span class="raw-chip" data-state="tool:pan">pan</span>' +
        '</div>' +
        '<div class="raw-state-group">' +
          '<span class="raw-label">selectMode</span>' +
          '<span class="raw-chip" data-state="selMode:object">object</span>' +
          '<span class="raw-chip" data-state="selMode:node">node</span>' +
        '</div>' +
        '<div class="raw-state-group">' +
          '<span class="raw-label">selectables</span>' +
          '<span class="raw-chip" data-state="sel:objects">objects</span>' +
          '<span class="raw-chip" data-state="sel:nodes">nodes</span>' +
          '<span class="raw-chip" data-state="sel:nodeSelection">nodeSelection</span>' +
        '</div>' +
        '<div class="raw-state-group">' +
          '<span class="raw-chip raw-toggle" data-state="has:currentPath">currentPath</span>' +
          '<span class="raw-chip raw-toggle" data-state="has:selectedPath">selectedPath</span>' +
          '<span class="raw-chip raw-toggle" data-state="has:selectedNodes">selectedNodes</span>' +
        '</div>' +
        '<div class="raw-state-group">' +
          '<span class="raw-label">tnt</span>' +
          '<span class="raw-chip" data-state="tnt:idle">idle</span>' +
          '<span class="raw-chip" data-state="tnt:tapping">tapping</span>' +
          '<span class="raw-chip" data-state="tnt:grabbing">grabbing</span>' +
          '<span class="raw-chip" data-state="tnt:pinching">pinching</span>' +
          '<span class="raw-chip" data-state="tnt:catching">catching</span>' +
        '</div>';
      return body;
    };
    this.#subWindowManager.addWindow('rawStates', {
      id: 'rawStates',
      title: 'raw-states',
      content: rawContentFn,
      left: '10vw',
      top: '10vh',
      width: '33vw',
      height: '50vh'
    });

    // Toggle raw states with double-tap on statusBar
    statusBar.addEventListener('dblclick', () => {
      this.#subWindowManager.toggleWindow('rawStates');
    });
  }

  #init() {
    this.#touchOverlay = new TouchOverlay(this.#drawArea.touchOverlayElement, {
      dist: 5,
      tappingToPressingFrontier: 600,
      pressingToLongPressingFrontier: 1950,
      contactSize: 24,
      cursorSize: 14,
      rodEnabled: true,
      pulseEnabled: false
    });

    this.#drawArea.bindDrawEvents(this.#touchOverlay);
    this.#layoutManager = new LayoutManager(this.#corePanel, this.#drawArea);

    this.#statesMachine.on('colorChange', () => this.#drawArea._redraw());
    this.#statesMachine.on('sizeChange', () => this.#drawArea._redraw());
    this.#statesMachine.on('clearCanvas', () => this.#drawArea._redraw());

    this.#updateStatusBar();
    this.#updateRawStates();

    // Wire raw-state updates
    this.#statesMachine.on('modeChange', () => { this.#updateStatusBar(); this.#updateRawStates(); });
    this.#statesMachine.on('toolChange', () => { this.#updateStatusBar(); this.#updateRawStates(); });
    this.#statesMachine.on('colorChange', () => this.#updateStatusBar());
    this.#statesMachine.on('sizeChange', () => this.#updateStatusBar());
    this.#statesMachine.on('selectedPathChange', (path) => {
      this.#corePanel.syncSelection(path);
      this.#updateStatusBar();
      this.#updateRawStates();
    });
    this.#statesMachine.on('selectedNodesChange', () => {
      this.#corePanel.syncNodeSelection();
      this.#drawArea._redraw();
      this.#updateRawStates();
    });

    // SelectionManager events
    this.#selectionManager.on('selectionChange', () => this.#updateRawStates());
    this.#selectionManager.on('stateChange', () => this.#updateRawStates());
    this.#statesMachine.on('currentPathChange', () => this.#updateRawStates());
    this.#statesMachine.on('selectablesChange', () => this.#updateRawStates());
    this.#statesMachine.on('pathsChange', () => {
      const path = this.#statesMachine.selectedPath;
      if (path) this.#corePanel.syncSelection(path);
      this.#updateRawStates();
    });
    this.#statesMachine.on('historyChange', () => this.#updateHistoryButtons());

    // TNT state events
    this.#touchOverlay.engine.on('stateChange', (e) => this.#updateTntState(e.state));

    this.#updateHistoryButtons();
  }

  #updateRawStates() {
    const sm = this.#statesMachine;
    const win = this.#subWindowManager.getWindow('rawStates');
    const modal = win ? win.element : null;
    if (!modal) return;
    modal.querySelectorAll('.raw-chip').forEach(chip => {
      const key = chip.dataset.state;
      let active = false;
      if (key.startsWith('mode:')) active = sm.mode === key.slice(5);
      else if (key.startsWith('tool:')) active = sm.currentTool === key.slice(5);
      else if (key.startsWith('sel:')) active = sm.selectables === key.slice(4);
      else if (key === 'selMode:object') active = sm.selectMode === 'object';
      else if (key === 'selMode:node') active = sm.selectMode === 'node';
      else if (key === 'has:currentPath') active = !!sm.currentPath;
      else if (key === 'has:selectedPath') active = !!sm.selectedPath;
      else if (key === 'has:selectedNodes') active = (sm.selectedNodes && sm.selectedNodes.length > 0);
      chip.classList.toggle('active', active);
    });
  }

  #updateTntState(tntState) {
    const win = this.#subWindowManager.getWindow('rawStates');
    const modal = win ? win.element : null;
    if (!modal) return;
    modal.querySelectorAll('.raw-chip').forEach(chip => {
      if (chip.dataset.state.startsWith('tnt:')) {
        const state = chip.dataset.state.slice(4);
        chip.classList.toggle('active', state === tntState);
      }
    });
  }

  #updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = !this.#statesMachine.canUndo();
    if (redoBtn) redoBtn.disabled = !this.#statesMachine.canRedo();
  }

  #updateStatusBar() {
    const statusMode = document.getElementById('statusMode');
    const statusTool = document.getElementById('statusTool');
    const statusColor = document.getElementById('statusColor');
    const statusSize = document.getElementById('statusSize');
    const statusSelected = document.getElementById('statusSelected');

    if (statusMode) statusMode.textContent = this.#statesMachine.mode;
    if (statusTool) statusTool.textContent = this.#statesMachine.currentTool;
    if (statusColor) statusColor.textContent = this.#statesMachine.currentColor;
    if (statusSize) statusSize.textContent = this.#statesMachine.currentSize;
    if (statusSelected) {
      const selected = this.#statesMachine.selectedPath;
      statusSelected.textContent = selected ? `${selected.color}, ${selected.size}px` : '-';
    }
    const statusSelectables = document.getElementById('statusSelectables');
    if (statusSelectables) statusSelectables.textContent = this.#statesMachine.selectables;
  }
}

let app = null;
document.addEventListener('DOMContentLoaded', () => {
  app = new Application();
});
