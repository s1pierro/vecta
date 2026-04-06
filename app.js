console.log('=== VECTA APP.JS LOADING ===');
window.onerror = function(msg, url, line, col, err) {
  console.log('ERROR:', msg, 'at line', line);
};
var LayoutManager = (function() {
  function LayoutManager(corePanel, drawArea) {
    this.corePanel = corePanel;
    this.drawArea = drawArea;
    this.appGround = document.getElementById('app-ground');
    this._init();
  }

  LayoutManager.prototype._init = function() {
    var self = this;
    window.addEventListener('resize', function() { self._handleResize(); });
    this._handleResize();
  };

  LayoutManager.prototype._handleResize = function() {
    var isPortrait = window.matchMedia('(orientation: portrait)').matches;
    this.applyLayout(isPortrait ? 'portrait' : 'landscape');
  };

  LayoutManager.prototype.applyLayout = function(orientation) {
    this.appGround.classList.remove('landscape', 'portrait');
    this.appGround.classList.add(orientation);
  };

  return LayoutManager;
})();

var Application = (function() {
  function Application(options) {
    options = options || {};
    this.container = options.container || document.body;
    this.statesMachine = new StateMachine();
    this.corePanel = new CorePanel(this.statesMachine);
    this._drawArea = new DrawArea(this.statesMachine);
    this.touchOverlay = null;
    this.layoutManager = null;
    
    this.buildDom(this.container);
    this._init();
  }

  Application.prototype.buildDom = function(container) {
    var appGround = document.getElementById('app-ground');
    if (!appGround) {
      appGround = document.createElement('div');
      appGround.id = 'app-ground';
      appGround.className = 'landscape';
      container.appendChild(appGround);
    }
    this.domElement = appGround;

    var panelContainer = document.createElement('div');
    panelContainer.id = 'corePanelContainer';
    this.corePanel.buildDom(panelContainer);
    appGround.appendChild(panelContainer);

    var drawContainer = document.createElement('div');
    drawContainer.id = 'drawAreaContainer';
    this._drawArea.buildDom(drawContainer);
    appGround.appendChild(drawContainer);
  };

  Application.prototype._init = function() {
    var self = this;
    var drawAreaContainer = this._drawArea.container;
    console.log('Creating TouchOverlay on:', drawAreaContainer);
    
    this.touchOverlay = new TouchOverlay(this._drawArea.touchOverlayElement, {
      dist: 0,
      tappingToPressingFrontier: 600,
      pressingToLongPressingFrontier: 1950,
      contactSize: 24,
      cursorSize: 14,
      rodEnabled: true,
      pulseEnabled: true
    });

    console.log('TouchOverlay created:', !!this.touchOverlay);
    console.log('TouchOverlay.engine:', this.touchOverlay.engine);

    this._drawArea.bindDrawEvents(this.touchOverlay);
    this.layoutManager = new LayoutManager(this.corePanel, this._drawArea);

    this.statesMachine.on('colorChange', function() { self._drawArea._redraw(); });
    this.statesMachine.on('sizeChange', function() { self._drawArea._redraw(); });
    this.statesMachine.on('clearCanvas', function() { self._drawArea._redraw(); });

    this._updateStatusBar();

    this.statesMachine.on('modeChange', function() { self._updateStatusBar(); });
    this.statesMachine.on('toolChange', function() { self._updateStatusBar(); });
    this.statesMachine.on('colorChange', function() { self._updateStatusBar(); });
    this.statesMachine.on('sizeChange', function() { self._updateStatusBar(); });
    this.statesMachine.on('selectedPathChange', function() { self._updateStatusBar(); });

    console.log('Vecta initialized');
  };

  Application.prototype._updateStatusBar = function() {
    var statusMode = document.getElementById('statusMode');
    var statusTool = document.getElementById('statusTool');
    var statusColor = document.getElementById('statusColor');
    var statusSize = document.getElementById('statusSize');
    var statusSelected = document.getElementById('statusSelected');
    
    if (statusMode) statusMode.textContent = this.statesMachine.mode;
    if (statusTool) statusTool.textContent = this.statesMachine.currentTool;
    if (statusColor) statusColor.textContent = this.statesMachine.currentColor;
    if (statusSize) statusSize.textContent = this.statesMachine.currentSize;
    if (statusSelected) {
      var selected = this.statesMachine.selectedPath;
      statusSelected.textContent = selected ? (selected.color + ', ' + selected.size + 'px') : '-';
    }
  };

  Object.defineProperty(Application.prototype, 'drawArea', {
    get: function() { return this._drawArea; }
  });

  return Application;
})();

var app = null;
document.addEventListener('DOMContentLoaded', function() {
  app = new Application();
});
