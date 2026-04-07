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

    // Color picker SubWindow
    const colorContentFn = () => {
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
      const colorList = ['#000000', '#ffffff', '#ff5252', '#4fc3f7', '#69f0ae', '#ffd54f', '#ba68c8', '#ff9800', '#212121'];
      colorList.forEach((color, i) => {
        const btn = document.createElement('button');
        btn.className = 'panel-color-btn' + (i === 0 ? ' active' : '');
        btn.dataset.color = color;
        btn.style.cssText = `background:${color};width:32px;height:32px;border-radius:4px;border:2px solid rgba(255,255,255,0.2);cursor:pointer;`;
        btn.addEventListener('click', () => {
          this.#corePanel.selectColor(color);
        });
        body.appendChild(btn);
      });
      return body;
    };
    this.#subWindowManager.addWindow('colorPicker', {
      id: 'colorPicker',
      title: 'Couleurs',
      content: colorContentFn,
      left: '60vw',
      top: '10vh',
      width: '200px',
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

      // ── TOOLS section
      const toolsSection = document.createElement('div');
      toolsSection.style.cssText = 'padding:8px;';
      toolsSection.innerHTML = '<div style="color:rgba(255,255,255,0.35);font-size:0.65em;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Outils</div>';
      const toolsRow = document.createElement('div');
      toolsRow.style.cssText = 'display:flex;gap:4px;';
      const toolDefs = [
        { id: 'toolDraw', tool: 'draw', icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z', label: 'Dessin' },
        { id: 'toolSelect', tool: 'select', icon: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z', label: 'Sélection' },
        { id: 'toolPan', tool: 'pan', icon: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20', label: 'Pan' }
      ];
      toolDefs.forEach((td, i) => {
        const btn = document.createElement('button');
        btn.id = td.id;
        btn.className = 'panel-tool-btn' + (i === 0 ? ' active' : '');
        btn.dataset.tool = td.tool;
        btn.title = td.label;
        btn.style.cssText = `flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.5);cursor:pointer;transition:all 0.15s;`;
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor"><path d="${td.icon}"/></svg><span style="font-size:0.6em;">${td.label}</span>`;
        btn.addEventListener('click', () => this.#corePanel.selectTool(td.tool));
        toolsRow.appendChild(btn);
      });
      toolsSection.appendChild(toolsRow);

      // Select mode toggle
      const selectModeBtn = document.createElement('button');
      selectModeBtn.id = 'selectModeBtn';
      selectModeBtn.style.cssText = 'display:none;width:100%;margin-top:6px;padding:5px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:rgba(255,255,255,0.4);cursor:pointer;font-size:0.7em;text-align:left;';
      selectModeBtn.title = 'Mode sélection: objets';
      selectModeBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;vertical-align:middle;margin-right:4px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Mode nœuds';
      selectModeBtn.addEventListener('click', () => this.#corePanel.toggleSelectMode());
      toolsSection.appendChild(selectModeBtn);
      body.appendChild(toolsSection);

      // ── Separator
      const sep1 = document.createElement('div');
      sep1.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);';
      body.appendChild(sep1);

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
      dist: 5,
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
