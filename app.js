/**
 * SubWindow — a draggable, resizable floating panel.
 * Generic reusable window with header (title + close button), body, and resize handle.
 */
class SubWindow {
  static STORAGE_KEY = 'vectux_windows';
  #id;
  #title;
  #contentBuilder;
  #el = null;
  #visible = false;
  #position;  // {left, top}
  #size;      // {width, height}
  #container;

  constructor(options = {}) {
    this.#id = options.id || `subwindow-${Date.now()}`;
    this.#title = options.title || 'Window';
    this.#contentBuilder = options.content || null;
    this.#container = null;

    // Try to restore from localStorage
    const saved = this.#loadFromStorage();
    if (saved) {
      this.#position = saved.position;
      this.#size = saved.size;
      this.#visible = saved.visible;
    } else {
      this.#position = { left: options.left || '10vw', top: options.top || '10vh' };
      this.#size = { width: options.width || '33vw', height: options.height || '50vh' };
    }
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
    this.#container = container;

    // Apply saved visibility
    if (this.#visible) {
      modal.style.display = 'flex';
    }

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
    window.addEventListener('mouseup', () => { dragging = false; this.#saveToStorage(); });
    window.addEventListener('touchend', () => { dragging = false; this.#saveToStorage(); });

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
    window.addEventListener('mouseup', () => { resizing = false; this.#saveToStorage(); });
    window.addEventListener('touchend', () => { resizing = false; this.#saveToStorage(); });
  }

  show() {
    if (this.#el) {
      this.#el.style.display = 'flex';
      this.#visible = true;
      this.#saveToStorage();
      this.#emit('show');
    }
  }

  hide() {
    if (this.#el) {
      this.#el.style.display = 'none';
      this.#visible = false;
      this.#saveToStorage();
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

  /** Load saved state from localStorage */
  #loadFromStorage() {
    try {
      const data = localStorage.getItem(SubWindow.STORAGE_KEY);
      if (!data) return null;
      const all = JSON.parse(data);
      return all[this.#id] || null;
    } catch { return null; }
  }

  /** Save current state to localStorage */
  #saveToStorage() {
    try {
      const data = JSON.parse(localStorage.getItem(SubWindow.STORAGE_KEY) || '{}');
      data[this.#id] = {
        position: {
          left: this.#el ? this.#el.style.left : this.#position.left,
          top: this.#el ? this.#el.style.top : this.#position.top
        },
        size: {
          width: this.#el ? this.#el.style.width : this.#size.width,
          height: this.#el ? this.#el.style.height : this.#size.height
        },
        visible: this.#visible
      };
      localStorage.setItem(SubWindow.STORAGE_KEY, JSON.stringify(data));
    } catch {}
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

class Application {
  #statesMachine;
  #selectionManager;
  #subWindowManager;
  #corePanel;
  #drawArea;
  #touchOverlay;

  constructor(options = {}) {
    this.#statesMachine = new StateMachine();
    this.#selectionManager = new SelectionManager(this.#statesMachine);
    this.#statesMachine.setSelectionManager(this.#selectionManager);
    this.#subWindowManager = new SubWindowManager(document.body);
    this.#corePanel = new CorePanel(this.#statesMachine, this.#selectionManager, this.#subWindowManager);
    this.#drawArea = new DrawArea(this.#statesMachine, this.#selectionManager);

    // Init states async then build DOM
    this.#init().then(() => {
      this.buildDom(options.container || document.body);
      this.#wireEvents();
    });
  }

  async #init() {
    await this.#statesMachine.loadStates();
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

    // Build top bar — appends directly to body so position:fixed works
    this.#corePanel.buildDom(document.body);

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
      '<span><span class="label">Sélection:</span><span class="value" id="statusSelected">-</span></span>' +
      '<span><span class="label">Zoom:</span><span class="value" id="statusZoom">-</span></span>' +
      '<span><span class="label">ViewBox:</span><span class="value" id="statusViewBox">-</span></span>';
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

    // Register raw-states modal as a SubWindow with state editor
    const rawContentFn = () => {
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;flex-direction:column;';

      // State chips section
      const chipsSection = document.createElement('div');
      chipsSection.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      chipsSection.innerHTML =
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
      body.appendChild(chipsSection);

      // Separator
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);width:100%;';
      body.appendChild(sep);

      // State definitions editor using JsonEditCard
      const editorSection = document.createElement('div');
      editorSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      editorSection.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="color:rgba(255,255,255,0.35);font-size:0.65em;text-transform:uppercase;letter-spacing:1px;">State Definitions</span>' +
          '<button id="rawExportBtn" style="padding:2px 8px;background:rgba(79,195,247,0.15);border:1px solid rgba(79,195,247,0.3);border-radius:3px;color:#4fc3f7;cursor:pointer;font-size:0.65em;">Export</button>' +
        '</div>';

      const editorContainer = document.createElement('div');
      editorContainer.id = 'rawStateEditor';
      editorContainer.style.cssText = 'max-height:300px;overflow-y:auto;';
      editorSection.appendChild(editorContainer);

      const applyBtn = document.createElement('button');
      applyBtn.id = 'rawApplyBtn';
      applyBtn.style.cssText = 'padding:4px 12px;background:rgba(105,240,174,0.15);border:1px solid rgba(105,240,174,0.3);border-radius:3px;color:#69f0ae;cursor:pointer;font-size:0.7em;align-self:flex-start;';
      applyBtn.textContent = 'Apply Changes';

      const resetBtn = document.createElement('button');
      resetBtn.id = 'rawResetBtn';
      resetBtn.style.cssText = 'padding:4px 12px;background:rgba(255,80,80,0.15);border:1px solid rgba(255,80,80,0.3);border-radius:3px;color:#ff5252;cursor:pointer;font-size:0.7em;align-self:flex-start;';
      resetBtn.textContent = 'Reset Defaults';

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;align-items:center;';
      btnRow.appendChild(applyBtn);
      btnRow.appendChild(resetBtn);
      editorSection.appendChild(btnRow);
      body.appendChild(editorSection);

      // Build editor cards
      let stateCards = [];
      const buildEditor = () => {
        editorContainer.innerHTML = '';
        stateCards = [];
        const defs = this.#statesMachine.getStateDefinitions();
        defs.forEach((def, i) => {
          const cardRow = document.createElement('div');
          cardRow.className = 'raw-state-card';
          cardRow.style.cssText = 'margin-bottom:4px;';

          const headerRow = document.createElement('div');
          headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;';
          const nameTag = document.createElement('span');
          nameTag.style.cssText = 'color:#4fc3f7;font-size:0.7em;font-family:monospace;font-weight:bold;';
          nameTag.textContent = def.name;
          const delBtn = document.createElement('button');
          delBtn.style.cssText = 'padding:1px 6px;background:rgba(255,80,80,0.15);border:1px solid rgba(255,80,80,0.3);border-radius:3px;color:#ff5252;cursor:pointer;font-size:0.6em;';
          delBtn.textContent = '×';
          delBtn.addEventListener('click', () => {
            defs.splice(i, 1);
            this.#statesMachine.setStateDefinitions(defs);
            buildEditor();
          });
          headerRow.appendChild(nameTag);
          headerRow.appendChild(delBtn);
          cardRow.appendChild(headerRow);

          const cardDest = document.createElement('div');
          cardRow.appendChild(cardDest);
          editorContainer.appendChild(cardRow);

          const card = new JsonEditCard(def, cardDest, { showType: true });
          card.on('change', () => {
            defs[i] = card.getValue();
            this.#statesMachine.setStateDefinitions(defs);
          });
          stateCards.push(card);
        });

        // Add state button at bottom of editor
        const addCardBtn = document.createElement('button');
        addCardBtn.className = 'raw-add-state-btn';
        addCardBtn.style.cssText = 'display:block;width:100%;padding:6px;margin-top:4px;background:rgba(105,240,174,0.08);border:1px dashed rgba(105,240,174,0.25);border-radius:4px;color:#69f0ae;cursor:pointer;font-size:0.7em;font-family:monospace;';
        addCardBtn.textContent = '+ Add State';
        addCardBtn.addEventListener('click', () => {
          const d = this.#statesMachine.getStateDefinitions();
          d.push({ name: 'newState', type: 'generic', family: '', exclusiveFields: [], priority: 0, tags: [], meta: {}, activationCondition: null, maintainCondition: null, deactivationCondition: null, onEnter: null, onExit: null, onMaintain: null });
          this.#statesMachine.setStateDefinitions(d);
          buildEditor();
        });
        editorContainer.appendChild(addCardBtn);
      };

      // Wire buttons
      setTimeout(() => {
        buildEditor();
        const applyB = document.getElementById('rawApplyBtn');
        const resetB = document.getElementById('rawResetBtn');
        const exportBtn = document.getElementById('rawExportBtn');
        if (applyB) {
          applyB.addEventListener('click', () => {
            const defs = stateCards.map(c => c.getValue());
            this.#statesMachine.setStateDefinitions(defs);
            buildEditor();
          });
        }
        if (resetB) {
          resetB.addEventListener('click', async () => {
            try {
              const defaults = await StateLoader.fetchDefaults();
              this.#statesMachine.setStateDefinitions(defaults);
              buildEditor();
            } catch (e) {
              console.error('Reset failed:', e);
            }
          });
        }
        if (exportBtn) {
          exportBtn.addEventListener('click', () => StateLoader.export());
        }
      }, 0);

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

    // Event log SubWindow
    const eventLogContentFn = () => {
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:6px;';

      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
      headerRow.innerHTML = '<span style="color:rgba(255,255,255,0.35);font-size:0.65em;text-transform:uppercase;letter-spacing:1px;">Event Log</span>';
      const clearBtn = document.createElement('button');
      clearBtn.style.cssText = 'padding:2px 8px;background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.2);border-radius:3px;color:#ff5252;cursor:pointer;font-size:0.6em;';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        this.#statesMachine.clearEventLog();
        logContainer.innerHTML = '';
      });
      headerRow.appendChild(clearBtn);
      body.appendChild(headerRow);

      const logContainer = document.createElement('div');
      logContainer.id = 'eventLogContainer';
      logContainer.style.cssText = 'flex:1;overflow-y:auto;font-family:monospace;font-size:0.65em;max-height:60vh;';
      body.appendChild(logContainer);

      // Populate initial log (newest first)
      const renderEntry = (entry) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.03);';
        const time = document.createElement('span');
        time.style.cssText = 'color:rgba(255,255,255,0.2);flex-shrink:0;';
        time.textContent = entry.time;
        const evt = document.createElement('span');
        evt.style.cssText = 'color:#4fc3f7;flex-shrink:0;';
        evt.textContent = entry.event;
        const dat = document.createElement('span');
        dat.style.cssText = 'color:rgba(255,255,255,0.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        dat.textContent = entry.data;
        row.appendChild(time);
        row.appendChild(evt);
        row.appendChild(dat);
        logContainer.prepend(row);
      };

      this.#statesMachine.eventLog.forEach(renderEntry);

      // Subscribe to new events (prepend newest first)
      this.#statesMachine.on('eventLog', (entry) => {
        if (entry) renderEntry(entry);
      });

      return body;
    };

    this.#subWindowManager.addWindow('eventLog', {
      id: 'eventLog',
      title: 'event-log',
      content: eventLogContentFn,
      left: '45vw',
      top: '10vh',
      width: '300px',
      height: 'auto'
    });

    // Color picker SubWindow with integrated color selector
    const COLOR_STORAGE_KEY = 'vectux_colors';

    const loadColors = () => {
      try {
        const saved = localStorage.getItem(COLOR_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
      return ['#000000', '#ffffff', '#ff5252', '#4fc3f7', '#69f0ae', '#ffd54f', '#ba68c8', '#ff9800', '#212121'];
    };

    const saveColors = (colors) => {
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(colors));
    };

    let colors = loadColors();

    const colorContentFn = () => {
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px;';

      // Color grid (palette)
      const grid = document.createElement('div');
      grid.className = 'color-grid';
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
      body.appendChild(grid);

      // Separator
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);width:100%;';
      body.appendChild(sep);

      // Integrated color selector
      const selector = document.createElement('div');
      selector.className = 'color-selector-integrated';
      selector.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;';

      // Saturation/Brightness canvas
      const sbCanvas = document.createElement('canvas');
      sbCanvas.width = 180;
      sbCanvas.height = 120;
      sbCanvas.style.cssText = 'width:180px;height:120px;border-radius:4px;cursor:crosshair;border:1px solid rgba(255,255,255,0.15);';
      selector.appendChild(sbCanvas);

      // Hue slider
      const hueRow = document.createElement('div');
      hueRow.style.cssText = 'display:flex;gap:6px;align-items:center;width:100%;';

      const hueCanvas = document.createElement('canvas');
      hueCanvas.width = 180;
      hueCanvas.height = 16;
      hueCanvas.style.cssText = 'width:180px;height:16px;border-radius:4px;cursor:crosshair;border:1px solid rgba(255,255,255,0.15);flex:1;';
      hueRow.appendChild(hueCanvas);
      selector.appendChild(hueRow);

      // Preview + Add button
      const previewRow = document.createElement('div');
      previewRow.style.cssText = 'display:flex;gap:6px;align-items:center;';

      const preview = document.createElement('div');
      preview.id = 'colorPreview';
      preview.style.cssText = 'width:32px;height:32px;border-radius:4px;border:2px solid rgba(255,255,255,0.3);';
      previewRow.appendChild(preview);

      const addBtn = document.createElement('button');
      addBtn.style.cssText = 'padding:4px 12px;background:rgba(105,240,174,0.1);border:1px solid rgba(105,240,174,0.3);border-radius:3px;color:#69f0ae;cursor:pointer;font-size:0.7em;';
      addBtn.textContent = '+ Add';
      previewRow.appendChild(addBtn);
      selector.appendChild(previewRow);

      body.appendChild(selector);

      // State
      let hue = 0;       // 0-360
      let sat = 1;       // 0-1
      let bri = 1;       // 0-1

      function hslToHex(h, s, l) {
        // HSL to hex (using brightness as lightness)
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
          const k = (n + h / 30) % 12;
          const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
      }

      function hsvToHex(h, s, v) {
        // HSV to hex
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }

      function updatePreview() {
        const hex = hsvToHex(hue, sat, bri);
        preview.style.background = hex;
      }

      function drawSBMap() {
        const ctx = sbCanvas.getContext('2d');
        const w = sbCanvas.width, h = sbCanvas.height;
        // Draw saturation (x) vs brightness (y) for current hue
        for (let x = 0; x < w; x++) {
          for (let y = 0; y < h; y++) {
            const s = x / w;
            const v = 1 - y / h;
            ctx.fillStyle = hsvToHex(hue, s, v);
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Draw cursor
        const cx = sat * w;
        const cy = (1 - bri) * h;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      function drawHueBar() {
        const ctx = hueCanvas.getContext('2d');
        const w = hueCanvas.width, h = hueCanvas.height;
        for (let x = 0; x < w; x++) {
          const hh = (x / w) * 360;
          ctx.fillStyle = `hsl(${hh}, 100%, 50%)`;
          ctx.fillRect(x, 0, 1, h);
        }
        // Draw cursor
        const cx = (hue / 360) * w;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, h / 2, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, h / 2, 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // SB canvas interaction
      let sbDragging = false;
      const handleSB = (e) => {
        const rect = sbCanvas.getBoundingClientRect();
        const scaleX = sbCanvas.width / rect.width;
        const scaleY = sbCanvas.height / rect.height;
        sat = Math.max(0, Math.min(1, (e.clientX - rect.left) * scaleX / sbCanvas.width));
        bri = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) * scaleY / sbCanvas.height));
        drawSBMap();
        updatePreview();
      };
      sbCanvas.addEventListener('mousedown', (e) => { sbDragging = true; handleSB(e); });
      sbCanvas.addEventListener('touchstart', (e) => { sbDragging = true; handleSB(e.touches[0]); }, { passive: true });
      window.addEventListener('mousemove', (e) => { if (sbDragging) handleSB(e); });
      window.addEventListener('touchmove', (e) => { if (sbDragging) handleSB(e.touches[0]); }, { passive: true });
      window.addEventListener('mouseup', () => { sbDragging = false; });
      window.addEventListener('touchend', () => { sbDragging = false; });

      // Hue bar interaction
      let hueDragging = false;
      const handleHue = (clientX) => {
        const rect = hueCanvas.getBoundingClientRect();
        hue = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
        drawHueBar();
        drawSBMap();
        updatePreview();
      };
      hueCanvas.addEventListener('mousedown', (e) => { hueDragging = true; handleHue(e.clientX); });
      hueCanvas.addEventListener('touchstart', (e) => { hueDragging = true; handleHue(e.touches[0].clientX); }, { passive: true });
      window.addEventListener('mousemove', (e) => { if (hueDragging) handleHue(e.clientX); });
      window.addEventListener('touchmove', (e) => { if (hueDragging) handleHue(e.touches[0].clientX); }, { passive: true });
      window.addEventListener('mouseup', () => { hueDragging = false; });
      window.addEventListener('touchend', () => { hueDragging = false; });

      // Add button
      addBtn.addEventListener('click', () => {
        const hex = hsvToHex(hue, sat, bri);
        if (!colors.includes(hex)) {
          colors.push(hex);
          saveColors(colors);
          renderGrid();
        }
      });

      // Initial draw
      drawHueBar();
      drawSBMap();
      updatePreview();

      const renderGrid = () => {
        grid.innerHTML = '';
        colors.forEach((color, i) => {
          const btn = document.createElement('button');
          btn.className = 'panel-color-btn' + (this.#statesMachine.currentColor === color ? ' active' : '');
          btn.dataset.color = color;
          btn.style.cssText = `background:${color};width:32px;height:32px;border-radius:4px;border:2px solid rgba(255,255,255,0.2);cursor:pointer;position:relative;`;

          if (i >= 3) {
            btn.title = 'Click: select | Long press: remove';
            let pressTimer;
            btn.addEventListener('touchstart', (e) => {
              pressTimer = setTimeout(() => {
                colors.splice(i, 1);
                saveColors(colors);
                renderGrid();
              }, 500);
            });
            btn.addEventListener('touchend', () => clearTimeout(pressTimer));
            btn.addEventListener('touchcancel', () => clearTimeout(pressTimer));
            btn.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              colors.splice(i, 1);
              saveColors(colors);
              renderGrid();
            });
          }

          btn.addEventListener('click', () => {
            this.#corePanel.selectColor(color);
          });
          grid.appendChild(btn);
        });
      };

      renderGrid();

      this.#statesMachine.on('colorChange', () => renderGrid());

      return body;
    };
    this.#subWindowManager.addWindow('colorPicker', {
      id: 'colorPicker',
      title: 'Couleurs',
      content: colorContentFn,
      left: '60vw',
      top: '10vh',
      width: '210px',
      height: 'auto'
    });

    // Size selector SubWindow
    const sizeContentFn = () => {
      const body = document.createElement('div');
      body.className = 'size-selector-container';
      body.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:12px;box-sizing:border-box;';

      const sizes = [2, 4, 6, 8, 10, 14, 20, 28];

      // Grid of size buttons
      const grid = document.createElement('div');
      grid.className = 'size-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:10px;';

      sizes.forEach((size) => {
        const btn = document.createElement('button');
        btn.className = 'size-btn' + (this.#statesMachine.currentSize === size ? ' active' : '');
        btn.dataset.size = size;
        btn.style.cssText = `
          display:flex;align-items:center;justify-content:center;
          width:48px;height:48px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.12);
          border-radius:6px;
          cursor:pointer;transition:all 0.15s;
          justify-self:center;
        `;

        // Visual circle
        const circle = document.createElement('div');
        const displaySize = Math.max(size, 4);
        circle.style.cssText = `
          width:${displaySize}px;height:${displaySize}px;
          border-radius:50%;
          background:rgba(255,255,255,0.5);
          transition:all 0.15s;
        `;
        btn.appendChild(circle);

        btn.addEventListener('click', () => {
          this.#corePanel.selectSize(size);
        });

        grid.appendChild(btn);
      });

      body.appendChild(grid);

      // Subscribe to size changes
      this.#statesMachine.on('sizeChange', (sz) => {
        body.querySelectorAll('.size-btn').forEach(b => {
          const active = parseInt(b.dataset.size) === sz;
          b.classList.toggle('active', active);
        });
      });

      return body;
    };
    this.#subWindowManager.addWindow('sizeSelector', {
      id: 'sizeSelector',
      title: 'Tailles',
      content: sizeContentFn,
      left: '70vw',
      top: '10vh',
      width: '240px',
      height: 'auto'
    });

    // Tool selector SubWindow — main control panel
    const toolContentFn = () => {
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-direction:column;gap:0;overflow-y:auto;max-height:70vh;';

      // ── PROPERTIES section (object/path properties)
      const propsSection = document.createElement('div');
      propsSection.id = 'toolPropsSection';
      propsSection.style.cssText = 'padding:8px;display:none;';
      propsSection.innerHTML = '<div style="color:rgba(255,255,255,0.35);font-size:0.65em;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Propriétés</div>';
      const propsGrid = document.createElement('div');
      propsGrid.id = 'toolPropsGrid';
      propsGrid.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      propsGrid.innerHTML =
        '<div style="display:flex;justify-content:space-between;font-size:0.7em;"><span style="color:rgba(255,255,255,0.4);">Couleur</span><span id="tpColor" style="color:#4fc3f7;">-</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7em;"><span style="color:rgba(255,255,255,0.4);">Taille</span><span id="tpSize" style="color:#4fc3f7;">-</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7em;"><span style="color:rgba(255,255,255,0.4);">Points</span><span id="tpPoints" style="color:#4fc3f7;">-</span></div>';
      propsSection.appendChild(propsGrid);

      // Tolerance control
      const tolRow = document.createElement('div');
      tolRow.style.cssText = 'margin-top:6px;display:flex;align-items:center;gap:4px;';
      tolRow.innerHTML =
        '<span style="color:rgba(255,255,255,0.4);font-size:0.65em;">Tol.</span>' +
        '<input type="range" id="tpTolSlider" min="1" max="50" step="1" value="5" style="flex:1;height:3px;accent-color:#4fc3f7;">' +
        '<span id="tpTol" style="color:rgba(255,255,255,0.5);font-size:0.65em;min-width:24px;">5px</span>' +
        '<button id="tpSimplify" style="padding:2px 6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:3px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:0.6em;" title="Simplifier">≈</button>';
      propsSection.appendChild(tolRow);
      body.appendChild(propsSection);

      // ── Separator
      const sep2 = document.createElement('div');
      sep2.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);';
      body.appendChild(sep2);

      // ── NODE EDIT section
      const nodeSection = document.createElement('div');
      nodeSection.id = 'toolNodeSection';
      nodeSection.style.cssText = 'padding:8px;display:none;';
      nodeSection.innerHTML = '<div style="color:rgba(255,255,255,0.35);font-size:0.65em;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Nœuds</div>';
      const nodeInfo = document.createElement('div');
      nodeInfo.style.cssText = 'font-size:0.65em;color:rgba(255,255,255,0.5);margin-bottom:4px;';
      nodeInfo.innerHTML = '<span id="tnCount">0</span> nœuds — indices <span id="tnIndices">-</span>';
      nodeSection.appendChild(nodeInfo);

      // Node type buttons
      const typeRow = document.createElement('div');
      typeRow.style.cssText = 'display:flex;gap:3px;margin-bottom:4px;';
      const typeDefs = [
        { id: 'tnCorner', type: 'corner', icon: 'M4 4l6 16 4-8 8-4z', label: 'Coin' },
        { id: 'tnSmooth', type: 'smooth', icon: 'M3 17c1-2 3-4 5-4s3 3 5 3 4-4 8-4v4c-2 0-4 3-7 3s-3-3-5-3-4 3-6 4V17z', label: 'Lisse' },
        { id: 'tnSymmetric', type: 'symmetric', icon: 'M3 17c2-3 4-5 6-5s4 4 5 4 3-4 5-4v0c-2 0-4 4-5 4s-3-4-5-4-4 3-6 5z', label: 'Sym.' },
        { id: 'tnAuto', type: 'auto', icon: 'M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z', label: 'Auto' }
      ];
      typeDefs.forEach(td => {
        const btn = document.createElement('button');
        btn.id = td.id;
        btn.className = 'node-type-btn';
        btn.dataset.nodeType = td.type;
        btn.title = td.label;
        btn.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:rgba(255,255,255,0.4);cursor:pointer;';
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor"><path d="${td.icon}"/></svg><span style="font-size:0.55em;">${td.label}</span>`;
        btn.addEventListener('click', () => this.#corePanel.selectNodeType(td.type));
        typeRow.appendChild(btn);
      });
      nodeSection.appendChild(typeRow);

      // Action buttons
      const actionRow = document.createElement('div');
      actionRow.style.cssText = 'display:flex;gap:3px;';
      const actionDefs = [
        { id: 'tnDelete', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', label: 'Supprimer', action: 'deleteNodes' },
        { id: 'tnInsert', icon: 'M12 5v14M5 12h14', label: 'Insérer', action: 'insertNodes' }
      ];
      actionDefs.forEach(ad => {
        const btn = document.createElement('button');
        btn.id = ad.id;
        btn.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:0.65em;';
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor"><path d="${ad.icon}"/></svg>${ad.label}`;
        btn.addEventListener('click', () => this.#corePanel[ad.action]());
        actionRow.appendChild(btn);
      });
      nodeSection.appendChild(actionRow);
      body.appendChild(nodeSection);

      return body;
    };
    this.#subWindowManager.addWindow('toolSelector', {
      id: 'toolSelector',
      title: 'Contrôle',
      content: toolContentFn,
      left: '50vw',
      top: '10vh',
      width: '200px',
      height: 'auto'
    });

    // Wire toolSelector sub-window controls
    setTimeout(() => {
      const tolSlider = document.getElementById('tpTolSlider');
      const tolLabel = document.getElementById('tpTol');
      if (tolSlider && tolLabel) {
        tolSlider.addEventListener('input', (e) => { tolLabel.textContent = e.target.value + 'px'; });
      }
      const simplifyBtn = document.getElementById('tpSimplify');
      if (simplifyBtn) {
        simplifyBtn.addEventListener('click', () => {
          const tol = parseInt(document.getElementById('tpTolSlider')?.value || '5', 10);
          this.#corePanel.simplifySelectedPath(tol);
        });
      }
    }, 0);

    // Toggle raw states with double-tap on statusBar
    statusBar.addEventListener('dblclick', () => {
      this.#subWindowManager.toggleWindow('rawStates');
    });
  }

  #wireEvents() {
    this.#touchOverlay = new TouchOverlay(this.#drawArea.touchOverlayElement, {
      dist: 0,
      tappingToPressingFrontier: 600,
      pressingToLongPressingFrontier: 1950,
      contactSize: 24,
      cursorSize: 14,
      rodEnabled: true,
      pulseEnabled: false
    });

    this.#drawArea.bindDrawEvents(this.#touchOverlay);

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

    // Update status bar on zoom/pan
    this.#drawArea.svgElement.addEventListener('touchend', () => this.#updateStatusBar());
    this.#touchOverlay.engine.on('pinchEnd', () => this.#updateStatusBar());
    this.#touchOverlay.engine.on('catchDrop', () => this.#updateStatusBar());

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
    const statusZoom = document.getElementById('statusZoom');
    const statusViewBox = document.getElementById('statusViewBox');

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

    // Zoom and viewBox
    if (statusZoom) {
      const z = this.#drawArea.zoom;
      statusZoom.textContent = `${(z * 100).toFixed(0)}%`;
    }
    if (statusViewBox) {
      const vb = this.#drawArea.viewBox;
      statusViewBox.textContent = `${vb.x} ${vb.y} ${vb.w}×${vb.h}`;
    }
  }
}

let app = null;
document.addEventListener('DOMContentLoaded', () => {
  app = new Application();
});
