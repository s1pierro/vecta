var APP_NAME = 'Vecta';
var APP_VERSION = '0.1';

var StateMachine = (function() {
  function StateMachine() {
    this._state = {
      currentTool: 'draw',
      currentColor: '#ffffff',
      currentSize: 8,
      paths: [],
      currentPath: null
    };
    this._listeners = {};
  }

  Object.defineProperty(StateMachine.prototype, 'state', {
    get: function() {
      var s = {};
      for (var k in this._state) s[k] = this._state[k];
      return s;
    }
  });

  Object.defineProperty(StateMachine.prototype, 'currentTool', {
    get: function() { return this._state.currentTool; },
    set: function(v) { this._state.currentTool = v; this._emit('toolChange', v); }
  });

  Object.defineProperty(StateMachine.prototype, 'currentColor', {
    get: function() { return this._state.currentColor; },
    set: function(v) { this._state.currentColor = v; this._emit('colorChange', v); }
  });

  Object.defineProperty(StateMachine.prototype, 'currentSize', {
    get: function() { return this._state.currentSize; },
    set: function(v) { this._state.currentSize = v; this._emit('sizeChange', v); }
  });

  Object.defineProperty(StateMachine.prototype, 'paths', {
    get: function() { return this._state.paths; },
    set: function(v) { this._state.paths = v; this._emit('pathsChange', v); }
  });

  Object.defineProperty(StateMachine.prototype, 'currentPath', {
    get: function() { return this._state.currentPath; },
    set: function(v) { this._state.currentPath = v; this._emit('currentPathChange', v); }
  });

  StateMachine.prototype.addPath = function(path) {
    this._state.paths.push(path);
    this._emit('pathsChange', this._state.paths);
  };

  StateMachine.prototype.on = function(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  };

  StateMachine.prototype._emit = function(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(function(cb) { cb(data); });
    }
  };

  StateMachine.prototype.clearCanvas = function() {
    this._state.paths = [];
    this._emit('clearCanvas');
  };

  return StateMachine;
})();

var CorePanel = (function() {
  function CorePanel(stateMachine) {
    this.stateMachine = stateMachine;
    this.el = null;
  }

  CorePanel.prototype.buildDom = function(container) {
    var panel = document.createElement('div');
    panel.id = 'corePanel';
    var self = this;

    // Section Header
    var sectionHeader = document.createElement('div');
    sectionHeader.className = 'panel-section panel-section-header';

    var fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'fullscreenBtn';
    fullscreenBtn.className = 'panel-btn';
    fullscreenBtn.title = 'Plein ecran';
    fullscreenBtn.innerHTML = '<svg class="expand-icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>' +
      '<svg class="compress-icon" viewBox="0 0 24 24" style="display:none"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>';
    fullscreenBtn.addEventListener('click', function() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    var clearBtn = document.createElement('button');
    clearBtn.id = 'clearBtn';
    clearBtn.className = 'panel-btn';
    clearBtn.title = 'Effacer';
    clearBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
    clearBtn.addEventListener('click', function() {
      self.stateMachine.clearCanvas();
    });

    var appInfo = document.createElement('div');
    appInfo.className = 'panel-app-info';
    appInfo.innerHTML = '<span class="app-name">' + APP_NAME + '</span><span class="app-version">' + APP_VERSION + '</span>';

    sectionHeader.appendChild(fullscreenBtn);
    sectionHeader.appendChild(clearBtn);
    sectionHeader.appendChild(appInfo);
    panel.appendChild(sectionHeader);

    // Separator 1
    var sep1 = document.createElement('div');
    sep1.className = 'panel-sep';
    panel.appendChild(sep1);

    // Section Tools
    var sectionTool = document.createElement('div');
    sectionTool.className = 'panel-section panel-section-tool';

    var tools = document.createElement('div');
    tools.id = 'panelTools';
    var toolButtons = ['draw', 'select', 'pan'];
    var toolIcons = {
      draw: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>',
      select: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>',
      pan: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>'
    };
    toolButtons.forEach(function(tool) {
      var btn = document.createElement('button');
      btn.className = 'panel-tool-btn' + (tool === 'draw' ? ' active' : '');
      btn.dataset.tool = tool;
      btn.innerHTML = '<svg viewBox="0 0 24 24">' + toolIcons[tool] + '</svg>';
      btn.addEventListener('click', function() { self._selectTool(tool); });
      tools.appendChild(btn);
    });
    sectionTool.appendChild(tools);
    panel.appendChild(sectionTool);

    // Separator 2
    var sep2 = document.createElement('div');
    sep2.className = 'panel-sep';
    panel.appendChild(sep2);

    // Section Colors
    var sectionColors = document.createElement('div');
    sectionColors.className = 'panel-section panel-section-colors';

    var colors = document.createElement('div');
    colors.id = 'panelColors';
    var colorList = ['#1a1a2e', '#ffffff', '#ff5252', '#4fc3f7', '#69f0ae', '#ffd54f', '#ba68c8', '#ff9800', '#212121'];
    colorList.forEach(function(color, i) {
      var btn = document.createElement('button');
      btn.className = 'panel-color-btn' + (i === 0 ? ' active' : '');
      btn.dataset.color = color;
      btn.style.background = color;
      btn.addEventListener('click', function() { self._selectColor(color); });
      colors.appendChild(btn);
    });
    sectionColors.appendChild(colors);
    panel.appendChild(sectionColors);

    // Separator 3
    var sep3 = document.createElement('div');
    sep3.className = 'panel-sep';
    panel.appendChild(sep3);

    // Section Sizes
    var sectionSizes = document.createElement('div');
    sectionSizes.className = 'panel-section panel-section-sizes';

    var sizes = document.createElement('div');
    sizes.id = 'panelSizes';
    var sizeList = [2, 4, 8, 16];
    sizeList.forEach(function(size, i) {
      var btn = document.createElement('button');
      btn.className = 'panel-size-btn' + (i === 2 ? ' active' : '');
      btn.dataset.size = size;
      btn.addEventListener('click', function() { self._selectSize(size); });
      sizes.appendChild(btn);
    });
    sectionSizes.appendChild(sizes);
    panel.appendChild(sectionSizes);

    this.el = panel;
    container.appendChild(panel);

    document.addEventListener('fullscreenchange', function() {
      var expandIcon = fullscreenBtn.querySelector('.expand-icon');
      var compressIcon = fullscreenBtn.querySelector('.compress-icon');
      if (document.fullscreenElement) {
        expandIcon.style.display = 'none';
        compressIcon.style.display = 'block';
      } else {
        expandIcon.style.display = 'block';
        compressIcon.style.display = 'none';
      }
    });
  };

  CorePanel.prototype._selectTool = function(tool) {
    var self = this;
    this.el.querySelectorAll('.panel-tool-btn').forEach(function(b) { b.classList.remove('active'); });
    this.el.querySelector('[data-tool="' + tool + '"]').classList.add('active');
    this.stateMachine.currentTool = tool;
  };

  CorePanel.prototype._selectColor = function(color) {
    var self = this;
    this.el.querySelectorAll('.panel-color-btn').forEach(function(b) { b.classList.remove('active'); });
    this.el.querySelector('[data-color="' + color + '"]').classList.add('active');
    this.stateMachine.currentColor = color;
  };

  CorePanel.prototype._selectSize = function(size) {
    var self = this;
    this.el.querySelectorAll('.panel-size-btn').forEach(function(b) { b.classList.remove('active'); });
    this.el.querySelector('[data-size="' + size + '"]').classList.add('active');
    this.stateMachine.currentSize = size;
  };

  return CorePanel;
})();

var DrawArea = (function() {
  function DrawArea(stateMachine) {
    this.stateMachine = stateMachine;
    this.el = null;
    this.canvas = null;
    this.ctx = null;
  }

  DrawArea.prototype.buildDom = function(container) {
    var drawArea = document.createElement('div');
    drawArea.id = 'drawArea';

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'canvas';
    this.ctx = this.canvas.getContext('2d');

    drawArea.appendChild(this.canvas);
    this.el = drawArea;
    container.appendChild(drawArea);

    this._resizeCanvas();
    var self = this;
    window.addEventListener('resize', function() { self._resizeCanvas(); });
  };

  Object.defineProperty(DrawArea.prototype, 'canvasElement', {
    get: function() { return this.canvas; }
  });

  Object.defineProperty(DrawArea.prototype, 'container', {
    get: function() { return this.el; }
  });

  Object.defineProperty(DrawArea.prototype, 'context', {
    get: function() { return this.ctx; }
  });

  DrawArea.prototype._resizeCanvas = function() {
    if (!this.el || !this.canvas) return;
    var w = this.el.clientWidth;
    var h = this.el.clientHeight;
    this.canvas.width = w * window.devicePixelRatio;
    this.canvas.height = h * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this._redraw();
  };

  DrawArea.prototype._redraw = function() {
    if (!this.ctx || !this.el) return;
    var w = this.el.clientWidth;
    var h = this.el.clientHeight;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    var paths = this.stateMachine.paths;
    var self = this;
    paths.forEach(function(path) {
      if (path.points.length < 2) return;
      self.ctx.strokeStyle = path.color;
      self.ctx.lineWidth = path.size;
      self.ctx.beginPath();
      self.ctx.moveTo(path.points[0].x, path.points[0].y);
      for (var i = 1; i < path.points.length; i++) {
        self.ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      self.ctx.stroke();
    });

    var currentPath = this.stateMachine.currentPath;
    if (currentPath && currentPath.length >= 2) {
      this.ctx.strokeStyle = this.stateMachine.currentColor;
      this.ctx.lineWidth = this.stateMachine.currentSize;
      this.ctx.beginPath();
      this.ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (var j = 1; j < currentPath.length; j++) {
        this.ctx.lineTo(currentPath[j].x, currentPath[j].y);
      }
      this.ctx.stroke();
    }
  };

  DrawArea.prototype.bindDrawEvents = function(overlay) {
    var self = this;
    this.stateMachine.on('pathsChange', function() { self._redraw(); });
    this.stateMachine.on('currentPathChange', function() { self._redraw(); });

    overlay.engine.on('cursorActivate', function(e) {
      console.log('[TNT] cursorActivate:', e.touchX, e.touchY);
      self.stateMachine.currentPath = [{ x: e.touchX, y: e.touchY }];
    });

    overlay.engine.on('cursorMove', function(e) {
      var path = self.stateMachine.currentPath;
      if (path) {
        path.push({ x: e.touchX, y: e.touchY });
        self._redraw();
      }
    });

    overlay.engine.on('cursorRelease', function(e) {
      console.log('[TNT] cursorRelease');
      var path = self.stateMachine.currentPath;
      if (path && path.length > 1) {
        self.stateMachine.addPath({
          points: path,
          color: self.stateMachine.currentColor,
          size: self.stateMachine.currentSize
        });
      }
      self.stateMachine.currentPath = null;
    });

    overlay.engine.on('tap', function(e) {
      console.log('[TNT] tap:', e.x, e.y);
    });

    overlay.engine.on('tntBang', function() {
      console.log('[TNT] tntBang');
    });
  };

  return DrawArea;
})();
