var APP_NAME = 'Vecta';
var APP_VERSION = '0.1';

var StateMachine = (function() {
  function StateMachine() {
    this._state = {
      currentTool: 'draw',
      currentColor: '#ffffff',
      currentSize: 8,
      paths: [],
      currentPath: null,
      scale: 0.5,
      panX: 0,
      panY: 0
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

  Object.defineProperty(StateMachine.prototype, 'scale', {
    get: function() { return this._state.scale; },
    set: function(v) { this._state.scale = Math.max(0.5, Math.min(3.0, v)); this._emit('zoomChange', this._state); }
  });

  Object.defineProperty(StateMachine.prototype, 'panX', {
    get: function() { return this._state.panX; },
    set: function(v) { this._state.panX = v; this._emit('zoomChange', this._state); }
  });

  Object.defineProperty(StateMachine.prototype, 'panY', {
    get: function() { return this._state.panY; },
    set: function(v) { this._state.panY = v; this._emit('zoomChange', this._state); }
  });

  StateMachine.prototype.resetZoom = function() {
    this._state.scale = 0.5;
    this._state.panX = 0;
    this._state.panY = 0;
    this._emit('zoomChange', this._state);
  };

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

    var resetBtn = document.createElement('button');
    resetBtn.id = 'resetBtn';
    resetBtn.className = 'panel-btn';
    resetBtn.title = 'Reset Zoom';
    resetBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
    resetBtn.addEventListener('click', function() {
      self.stateMachine.resetZoom();
    });

    var appInfo = document.createElement('div');
    appInfo.className = 'panel-app-info';
    appInfo.innerHTML = '<span class="app-name">' + APP_NAME + '</span><span class="app-version">' + APP_VERSION + '</span>';

    sectionHeader.appendChild(fullscreenBtn);
    sectionHeader.appendChild(clearBtn);
    sectionHeader.appendChild(resetBtn);
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
    this.svg = null;
    this.svgPaths = null;
    this.svgCurrentPath = null;
  }

  DrawArea.prototype.buildDom = function(container) {
    var drawArea = document.createElement('div');
    drawArea.id = 'drawArea';

    var touchOverlay = document.createElement('div');
    touchOverlay.id = 'touchOverlay';
    drawArea.appendChild(touchOverlay);

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('id', 'drawAreaSvg');
    this.svg.setAttribute('viewBox', '0 0 2970 2100');
    this.svg.setAttribute('width', '2970');
    this.svg.setAttribute('height', '2100');

    this.svgPaths = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgPaths.setAttribute('id', 'svgPaths');

    this.svgCurrentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.svgCurrentPath.setAttribute('id', 'currentPath');

    this.svg.appendChild(this.svgPaths);
    this.svg.appendChild(this.svgCurrentPath);
    drawArea.appendChild(this.svg);
    this.el = drawArea;
    this.touchOverlay = touchOverlay;
    container.appendChild(drawArea);
  };

  Object.defineProperty(DrawArea.prototype, 'svgElement', {
    get: function() { return this.svg; }
  });

  Object.defineProperty(DrawArea.prototype, 'touchOverlayElement', {
    get: function() { return this.touchOverlay; }
  });

  Object.defineProperty(DrawArea.prototype, 'container', {
    get: function() { return this.el; }
  });

  DrawArea.prototype._updateViewBox = function() {
    if (!this.svg) return;
    var scale = this.stateMachine.scale;
    var panX = this.stateMachine.panX;
    var panY = this.stateMachine.panY;
    var w = 2970 / scale;
    var h = 2100 / scale;
    this.svg.setAttribute('viewBox', panX + ' ' + panY + ' ' + w + ' ' + h);
  };

  DrawArea.prototype._screenToDoc = function(screenX, screenY) {
    if (!this.svg) return { x: screenX, y: screenY };
    var rect = this.svg.getBoundingClientRect();
    var scale = this.stateMachine.scale;
    var panX = this.stateMachine.panX;
    var panY = this.stateMachine.panY;
    var scrollLeft = this.el.scrollLeft;
    var scrollTop = this.el.scrollTop;
    var docX = (screenX + scrollLeft - rect.left) / scale + panX;
    var docY = (screenY + scrollTop - rect.top) / scale + panY;
    return { x: docX, y: docY };
  };

  DrawArea.prototype._pointsToSvgPath = function(points) {
    if (!points || points.length < 2) return '';
    var d = 'M ' + points[0].x + ' ' + points[0].y;
    for (var i = 1; i < points.length; i++) {
      d += ' L ' + points[i].x + ' ' + points[i].y;
    }
    return d;
  };

  DrawArea.prototype._redraw = function() {
    if (!this.svg || !this.svgPaths) return;

    this.svgPaths.innerHTML = '';

    var paths = this.stateMachine.paths;
    var self = this;
    paths.forEach(function(path) {
      if (path.points.length < 2) return;
      var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', self._pointsToSvgPath(path.points));
      pathEl.setAttribute('stroke', path.color);
      pathEl.setAttribute('stroke-width', path.size);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      self.svgPaths.appendChild(pathEl);
    });

    var currentPath = this.stateMachine.currentPath;
    if (currentPath && currentPath.length >= 2) {
      this.svgCurrentPath.setAttribute('d', this._pointsToSvgPath(currentPath));
      this.svgCurrentPath.setAttribute('stroke', this.stateMachine.currentColor);
      this.svgCurrentPath.setAttribute('stroke-width', this.stateMachine.currentSize);
      this.svgCurrentPath.setAttribute('fill', 'none');
      this.svgCurrentPath.setAttribute('stroke-linecap', 'round');
      this.svgCurrentPath.setAttribute('stroke-linejoin', 'round');
    } else {
      this.svgCurrentPath.setAttribute('d', '');
    }
  };

  DrawArea.prototype.bindDrawEvents = function(overlay) {
    var self = this;
    this.stateMachine.on('pathsChange', function() { self._redraw(); });
    this.stateMachine.on('currentPathChange', function() { self._redraw(); });
    this.stateMachine.on('zoomChange', function() { self._updateViewBox(); });

    this._updateViewBox();

    overlay.engine.on('cursorActivate', function(e) {
      console.log('[TNT] cursorActivate:', e.touchX, e.touchY);
      var pt = self._screenToDoc(e.touchX, e.touchY);
      self.stateMachine.currentPath = [{ x: pt.x, y: pt.y }];
    });

    overlay.engine.on('cursorMove', function(e) {
      var path = self.stateMachine.currentPath;
      if (path) {
        var pt = self._screenToDoc(e.touchX, e.touchY);
        path.push({ x: pt.x, y: pt.y });
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

    overlay.engine.on('pinchChange', function(e) {
      console.log('[TNT] pinchChange:', e.scale);
      var newScale = self.stateMachine.scale * e.scale;
      newScale = Math.max(0.5, Math.min(3.0, newScale));
      self.stateMachine.scale = newScale;
    });

    overlay.engine.on('catchMove', function(e) {
      if (self.stateMachine.currentPath) return;
      console.log('[TNT] catchMove:', e.moveX, e.moveY);
      var scale = self.stateMachine.scale;
      self.stateMachine.panX -= e.moveX / scale;
      self.stateMachine.panY -= e.moveY / scale;
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
