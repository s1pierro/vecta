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
  #corePanel;
  #drawArea;
  #touchOverlay;
  #layoutManager;

  constructor(options = {}) {
    this.#statesMachine = new StateMachine();
    this.#corePanel = new CorePanel(this.#statesMachine);
    this.#drawArea = new DrawArea(this.#statesMachine);

    this.buildDom(options.container || document.body);
    this.#init();
  }

  get drawArea() {
    return this.#drawArea;
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
    container.appendChild(statusBar);

    // Raw states modal — draggable, resizable debug panel
    const modal = document.createElement('div');
    modal.id = 'rawStatesModal';
    modal.style.display = 'none'; // hidden by default, toggle with double-tap on statusBar
    modal.innerHTML =
      '<div class="raw-modal-header">' +
        '<span class="raw-modal-title">raw-states</span>' +
        '<button class="raw-modal-close" title="Close">×</button>' +
      '</div>' +
      '<div class="raw-modal-body">' +
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
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Toggle visibility with double-tap on statusBar
    statusBar.addEventListener('dblclick', () => {
      modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
    });

    // Close button
    modal.querySelector('.raw-modal-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Drag logic
    const header = modal.querySelector('.raw-modal-header');
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

    // Resize logic
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
    const modal = document.getElementById('rawStatesModal');
    if (!modal) return;
    modal.querySelectorAll('.raw-chip').forEach(chip => {
      const key = chip.dataset.state;
      let active = false;
      if (key.startsWith('mode:')) active = sm.mode === key.slice(5);
      else if (key.startsWith('tool:')) active = sm.currentTool === key.slice(5);
      else if (key.startsWith('sel:')) active = sm.selectables === key.slice(4);
      else if (key === 'has:currentPath') active = !!sm.currentPath;
      else if (key === 'has:selectedPath') active = !!sm.selectedPath;
      else if (key === 'has:selectedNodes') active = (sm.selectedNodes && sm.selectedNodes.length > 0);
      chip.classList.toggle('active', active);
    });
  }

  #updateTntState(tntState) {
    const modal = document.getElementById('rawStatesModal');
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
