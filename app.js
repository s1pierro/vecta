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
      '<span><span class="label">Tool:</span><span class="value" id="statusTool">-</span></span>' +
      '<span><span class="label">Couleur:</span><span class="value" id="statusColor">-</span></span>' +
      '<span><span class="label">Taille:</span><span class="value" id="statusSize">-</span></span>' +
      '<span><span class="label">Sélection:</span><span class="value" id="statusSelected">-</span></span>';
    container.appendChild(statusBar);
  }

  #init() {
    this.#touchOverlay = new TouchOverlay(this.#drawArea.touchOverlayElement, {
      dist: 0,
      tappingToPressingFrontier: 600,
      pressingToLongPressingFrontier: 1950,
      contactSize: 24,
      cursorSize: 14,
      rodEnabled: true,
      pulseEnabled: true
    });

    this.#drawArea.bindDrawEvents(this.#touchOverlay);
    this.#layoutManager = new LayoutManager(this.#corePanel, this.#drawArea);

    this.#statesMachine.on('colorChange', () => this.#drawArea._redraw());
    this.#statesMachine.on('sizeChange', () => this.#drawArea._redraw());
    this.#statesMachine.on('clearCanvas', () => this.#drawArea._redraw());

    this.#updateStatusBar();

    this.#statesMachine.on('modeChange', () => this.#updateStatusBar());
    this.#statesMachine.on('toolChange', () => this.#updateStatusBar());
    this.#statesMachine.on('colorChange', () => this.#updateStatusBar());
    this.#statesMachine.on('sizeChange', () => this.#updateStatusBar());
    this.#statesMachine.on('selectedPathChange', () => this.#updateStatusBar());
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
  }
}

let app = null;
document.addEventListener('DOMContentLoaded', () => {
  app = new Application();
});
