const APP_NAME = 'Vecta';
const APP_VERSION = '0.1';

/**
 * State — a declarative definition of an application state.
 *
 * Describes:
 * - Identity (name, type, family, tags)
 * - Mutual exclusion via exclusiveFields
 * - Activation / maintain / deactivation conditions
 * - Lifecycle hooks (onEnter, onExit, onMaintain)
 * - Priority for conflict resolution
 */
class State {
  #name;
  #type;
  #family;
  #exclusiveFields;
  #priority;
  #activationCondition;
  #maintainCondition;
  #deactivationCondition;
  #onEnter;
  #onExit;
  #onMaintain;
  #tags;
  #meta;

  constructor(config = {}) {
    if (!config.name) throw new Error('State must have a name');
    this.#name = config.name;
    this.#type = config.type || 'generic';
    this.#family = config.family || '';
    this.#exclusiveFields = Array.isArray(config.exclusiveFields) ? [...config.exclusiveFields] : [];
    this.#priority = typeof config.priority === 'number' ? config.priority : 0;

    // Conditions — accept fn strings or null
    this.#activationCondition = this.#parseCondition(config.activationCondition);
    this.#maintainCondition = this.#parseCondition(config.maintainCondition);
    this.#deactivationCondition = this.#parseCondition(config.deactivationCondition);

    // Lifecycle hooks
    this.#onEnter = config.onEnter || null;
    this.#onExit = config.onExit || null;
    this.#onMaintain = config.onMaintain || null;

    // Metadata
    this.#tags = Array.isArray(config.tags) ? [...config.tags] : [];
    this.#meta = config.meta || {};
  }

  #parseCondition(cond) {
    if (!cond) return null;
    if (typeof cond === 'function') return cond;
    if (typeof cond === 'string' && cond.trim()) {
      try {
        return new Function('c', `return (${cond})(c)`);
      } catch { return null; }
    }
    return null;
  }

  // ── Getters ──
  get name() { return this.#name; }
  get type() { return this.#type; }
  get family() { return this.#family; }
  get exclusiveFields() { return [...this.#exclusiveFields]; }
  get priority() { return this.#priority; }
  get tags() { return [...this.#tags]; }
  get meta() { return { ...this.#meta }; }

  canActivate(ctx) {
    return this.#activationCondition ? this.#activationCondition(ctx) : true;
  }

  shouldMaintain(ctx) {
    return this.#maintainCondition ? this.#maintainCondition(ctx) : true;
  }

  shouldDeactivate(ctx) {
    return this.#deactivationCondition ? this.#deactivationCondition(ctx) : false;
  }

  enter(ctx) {
    if (this.#onEnter) this.#onEnter(ctx);
  }

  exit(ctx) {
    if (this.#onExit) this.#onExit(ctx);
  }

  maintain(ctx, dt) {
    if (this.#onMaintain) this.#onMaintain(ctx, dt);
  }

  getExclusiveConflicts(other) {
    if (!(other instanceof State)) return [];
    return this.#exclusiveFields.filter(f => other.exclusiveFields.includes(f));
  }

  /**
   * Return a plain serializable representation (for storage/export).
   */
  toJSON() {
    return {
      name: this.#name,
      type: this.#type,
      family: this.#family,
      exclusiveFields: this.#exclusiveFields,
      priority: this.#priority,
      tags: this.#tags,
      meta: this.#meta,
      activationCondition: null,
      maintainCondition: null,
      deactivationCondition: null
    };
  }

  /**
   * Return a raw definition including condition strings for editing.
   */
  toDefinition() {
    return {
      name: this.#name,
      type: this.#type,
      family: this.#family,
      exclusiveFields: this.#exclusiveFields,
      priority: this.#priority,
      tags: this.#tags,
      meta: this.#meta,
      activationCondition: null,
      maintainCondition: null,
      deactivationCondition: null,
      onEnter: null,
      onExit: null,
      onMaintain: null
    };
  }
}

/**
 * StateLoader — loads state definitions from localStorage or server.
 *
 * Flow:
 * 1. Check localStorage for 'vectux_states'
 * 2. If empty → fetch defaultStates.json → save to localStorage
 * 3. Return parsed definitions
 */
class StateLoader {
  static STORAGE_KEY = 'vectux_states';
  static DEFAULT_URL = 'defaultStates.json';

  /**
   * Load state definitions.
   * @returns {Promise<Array>} — array of state definition objects
   */
  static async load() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try { return JSON.parse(stored); }
      catch { console.warn('Invalid states in localStorage, fetching defaults...'); }
    }
    return await this.fetchDefaults();
  }

  /**
   * Save state definitions to localStorage.
   * @param {Array} definitions
   */
  static save(definitions) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(definitions, null, 2));
  }

  /**
   * Fetch default states from server.
   */
  static async fetchDefaults() {
    try {
      const res = await fetch(this.DEFAULT_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const defs = await res.json();
      this.save(defs);
      return defs;
    } catch (e) {
      console.error('Failed to fetch default states:', e);
      return [];
    }
  }

  /**
   * Export states as a downloadable JSON file.
   */
  static export(filename = 'vectux-states.json') {
    const stored = localStorage.getItem(this.STORAGE_KEY) || '[]';
    const blob = new Blob([stored], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Selection types — what kind of entity is being selected.
 */
const SelectionType = Object.freeze({
  OBJECT: 'object',          // whole path selection
  NODE: 'node',              // individual node(s) on a path
  NODE_HANDLE: 'nodeHandle', // control point handle (cpIn/cpOut)
  BOX: 'box'                 // rectangular marquee selection
});

/**
 * Selection states — fine-grained lifecycle states.
 */
const SelectionState = Object.freeze({
  IDLE: 'idle',
  PATH_SELECTED: 'pathSelected',
  NODES_SELECTED: 'nodesSelected',
  HANDLE_DRAGGING: 'handleDragging',
  BOX_DRAGGING: 'boxDragging'
});

/**
 * Selection modes — what kind of entity we're targeting.
 */
const SelectMode = Object.freeze({
  OBJECT: 'object',  // select whole objects (paths, shapes, text)
  NODE: 'node'       // select nodes on the active path
});

/**
 * SelectionManager — centralized selection state management.
 *
 * Responsible for:
 * - Typed selections (path, node, handle, box)
 * - Fine-grained selection states
 * - Event emission for interested parties
 * - Synchronizing with StateMachine's selectedPath/selectedNodes
 *
 * Acts as the single point of contact between selection UI
 * (DrawArea, CorePanel) and the application state machine.
 */
class SelectionManager {
  #stateMachine;
  #listeners = {};

  // Current selection data
  #type = SelectionType.OBJECT;
  #state = SelectionState.IDLE;
  #selectMode = SelectMode.OBJECT;
  #selectedPath = null;   // currently selected path (object mode) OR active path (node mode)
  #selectedNodes = [];
  #boxRect = null;       // {x, y, w, h} in screen coords during box drag
  #dragHandle = null;    // {name, screenX, screenY} during handle drag

  constructor(stateMachine) {
    this.#stateMachine = stateMachine;
    this.#wireToStateMachine();
  }

  // ─── Getters ───────────────────────────────────────────

  get type() { return this.#type; }
  get state() { return this.#state; }
  get selectMode() { return this.#selectMode; }
  get selectedPath() { return this.#selectedPath; }
  get selectedNodes() { return [...this.#selectedNodes]; }
  get boxRect() { return this.#boxRect ? { ...this.#boxRect } : null; }
  get dragHandle() { return this.#dragHandle ? { ...this.#dragHandle } : null; }

  get hasSelection() { return !!this.#selectedPath || this.#selectedNodes.length > 0; }
  get hasNodes() { return this.#selectedNodes.length > 0; }

  /**
   * Set the selection mode: 'object' or 'node'.
   * In 'object' mode: tap toggles whole paths, bbox adds objects.
   * In 'node' mode: one path is "active", tap toggles nodes, bbox adds nodes.
   * Switching to 'node' without an active path will auto-select the first
   * tapped object as the active path.
   * @param {string} mode - SelectMode.OBJECT or SelectMode.NODE
   */
  setSelectMode(mode) {
    if (mode === this.#selectMode) return;
    this.#selectMode = mode;
    // When switching away from node mode, clear node selection
    if (mode === SelectMode.OBJECT) {
      this.#selectedNodes = [];
      this.#setState(this.#selectedPath ? SelectionState.PATH_SELECTED : SelectionState.IDLE);
      this.#type = SelectionType.OBJECT;
    } else {
      // Switching to node mode — keep selectedPath as active path
      this.#setState(this.#selectedPath ? SelectionState.NODES_SELECTED : SelectionState.PATH_SELECTED);
    }
    this.#emit('selectModeChange', { mode: this.#selectMode });
    this.#emitSelectionChange();
  }

  // ─── Event system ──────────────────────────────────────

  on(event, callback) {
    if (!this.#listeners[event]) this.#listeners[event] = [];
    this.#listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.#listeners[event]) return;
    this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
  }

  #emit(event, data) {
    if (this.#listeners[event]) {
      this.#listeners[event].forEach(cb => cb(data));
    }
  }

  // ─── Path selection ────────────────────────────────────

  /**
   * Select an entire path object.
   * In 'object' mode: adds/toggles the path in selection.
   * In 'node' mode: sets the active path and clears previous node selection.
   * @param {object|null} path - The path to select, or null to deselect.
   */
  selectPath(path) {
    if (this.#selectedPath === path) return; // no-op

    const prev = this.#selectedPath;

    if (this.#selectMode === SelectMode.NODE) {
      // Node mode: switching active path
      this.#selectedPath = path;
      this.#selectedNodes = []; // clear nodes when switching active path
      if (path) {
        this.#type = SelectionType.OBJECT; // temporarily object until nodes selected
        this.#setState(SelectionState.PATH_SELECTED);
        this.#emit('pathSelected', { path });
      } else {
        this.#setState(SelectionState.IDLE);
        if (prev) this.#emit('pathDeselected', { path: prev });
      }
    } else {
      // Object mode: standard selection
      this.#selectedPath = path;
      this.#selectedNodes = [];

      if (path) {
        this.#type = SelectionType.OBJECT;
        this.#setState(SelectionState.PATH_SELECTED);
        this.#emit('pathSelected', { path });
      } else if (prev) {
        this.#setState(SelectionState.IDLE);
        this.#emit('pathDeselected', { path: prev });
      }
    }

    this.#syncToStateMachine();
    this.#emitSelectionChange();
  }

  /**
   * Toggle a path in/out of the current selection (object mode only).
   * Additive: if already selected, deselect it; otherwise add to selection.
   * @param {object} path
   */
  togglePath(path) {
    if (this.#selectMode !== SelectMode.OBJECT) return;
    if (this.#selectedPath === path) {
      this.selectPath(null);
    } else {
      this.selectPath(path);
    }
  }

  /**
   * Select multiple nodes on the current path by index.
   * Replaces the current node selection.
   * @param {number[]} indices - Array of point indices.
   */
  selectNodes(indices) {
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (this.#arraysEqual(this.#selectedNodes, sorted)) return;

    this.#selectedNodes = sorted;

    if (sorted.length > 0) {
      this.#type = SelectionType.NODE;
      this.#setState(SelectionState.NODES_SELECTED);
      this.#emit('nodesSelected', { path: this.#selectedPath, nodes: sorted });
    } else {
      this.#type = SelectionType.OBJECT;
      this.#setState(this.#selectedPath ? SelectionState.PATH_SELECTED : SelectionState.IDLE);
      this.#emit('nodesDeselected', { path: this.#selectedPath });
    }

    this.#syncToStateMachine();
    this.#emitSelectionChange();
  }

  /**
   * Toggle a single node in/out of the selection.
   * @param {number} index - Point index to toggle.
   */
  toggleNode(index) {
    if (!this.#selectedPath) return;
    const idx = this.#selectedNodes.indexOf(index);
    if (idx >= 0) {
      this.#selectedNodes.splice(idx, 1);
    } else {
      this.#selectedNodes.push(index);
    }
    this.selectNodes(this.#selectedNodes);
  }

  /**
   * Add nodes to the current selection (union).
   * @param {number[]} indices
   */
  addNodes(indices) {
    const set = new Set([...this.#selectedNodes, ...indices]);
    this.selectNodes([...set]);
  }

  // ─── Handle drag (control point manipulation) ──────────

  startHandleDrag(handleInfo) {
    this.#dragHandle = handleInfo;
    this.#type = SelectionType.NODE_HANDLE;
    this.#setState(SelectionState.HANDLE_DRAGGING);
    this.#emit('handleDragStart', { handle: handleInfo, path: this.#selectedPath, nodes: this.#selectedNodes });
    this.#emitSelectionChange();
  }

  handleDrag(handleInfo) {
    if (!this.#dragHandle) return;
    this.#dragHandle = handleInfo;
    this.#emit('handleDrag', { handle: handleInfo, path: this.#selectedPath, nodes: this.#selectedNodes });
  }

  endHandleDrag() {
    if (!this.#dragHandle) return;
    const handle = this.#dragHandle;
    this.#dragHandle = null;
    // Return to previous state
    if (this.#selectedNodes.length > 0) {
      this.#type = SelectionType.NODE;
      this.#setState(SelectionState.NODES_SELECTED);
    } else if (this.#selectedPath) {
      this.#type = SelectionType.OBJECT;
      this.#setState(SelectionState.PATH_SELECTED);
    } else {
      this.#setState(SelectionState.IDLE);
    }
    this.#emit('handleDragEnd', { handle, path: this.#selectedPath, nodes: this.#selectedNodes });
    this.#emitSelectionChange();
  }

  // ─── Box selection ─────────────────────────────────────

  startBox(rect) {
    this.#boxRect = { ...rect };
    this.#type = SelectionType.BOX;
    this.#setState(SelectionState.BOX_DRAGGING);
    this.#emit('boxStart', { rect: this.#boxRect });
    this.#emitSelectionChange();
  }

  updateBox(rect) {
    if (!this.#boxRect) return;
    this.#boxRect = { ...rect };
    this.#emit('boxChange', { rect: this.#boxRect });
  }

  endBox(rect, foundPathOrNodes) {
    this.#boxRect = null;
    this.#type = SelectionType.BOX;
    this.#setState(SelectionState.BOX_DRAGGING);

    if (foundPathOrNodes !== undefined && foundPathOrNodes !== null) {
      if (Array.isArray(foundPathOrNodes)) {
        // Array of node indices
        this.selectNodes(foundPathOrNodes);
      } else {
        // Single path object
        this.selectPath(foundPathOrNodes);
      }
    }

    this.#emit('boxEnd', { rect, selection: foundPathOrNodes });
    this.#emitSelectionChange();
  }

  // ─── Clear ─────────────────────────────────────────────

  clear() {
    const hadPath = !!this.#selectedPath;
    const hadNodes = this.#selectedNodes.length > 0;
    this.#selectedPath = null;
    this.#selectedNodes = [];
    this.#boxRect = null;
    this.#dragHandle = null;
    this.#type = SelectionType.OBJECT;
    this.#setState(SelectionState.IDLE);

    if (hadNodes) this.#emit('nodesDeselected', {});
    if (hadPath) this.#emit('pathDeselected', {});
    this.#syncToStateMachine();
    this.#emitSelectionChange();
  }

  // ─── Internal helpers ──────────────────────────────────

  #setState(newState) {
    if (this.#state !== newState) {
      this.#state = newState;
      this.#emit('stateChange', newState);
    }
  }

  #emitSelectionChange() {
    this.#emit('selectionChange', {
      type: this.#type,
      state: this.#state,
      path: this.#selectedPath,
      nodes: [...this.#selectedNodes]
    });
  }

  #syncToStateMachine() {
    // Update StateMachine's internal state directly to avoid circular calls.
    // We bypass the setters and write straight to the private #state object
    // (via public properties since we can't access #state from here).
    // The clean way: emit events directly on StateMachine so listeners react.
    const sm = this.#stateMachine;
    // We need direct state access — store references, not via setters
    sm._setSelectedPathDirect(this.#selectedPath);
    sm._setSelectedNodesDirect([...this.#selectedNodes]);
  }

  #wireToStateMachine() {
    // When StateMachine mode changes away from selection, clear selection
    this.#stateMachine.on('modeChange', (mode) => {
      if (mode !== 'selection') {
        this.clear();
      }
    });

    // When paths are cleared/reset, clear selection
    this.#stateMachine.on('clearCanvas', () => {
      this.clear();
    });

    // When a path is deleted from the paths array, deselect if it was selected
    this.#stateMachine.on('pathsChange', (paths) => {
      if (this.#selectedPath && !paths.includes(this.#selectedPath)) {
        this.clear();
      }
    });
  }

  #arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

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
  #selectionManager = null;

  // State management
  #stateRegistry = new Map();   // name -> State
  #activeStates = new Set();    // names of currently active states

  constructor() {
    this.#state = {
      mode: 'drawingTool',
      currentTool: 'draw',
      currentColor: '#000000',
      currentSize: 8,
      paths: [],
      currentPath: null,
      selectedPath: null,
      selectables: 'objects',
      selectedNodes: [],
      selectMode: 'object'  // 'object' | 'node'
    };
    this.#listeners = {};
    this.#saveState();
    // States loaded async via loadStates()
  }

  /**
   * Load state definitions from StateLoader and register them.
   * Must be called once at startup (async).
   */
  async loadStates() {
    const definitions = await StateLoader.load();
    this.#stateRegistry.clear();
    this.#activeStates.clear();
    for (const def of definitions) {
      this.#registerFromDefinition(def);
    }
    this.#attachStateHooks();
    // Activate defaults: drawingTool + draw
    this.activateState('drawingTool', this.state);
    this.activateState('draw', this.state);
  }

  /**
   * Attach event-emitting hooks to registered states.
   */
  #attachStateHooks() {
    for (const state of this.#stateRegistry.values()) {
      // Override enter to emit events
      const origEnter = state.enter.bind(state);
      state._onEnter = (ctx) => {
        origEnter(ctx);
        if (state.type === 'mode') this.#emit('modeChange', state.name);
        if (state.type === 'tool') this.#emit('toolChange', state.name);
      };
    }
  }

  /**
   * Register a state from a plain definition object.
   */
  #registerFromDefinition(def) {
    const state = new State(def);
    this.#stateRegistry.set(state.name, state);
  }

  /**
   * Get all state definitions (for editor/export).
   * @returns {Array}
   */
  getStateDefinitions() {
    const defs = [];
    for (const s of this.#stateRegistry.values()) {
      defs.push(s.toDefinition());
    }
    return defs;
  }

  /**
   * Replace all state definitions and re-register.
   * Saves to localStorage.
   */
  setStateDefinitions(definitions) {
    // Preserve lifecycle hooks from existing states
    const hooks = new Map();
    for (const s of this.#stateRegistry.values()) {
      hooks.set(s.name, { onEnter: s._onEnter, onExit: s._onExit, onMaintain: s._onMaintain });
    }

    this.#stateRegistry.clear();
    this.#activeStates.clear();
    for (const def of definitions) {
      this.#registerFromDefinition(def);
    }
    StateLoader.save(definitions);

    // Re-activate defaults
    this.activateState('drawingTool', this.state);
    this.activateState('draw', this.state);
  }

  // ── State registry API ──

  /**
   * Register a State definition.
   * @param {State} state
   */
  registerState(state) {
    this.#stateRegistry.set(state.name, state);
  }

  /**
   * Get a registered State by name.
   * @param {string} name
   * @returns {State|null}
   */
  getState(name) {
    return this.#stateRegistry.get(name) || null;
  }

  /**
   * Get all registered state names.
   */
  getRegisteredStateNames() {
    return [...this.#stateRegistry.keys()];
  }

  /**
   * Get currently active state names.
   */
  getActiveStateNames() {
    return [...this.#activeStates];
  }

  /**
   * Check if a state is currently active.
   */
  isActive(name) {
    return this.#activeStates.has(name);
  }

  /**
   * Try to activate a state. Enforces exclusivity and conditions.
   * @param {string} name
   * @param {object} ctx — context snapshot
   * @returns {boolean} — true if activated
   */
  activateState(name, ctx = this.state) {
    const state = this.#stateRegistry.get(name);
    if (!state) {
      console.warn(`State "${name}" not registered`);
      return false;
    }

    // Check activation condition
    if (!state.canActivate(ctx)) {
      return false;
    }

    // Check exclusivity conflicts
    const conflicts = [];
    for (const activeName of this.#activeStates) {
      const activeState = this.#stateRegistry.get(activeName);
      if (!activeState) continue;
      const fields = state.getExclusiveConflicts(activeState);
      if (fields.length > 0) {
        conflicts.push({ name: activeName, fields });
      }
    }

    // Resolve conflicts: deactivate lower-priority states
    for (const conflict of conflicts) {
      const other = this.#stateRegistry.get(conflict.name);
      if (state.priority >= other.priority) {
        this.deactivateState(conflict.name, ctx);
      } else {
        return false; // can't override higher priority
      }
    }

    // Already active?
    if (this.#activeStates.has(name)) return true;

    // Enter new state
    this.#activeStates.add(name);
    state.enter(ctx);
    return true;
  }

  /**
   * Deactivate a state.
   * @param {string} name
   * @param {object} ctx
   * @returns {boolean}
   */
  deactivateState(name, ctx = this.state) {
    if (!this.#activeStates.has(name)) return true;
    const state = this.#stateRegistry.get(name);
    if (state) state.exit(ctx);
    this.#activeStates.delete(name);
    return true;
  }

  /**
   * Check exclusivity conflicts without activating.
   * @param {string} name
   * @returns {Array<{name: string, fields: string[]}>}
   */
  getConflicts(name) {
    const state = this.#stateRegistry.get(name);
    if (!state) return [];
    const conflicts = [];
    for (const activeName of this.#activeStates) {
      const activeState = this.#stateRegistry.get(activeName);
      if (!activeState) continue;
      const fields = state.getExclusiveConflicts(activeState);
      if (fields.length > 0) {
        conflicts.push({ name: activeName, fields });
      }
    }
    return conflicts;
  }

  /**
   * Attach a SelectionManager to this state machine.
   * Once attached, selection-related setters delegate to it.
   * @param {SelectionManager} manager
   */
  setSelectionManager(manager) {
    this.#selectionManager = manager;
  }

  get selectionManager() { return this.#selectionManager; }

  /**
   * Internal: set selectedPath directly without triggering SelectionManager.
   * Used by SelectionManager to sync back without circular calls.
   */
  _setSelectedPathDirect(v) {
    this.#state.selectedPath = v;
    this.#state.selectedNodes = v ? [] : [];
    this.#state.selectables = v ? 'nodes' : 'objects';
    this.#emit('selectedNodesChange', this.#state.selectedNodes);
    this.#emit('selectablesChange', this.#state.selectables);
    this.#emit('selectedPathChange', v);
  }

  /**
   * Internal: set selectedNodes directly without triggering SelectionManager.
   */
  _setSelectedNodesDirect(v) {
    this.#state.selectedNodes = v || [];
    this.#state.selectables = this.#state.selectedNodes.length > 0 ? 'nodeSelection' : 'nodes';
    this.#emit('selectedNodesChange', this.#state.selectedNodes);
    this.#emit('selectablesChange', this.#state.selectables);
  }

  get state() {
    const s = {};
    for (const k in this.#state) s[k] = this.#state[k];
    return s;
  }

  get mode() { return this.#state.mode; }
  set mode(v) {
    this.#state.mode = v;
    this.activateState(v, this.state);
  }

  get currentTool() { return this.#state.currentTool; }
  set currentTool(v) {
    this.#state.currentTool = v;
    this.activateState(v, this.state);
  }

  get currentColor() { return this.#state.currentColor; }
  set currentColor(v) { this.#state.currentColor = v; this.#emit('colorChange', v); }

  get currentSize() { return this.#state.currentSize; }
  set currentSize(v) { this.#state.currentSize = v; this.#emit('sizeChange', v); }

  get paths() { return this.#state.paths; }
  set paths(v) { this.#state.paths = v; this.#emit('pathsChange', v); }

  get currentPath() { return this.#state.currentPath; }
  set currentPath(v) { this.#state.currentPath = v; this.#emit('currentPathChange', v); }

  get selectedPath() {
    return this.#selectionManager
      ? this.#selectionManager.selectedPath
      : this.#state.selectedPath;
  }
  set selectedPath(v) {
    if (this.#selectionManager) {
      this.#selectionManager.selectPath(v);
    } else {
      this.#state.selectedPath = v;
      this.#state.selectedNodes = v ? [] : [];
      this.#state.selectables = v ? 'nodes' : 'objects';
      this.#emit('selectedNodesChange', this.#state.selectedNodes);
      this.#emit('selectablesChange', this.#state.selectables);
      this.#emit('selectedPathChange', v);
    }
  }

  get selectedNodes() {
    return this.#selectionManager
      ? this.#selectionManager.selectedNodes
      : this.#state.selectedNodes;
  }
  set selectedNodes(v) {
    if (this.#selectionManager) {
      this.#selectionManager.selectNodes(v || []);
    } else {
      this.#state.selectedNodes = v || [];
      this.#state.selectables = this.#state.selectedNodes.length > 0 ? 'nodeSelection' : 'nodes';
      this.#emit('selectedNodesChange', this.#state.selectedNodes);
      this.#emit('selectablesChange', this.#state.selectables);
    }
  }

  get selectables() {
    // Derived from SelectionManager state when available
    if (this.#selectionManager) {
      const sm = this.#selectionManager;
      // In node mode, always return node-related value
      if (sm.selectMode === SelectMode.NODE) {
        return sm.hasNodes ? 'nodeSelection' : 'nodes';
      }
      // Object mode
      if (sm.state === SelectionState.NODES_SELECTED || sm.state === SelectionState.HANDLE_DRAGGING) return 'nodeSelection';
      if (sm.selectedPath) return 'nodes';
      return 'objects';
    }
    return this.#state.selectables;
  }
  set selectables(v) {
    if (!this.#selectionManager) {
      this.#state.selectables = v;
      this.#emit('selectablesChange', v);
    }
  }

  get selectMode() {
    return this.#selectionManager
      ? this.#selectionManager.selectMode
      : this.#state.selectMode;
  }
  set selectMode(v) {
    if (this.#selectionManager) {
      this.#selectionManager.setSelectMode(v);
    } else {
      this.#state.selectMode = v;
      this.#emit('selectModeChange', v);
    }
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
      paths: JSON.parse(JSON.stringify(this.#state.paths)),
      selectMode: this.#state.selectMode
    };
  }

  #restoreState(snapshot) {
    this.#state.mode = snapshot.mode;
    this.#state.currentTool = snapshot.currentTool;
    this.#state.currentColor = snapshot.currentColor;
    this.#state.currentSize = snapshot.currentSize;
    this.#state.paths = JSON.parse(JSON.stringify(snapshot.paths));
    this.#state.selectedPath = null;
    this.#state.selectMode = snapshot.selectMode || 'object';
    this.#emit('pathsChange', this.#state.paths);
    this.#emit('modeChange', this.#state.mode);
    this.#emit('toolChange', this.#state.currentTool);
    this.#emit('colorChange', this.#state.currentColor);
    this.#emit('sizeChange', this.#state.currentSize);
    this.#emit('selectModeChange', this.#state.selectMode);
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
    const path = this.#selectionManager ? this.#selectionManager.selectedPath : this.#state.selectedPath;
    if (path) {
      Object.assign(path, props);
      this.#emit('pathsChange', this.#state.paths);
      this.#saveState();
    }
  }

  simplifySelectedPath(tolerance) {
    const path = this.#selectionManager ? this.#selectionManager.selectedPath : this.#state.selectedPath;
    if (!path) return;
    path.points = douglasPeucker(path.points, tolerance);
    this.#emit('pathsChange', this.#state.paths);
    this.#saveState();
  }

  deleteSelectedNodes() {
    const selMgr = this.#selectionManager;
    const path = selMgr ? selMgr.selectedPath : this.#state.selectedPath;
    const nodes = selMgr ? selMgr.selectedNodes : this.#state.selectedNodes;
    if (!path || nodes.length === 0) return;
    if (path.points.length - nodes.length < 2) return; // keep minimum 2 points
    const toRemove = new Set(nodes);
    path.points = path.points.filter((_, i) => !toRemove.has(i));
    if (selMgr) {
      selMgr.selectNodes([]);
    } else {
      this.#state.selectedNodes = [];
      this.#state.selectables = 'nodes';
      this.#emit('selectedNodesChange', this.#state.selectedNodes);
      this.#emit('selectablesChange', this.#state.selectables);
    }
    this.#emit('pathsChange', this.#state.paths);
    this.#saveState();
  }

  insertNodesBetweenSelected() {
    const selMgr = this.#selectionManager;
    const path = selMgr ? selMgr.selectedPath : this.#state.selectedPath;
    const nodes = selMgr ? selMgr.selectedNodes : this.#state.selectedNodes;
    if (!path || nodes.length < 2) return;
    const indices = [...nodes].sort((a, b) => a - b);
    const newIndices = [];
    let offset = 0;
    for (let i = 0; i < indices.length - 1; i++) {
      const aIdx = indices[i] + offset;
      const bIdx = indices[i + 1] + offset;
      if (aIdx + 1 < bIdx) continue; // already have nodes between
      const a = path.points[aIdx];
      const b = path.points[aIdx + 1];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, cpIn: { x: 0, y: 0 }, cpOut: { x: 0, y: 0 }, smooth: false };
      path.points.splice(aIdx + 1, 0, mid);
      newIndices.push(aIdx + 1);
      offset++;
    }
    const updated = [...indices.map(i => i), ...newIndices].sort((a, b) => a - b);
    if (selMgr) {
      selMgr.selectNodes(updated);
    } else {
      this.#state.selectedNodes = updated;
      this.#emit('selectedNodesChange', this.#state.selectedNodes);
    }
    this.#emit('pathsChange', this.#state.paths);
    this.#saveState();
  }

  setNodeTypeForSelected(type) {
    const selMgr = this.#selectionManager;
    const path = selMgr ? selMgr.selectedPath : this.#state.selectedPath;
    const nodes = selMgr ? selMgr.selectedNodes : this.#state.selectedNodes;
    if (!path || nodes.length === 0) return;
    path.points.forEach((p, i) => {
      if (nodes.includes(i)) {
        p.cpIn = p.cpIn || { x: 0, y: 0 };
        p.cpOut = p.cpOut || { x: 0, y: 0 };
        switch (type) {
          case 'corner':
            p.smooth = false;
            p.symmetric = false;
            p.auto = false;
            break;
          case 'smooth':
            p.smooth = true;
            p.symmetric = false;
            p.auto = false;
            if (p.cpIn.x === 0 && p.cpIn.y === 0 && p.cpOut.x === 0 && p.cpOut.y === 0) {
              this.#autoGenerateCP(path, i);
            } else {
              // Ensure colinear: align cpOut to cpIn direction
              const lenOut = Math.hypot(p.cpOut.x, p.cpOut.y);
              const lenIn = Math.hypot(p.cpIn.x, p.cpIn.y);
              if (lenIn > 0) {
                p.cpOut.x = (p.cpIn.x / lenIn) * lenOut;
                p.cpOut.y = (p.cpIn.y / lenIn) * lenOut;
              }
            }
            break;
          case 'symmetric':
            p.smooth = true;
            p.symmetric = true;
            p.auto = false;
            if (p.cpIn.x === 0 && p.cpIn.y === 0 && p.cpOut.x === 0 && p.cpOut.y === 0) {
              this.#autoGenerateCP(path, i);
            } else {
              // Equal length, opposite direction
              const avgLen = (Math.hypot(p.cpIn.x, p.cpIn.y) + Math.hypot(p.cpOut.x, p.cpOut.y)) / 2;
              const lenIn = Math.hypot(p.cpIn.x, p.cpIn.y);
              if (lenIn > 0) {
                p.cpOut.x = -(p.cpIn.x / lenIn) * avgLen;
                p.cpOut.y = -(p.cpIn.y / lenIn) * avgLen;
                p.cpIn.x = -p.cpOut.x;
                p.cpIn.y = -p.cpOut.y;
              }
            }
            break;
          case 'auto':
            p.smooth = true;
            p.symmetric = false;
            p.auto = true;
            this.#autoGenerateCP(path, i);
            break;
        }
      }
    });
    this.#emit('pathsChange', this.#state.paths);
    this.#saveState();
  }

  #autoGenerateCP(path, i) {
    const points = path.points;
    if (i < 0 || i >= points.length) return;
    const p = points[i];
    const prev = points[i > 0 ? i - 1 : null];
    const next = points[i < points.length - 1 ? i + 1 : null];
    if (!prev || !next) return;

    const tension = 0.3;
    const dxIn = p.x - prev.x, dyIn = p.y - prev.y;
    const dxOut = next.x - p.x, dyOut = next.y - p.y;
    const lenIn = Math.hypot(dxIn, dyIn) || 1;
    const lenOut = Math.hypot(dxOut, dyOut) || 1;

    const tx = (dxIn / lenIn + dxOut / lenOut) / 2;
    const ty = (dyIn / lenIn + dyOut / lenOut) / 2;
    const tLen = Math.hypot(tx, ty) || 1;

    const dIn = Math.min(lenIn * tension, 50);
    const dOut = Math.min(lenOut * tension, 50);

    p.cpIn = { x: -(tx / tLen) * dIn, y: -(ty / tLen) * dIn };
    p.cpOut = { x: (tx / tLen) * dOut, y: (ty / tLen) * dOut };
  }

  clearCanvas() {
    this.#state.paths = [];
    this.#emit('clearCanvas');
    this.#saveState();
  }

  setMode(newMode) {
    this.#state.currentPath = null;
    this.#emit('currentPathChange', null);
    if (this.#selectionManager) {
      if (newMode !== 'selection') {
        this.#selectionManager.clear();
      }
    } else {
      this.#state.selectedNodes = [];
      if (newMode !== 'selection') {
        this.#state.selectedPath = null;
        this.#state.selectables = 'objects';
        this.#emit('selectedPathChange', null);
      }
    }
    this.mode = newMode; // triggers activateState
  }
}

class CorePanel {
  #stateMachine;
  #selectionManager;
  #subWindowManager;
  #el;

  constructor(stateMachine, selectionManager, subWindowManager) {
    this.#stateMachine = stateMachine;
    this.#selectionManager = selectionManager;
    this.#subWindowManager = subWindowManager;
  }

  buildDom(container) {
    const panel = document.createElement('div');
    panel.id = 'corePanel';
    this.#el = panel;

    // ── Top bar: actions + GNOME2-style horizontal window list ──
    const bar = document.createElement('div');
    bar.className = 'topbar';

    const fullscreenBtn = this.#makeBtn('fullscreenBtn', 'Plein ecran',
      '<svg class="expand-icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>' +
      '<svg class="compress-icon" viewBox="0 0 24 24" style="display:none"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>');
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    const clearBtn = this.#makeBtn('clearBtn', 'Effacer',
      '<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>');
    clearBtn.addEventListener('click', () => this.#stateMachine.clearCanvas());

    const undoBtn = this.#makeBtn('undoBtn', 'Annuler',
      '<svg viewBox="0 0 24 24"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg>');
    undoBtn.addEventListener('click', () => this.#stateMachine.undo());

    const redoBtn = this.#makeBtn('redoBtn', 'Refaire',
      '<svg viewBox="0 0 24 24"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5"/></svg>');
    redoBtn.addEventListener('click', () => this.#stateMachine.redo());

    const sep = document.createElement('div');
    sep.className = 'topbar-sep';

    // ── Tool buttons defined here, appended after redo and before window list ──
    const toolSep = document.createElement('div');
    toolSep.className = 'topbar-sep';

    const toolDefs = [
      { id: 'toolDraw', tool: 'draw', icon: 'M3 17l3-6 3 6 3-6 3 6', label: 'Dessin', zigzag: true },
      { id: 'toolSelect', tool: 'select', icon: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z', label: 'Sélection' },
      { id: 'toolNodes', tool: 'select', icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z', label: 'Nœuds', isNodes: true }
    ];

    // GNOME2-style horizontal window list
    const winList = document.createElement('div');
    winList.id = 'topbarWinList';
    winList.className = 'topbar-win-list-gnome2';

    bar.appendChild(fullscreenBtn);
    bar.appendChild(clearBtn);
    bar.appendChild(undoBtn);
    bar.appendChild(redoBtn);
    bar.appendChild(sep);
    // Tool buttons
    toolDefs.forEach((td, i) => {
      const btn = document.createElement('button');
      btn.id = td.id;
      btn.className = 'topbar-tool-btn' + (i === 0 ? ' active' : '');
      btn.dataset.tool = td.tool;
      btn.title = td.label;
      btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px"><path d="${td.icon}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      btn.addEventListener('click', () => {
        if (td.isNodes) {
          this.#selectTool(td.tool);
          this.#toggleSelectMode();
        } else {
          this.#selectTool(td.tool);
        }
      });
      bar.appendChild(btn);
    });
    bar.appendChild(toolSep);
    // Window list
    bar.appendChild(winList);
    panel.appendChild(bar);

    // App info
    const appInfo = document.createElement('div');
    appInfo.className = 'topbar-app-info';
    appInfo.innerHTML = `<span class="app-name">${APP_NAME}</span><span class="app-version">${APP_VERSION}</span>`;
    panel.appendChild(appInfo);

    container.appendChild(panel);

    // Initial window list + subscribe to changes
    this.#updateWinList();
    this.#subWindowManager.on('windowAdded', () => this.#updateWinList());
    this.#subWindowManager.on('windowRemoved', () => this.#updateWinList());
    this.#subWindowManager.on('visibilityChange', () => this.#updateWinList());

    // Fullscreen change handler
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

  #updateWinList() {
    const list = document.getElementById('topbarWinList');
    if (!list) return;
    list.innerHTML = '';
    this.#subWindowManager.getWindows().forEach(w => {
      const btn = document.createElement('button');
      btn.className = 'topbar-win-btn' + (w.visible ? ' active' : '');
      btn.title = w.title;
      btn.innerHTML = `<svg viewBox="0 0 16 16" class="topbar-win-icon"><rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="4" r="1.5" fill="currentColor" opacity="0.5"/></svg><span class="topbar-win-label">${w.title}</span>`;
      btn.addEventListener('click', () => this.#subWindowManager.toggleWindow(w.id));
      list.appendChild(btn);
    });
  }

  #makeBtn(id, title, svgContent) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'topbar-btn';
    btn.title = title;
    btn.innerHTML = svgContent;
    return btn;
  }

  #toggleWinList() {
    const list = document.getElementById('topbarWinList');
    if (!list) return;
    const isVisible = list.style.display === 'block';
    if (isVisible) {
      list.style.display = 'none';
    } else {
      list.innerHTML = '';
      const ul = document.createElement('ul');
      ul.className = 'topbar-win-list-ul';
      this.#subWindowManager.getWindows().forEach(w => {
        const li = document.createElement('li');
        li.className = 'topbar-win-item' + (w.visible ? ' visible' : '');
        li.innerHTML = `<span>${w.title}</span><span class="topbar-win-status">${w.visible ? '●' : '○'}</span>`;
        li.addEventListener('click', () => {
          this.#subWindowManager.toggleWindow(w.id);
          list.style.display = 'none';
        });
        ul.appendChild(li);
      });
      list.appendChild(ul);
      list.style.display = 'block';
    }
  }

  // ── Private helpers ──
  /**
   * Sync topbar tool button active states with internal state.
   */
  #syncToolButtons() {
    const tool = this.#stateMachine.currentTool;
    const selectMode = this.#selectionManager.selectMode;

    // Draw: active when tool === 'draw'
    const drawBtn = document.getElementById('toolDraw');
    if (drawBtn) drawBtn.classList.toggle('active', tool === 'draw');

    // Select: active when tool === 'select' && selectMode === 'object'
    const selectBtn = document.getElementById('toolSelect');
    if (selectBtn) selectBtn.classList.toggle('active', tool === 'select' && selectMode === SelectMode.OBJECT);

    // Nodes: active when tool === 'select' && selectMode === 'node'
    const nodesBtn = document.getElementById('toolNodes');
    if (nodesBtn) nodesBtn.classList.toggle('active', tool === 'select' && selectMode === SelectMode.NODE);
  }

  #selectTool(tool) {
    this.#stateMachine.currentTool = tool;
    const modeMap = { draw: 'drawingTool', select: 'selection', pan: 'drawingTool' };
    this.#stateMachine.setMode(modeMap[tool] || 'drawingTool');
    this.#syncToolButtons();
  }

  #toggleSelectMode() {
    const current = this.#selectionManager.selectMode;
    const next = current === SelectMode.OBJECT ? SelectMode.NODE : SelectMode.OBJECT;
    this.#selectionManager.setSelectMode(next);
    this.#syncToolButtons();
    this.#syncNodeTypeButtons();
  }

  #selectColor(color) {
    document.querySelectorAll('.panel-color-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.panel-color-btn[data-color="${color}"]`);
    if (btn) btn.classList.add('active');
    if (this.#selectionManager.selectedPath) this.#stateMachine.updateSelectedPath({ color });
    this.#stateMachine.currentColor = color;
  }

  #selectSize(size) {
    document.querySelectorAll('.panel-size-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.panel-size-btn[data-size="${size}"]`);
    if (btn) btn.classList.add('active');
    if (this.#selectionManager.selectedPath) this.#stateMachine.updateSelectedPath({ size });
    this.#stateMachine.currentSize = size;
  }

  // ── Public delegates for SubWindow controls ──
  selectTool(tool) { this.#selectTool(tool); }
  toggleSelectMode() { this.#toggleSelectMode(); }
  selectColor(color) { this.#selectColor(color); }
  selectSize(size) { this.#selectSize(size); }
  selectNodeType(type) { this.#stateMachine.setNodeTypeForSelected(type); }
  deleteNodes() { this.#stateMachine.deleteSelectedNodes(); }
  insertNodes() { this.#stateMachine.insertNodesBetweenSelected(); }
  simplifySelectedPath(tol) { this.#stateMachine.simplifySelectedPath(tol); }

  // ── Sync toolSelector UI with current selection ──
  syncSelection(path) {
    const propsSection = document.getElementById('toolPropsSection');
    if (propsSection) propsSection.style.display = path ? '' : 'none';
    if (path) {
      const el = (id) => document.getElementById(id);
      if (el('tpColor')) el('tpColor').textContent = path.color;
      if (el('tpSize')) el('tpSize').textContent = path.size + 'px';
      if (el('tpPoints')) el('tpPoints').textContent = path.points ? path.points.length : 0;
    }
  }

  syncNodeSelection() {
    const nodes = this.#selectionManager.selectedNodes;
    const nodeSection = document.getElementById('toolNodeSection');
    if (nodeSection) {
      nodeSection.style.display = nodes && nodes.length > 0 ? '' : 'none';
      if (nodes && nodes.length > 0) {
        const el = (id) => document.getElementById(id);
        if (el('tnCount')) el('tnCount').textContent = nodes.length;
        if (el('tnIndices')) el('tnIndices').textContent = nodes.sort((a, b) => a - b).join(', ');
      }
    }
    this.#syncNodeTypeSelector();
    this.#syncNodeTypeButtons();
  }

  /**
   * Sync node type buttons in topbar/toolSelector with selected nodes.
   */
  #syncNodeTypeButtons() {
    const path = this.#selectionManager.selectedPath;
    const nodes = this.#selectionManager.selectedNodes;

    const typeMap = { corner: 'tnCorner', smooth: 'tnSmooth', symmetric: 'tnSymmetric', auto: 'tnAuto' };

    // Reset all
    for (const id of Object.values(typeMap)) {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    }

    if (!path || nodes.length === 0) return;

    // Determine the dominant node type among selected nodes
    const counts = { corner: 0, smooth: 0, symmetric: 0, auto: 0 };
    nodes.forEach(i => {
      if (i < 0 || i >= path.points.length) return;
      const p = path.points[i];
      if (p.auto) counts.auto++;
      else if (p.symmetric) counts.symmetric++;
      else if (p.smooth) counts.smooth++;
      else counts.corner++;
    });

    // Find dominant type
    let dominant = 'corner';
    let maxCount = 0;
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; dominant = type; }
    }

    // Activate dominant button
    const activeId = typeMap[dominant];
    if (activeId) {
      const btn = document.getElementById(activeId);
      if (btn) btn.classList.add('active');
    }
  }

  #syncNodeTypeSelector() {
    const path = this.#selectionManager.selectedPath;
    if (!path) return;
    const nodes = this.#selectionManager.selectedNodes;
    if (nodes.length === 0) return;

    // Determine the dominant node type among selected nodes
    const counts = { corner: 0, smooth: 0, symmetric: 0, auto: 0 };
    nodes.forEach(i => {
      if (i < 0 || i >= path.points.length) return;
      const p = path.points[i];
      if (p.auto) counts.auto++;
      else if (p.symmetric) counts.symmetric++;
      else if (p.smooth) counts.smooth++;
      else counts.corner++;
    });

    // Find dominant type
    let dominant = 'corner';
    let maxCount = 0;
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; dominant = type; }
    }

    // Update legacy selector
    const selector = document.getElementById('nodeTypeSelector');
    if (selector) {
      selector.querySelectorAll('.node-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nodeType === dominant);
      });
    }

    // Update toolSelector node type buttons
    const typeMap = { corner: 'tnCorner', smooth: 'tnSmooth', symmetric: 'tnSymmetric', auto: 'tnAuto' };
    for (const [type, id] of Object.entries(typeMap)) {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', type === dominant);
    }
  }
}

class DrawArea {
  #stateMachine;
  #selectionManager;
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

  constructor(stateMachine, selectionManager) {
    this.#stateMachine = stateMachine;
    this.#selectionManager = selectionManager;
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

  /**
   * Normalize a point to ensure it has cpIn/cpOut/smooth properties.
   * cpIn and cpOut are RELATIVE offsets from the node position.
   * @param {object} p - {x, y, cpIn?, cpOut?, smooth?}
   * @returns {object} normalized point
   */
  _normalizePoint(p) {
    return {
      x: p.x, y: p.y,
      cpIn: p.cpIn || { x: 0, y: 0 },
      cpOut: p.cpOut || { x: 0, y: 0 },
      smooth: p.smooth !== undefined ? p.smooth : false,
      symmetric: p.symmetric !== undefined ? p.symmetric : false,
      auto: p.auto !== undefined ? p.auto : false,
    };
  }

  /**
   * Convert an array of points to an SVG path d-string using cubic Bezier curves.
   * Points without control points (cpIn/cpOut = 0) render as straight lines.
   */
  #pointsToSvgPath(points) {
    if (!points || points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpOut = prev.cpOut || { x: 0, y: 0 };
      const cpIn = curr.cpIn || { x: 0, y: 0 };

      if (cpOut.x === 0 && cpOut.y === 0 && cpIn.x === 0 && cpIn.y === 0) {
        // No control points — straight line
        d += ` L ${curr.x} ${curr.y}`;
      } else {
        // Cubic Bezier: control points are absolute (node position + relative offset)
        const cp1x = prev.x + cpOut.x;
        const cp1y = prev.y + cpOut.y;
        const cp2x = curr.x + cpIn.x;
        const cp2y = curr.y + cpIn.y;
        d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${curr.x} ${curr.y}`;
      }
    }
    return d;
  }

  _redraw() {
    if (!this.#svg || !this.#svgPaths) return;

    this.#svgPaths.innerHTML = '';

    const paths = this.#stateMachine.paths;
    const selectedPath = this.#selectionManager.selectedPath;

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

    // Selection bounding box rectangle
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
    const selectedPath = this.#selectionManager.selectedPath;
    if (!selectedPath || !selectedPath.points || selectedPath.points.length < 2) {
      this._clearHandleDrag();
      return;
    }

    const points = selectedPath.points;
    const selectedNodes = this.#selectionManager.selectedNodes;
    const isNodeMode = this.#selectionManager.selectMode === SelectMode.NODE;

    // Normalize all points to have cpIn/cpOut/smooth
    points.forEach((p, i) => { points[i] = this._normalizePoint(p); });

    const bbox = this.#computeBBox(points);
    const padding = 4;
    const tl = this.#docToScreen(bbox.minX - padding, bbox.minY - padding);
    const br = this.#docToScreen(bbox.maxX + padding, bbox.maxY + padding);

    // BBox rectangle — always visible when a path is selected
    {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', tl.x);
      rect.setAttribute('y', tl.y);
      rect.setAttribute('width', br.x - tl.x);
      rect.setAttribute('height', br.y - tl.y);
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', isNodeMode ? '#69f0ae' : '#4fc3f7');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '6 3');
      rect.setAttribute('pointer-events', 'none');
      this.#svgUI.appendChild(rect);
    }

    // Transform handles (only when no nodes are selected — object-level manipulation)
    if (!isNodeMode || selectedNodes.length === 0) {
      const handleSize = 10;
      const handles = [
        { name: 'n',  cx: (tl.x + br.x) / 2, cy: tl.y },
        { name: 's',  cx: (tl.x + br.x) / 2, cy: br.y },
        { name: 'w',  cx: tl.x, cy: (tl.y + br.y) / 2 },
        { name: 'e',  cx: br.x, cy: (tl.y + br.y) / 2 },
        { name: 'nw', cx: tl.x, cy: tl.y },
        { name: 'ne', cx: br.x, cy: tl.y },
        { name: 'sw', cx: tl.x, cy: br.y },
        { name: 'se', cx: br.x, cy: br.y },
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

      this._bboxHandleCenters = handles;
    } else {
      this._bboxHandleCenters = [];
    }

    // Build handle list: node circles + control point diamonds (node mode only)
    const nodeRadius = 5;
    const cpSize = 7; // diamond half-size
    const nodeHandles = [];
    const allHandles = [];

    if (isNodeMode) {
      points.forEach((p, i) => {
        const sp = this.#docToScreen(p.x, p.y);
        const isSelected = selectedNodes.includes(i);

        // Node circle
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', sp.x);
        c.setAttribute('cy', sp.y);
        c.setAttribute('r', nodeRadius);
        c.setAttribute('fill', isSelected ? '#69f0ae' : '#4fc3f7');
        c.setAttribute('stroke', isSelected ? '#fff' : '#fff');
        c.setAttribute('stroke-width', '2');
        c.setAttribute('pointer-events', 'none');
        this.#svgUI.appendChild(c);
        nodeHandles.push({ name: `node:${i}`, x: sp.x, y: sp.y });

        // For SELECTED nodes: show control point handles and lines
        if (isSelected && (p.cpIn || p.cpOut || p.smooth)) {
          const cpIn = p.cpIn || { x: 0, y: 0 };
          const cpOut = p.cpOut || { x: 0, y: 0 };
          const hasCpIn = cpIn.x !== 0 || cpIn.y !== 0;
          const hasCpOut = cpOut.x !== 0 || cpOut.y !== 0;

          if (hasCpIn || hasCpOut) {
            // Control point lines
            if (hasCpIn) {
              const cpInScreen = this.#docToScreen(p.x + cpIn.x, p.y + cpIn.y);
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', sp.x); line.setAttribute('y1', sp.y);
              line.setAttribute('x2', cpInScreen.x); line.setAttribute('y2', cpInScreen.y);
              line.setAttribute('stroke', '#ffa726');
              line.setAttribute('stroke-width', '1.5');
              line.setAttribute('pointer-events', 'none');
              this.#svgUI.appendChild(line);

              // cpIn diamond
              const d = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
              const pts = `${cpInScreen.x},${cpInScreen.y - cpSize} ${cpInScreen.x + cpSize},${cpInScreen.y} ${cpInScreen.x},${cpInScreen.y + cpSize} ${cpInScreen.x - cpSize},${cpInScreen.y}`;
              d.setAttribute('points', pts);
              d.setAttribute('fill', '#ffa726');
              d.setAttribute('stroke', '#fff');
              d.setAttribute('stroke-width', '1.5');
              d.setAttribute('pointer-events', 'none');
              this.#svgUI.appendChild(d);
              allHandles.push({ name: `cpIn:${i}`, x: cpInScreen.x, y: cpInScreen.y });
            }

            if (hasCpOut) {
              const cpOutScreen = this.#docToScreen(p.x + cpOut.x, p.y + cpOut.y);
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', sp.x); line.setAttribute('y1', sp.y);
              line.setAttribute('x2', cpOutScreen.x); line.setAttribute('y2', cpOutScreen.y);
              line.setAttribute('stroke', '#ffa726');
              line.setAttribute('stroke-width', '1.5');
              line.setAttribute('pointer-events', 'none');
              this.#svgUI.appendChild(line);

              // cpOut diamond
              const d = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
              const pts = `${cpOutScreen.x},${cpOutScreen.y - cpSize} ${cpOutScreen.x + cpSize},${cpOutScreen.y} ${cpOutScreen.x},${cpOutScreen.y + cpSize} ${cpOutScreen.x - cpSize},${cpOutScreen.y}`;
              d.setAttribute('points', pts);
              d.setAttribute('fill', '#ffa726');
              d.setAttribute('stroke', '#fff');
              d.setAttribute('stroke-width', '1.5');
              d.setAttribute('pointer-events', 'none');
              this.#svgUI.appendChild(d);
              allHandles.push({ name: `cpOut:${i}`, x: cpOutScreen.x, y: cpOutScreen.y });
            }
          }
        }
      });
    } // end if (isNodeMode)

    this._handleCenters = [...nodeHandles, ...allHandles];
    this._handleHitRadius = Math.max(nodeRadius, cpSize) * 2.5;
  }

  /**
   * Débute la déformation via une poignée.
   * Appelé quand l'overlay détecte un touch sur une poignée.
   */
  _startHandleDrag(handleName, screenX, screenY) {
    const doc = this.#screenToDoc(screenX, screenY);

    const path = this.#selectionManager.selectedPath;
    if (!path) return;

    this._handleDragHandle = handleName;
    this._handleDragOrigPoints = path.points.map(p => {
      const np = this._normalizePoint(p);
      return { ...np, cpIn: { ...np.cpIn }, cpOut: { ...np.cpOut } };
    });
    this._handleDragOrigBBox = this.#computeBBox(path.points);
    this._handleDragStartDoc = doc;

    const handleInfo = { name: handleName, screenX, screenY, docX: doc.x, docY: doc.y };
    this.#selectionManager.startHandleDrag(handleInfo);

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

    const handleInfo = {
      name: this._handleDragHandle,
      screenX, screenY,
      docX: doc.x, docY: doc.y
    };
    this.#selectionManager.handleDrag(handleInfo);

    this._deformPath(doc);
    this._redraw();
    e.preventDefault();
  }

  _onHandleDragEnd() {
    this.#selectionManager.endHandleDrag();
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
    const path = this.#selectionManager.selectedPath;
    if (!path) return;

    // Normalize points
    path.points.forEach((p, i) => { path.points[i] = this._normalizePoint(p); });

    // Control point drag
    const cpMatch = this._handleDragHandle.match(/^cp(In|Out):(\d+)$/);
    if (cpMatch) {
      const cpType = cpMatch[1]; // 'cpIn' or 'cpOut'
      const nodeIndex = parseInt(cpMatch[2], 10);
      if (isNaN(nodeIndex) || nodeIndex >= path.points.length) return;

      const node = path.points[nodeIndex];
      const nodeScreen = this.#docToScreen(node.x, node.y);
      const cpScreen = this.#docToScreen(newDocPos.x, newDocPos.y);

      // Control point offset in screen coords
      const cpOffsetScreen = { x: cpScreen.x - nodeScreen.x, y: cpScreen.y - nodeScreen.y };
      // Convert back to document coords (relative offset scales with zoom)
      const ctm = this.#svg.getScreenCTM();
      const scale = ctm ? ctm.a : 1;
      const cpOffsetDoc = { x: cpOffsetScreen.x / scale, y: cpOffsetScreen.y / scale };

      if (node.smooth) {
        // Smooth: mirror the other control point
        if (cpType === 'cpIn') {
          node.cpIn = cpOffsetDoc;
          if (node.symmetric) {
            // Symmetric: exact opposite, same length
            node.cpOut = { x: -cpOffsetDoc.x, y: -cpOffsetDoc.y };
          } else {
            // Smooth: colinear but keep original length for cpOut
            const lenOut = Math.hypot(node.cpOut.x, node.cpOut.y);
            const lenIn = Math.hypot(cpOffsetDoc.x, cpOffsetDoc.y);
            if (lenIn > 0) {
              node.cpOut.x = (cpOffsetDoc.x / lenIn) * lenOut;
              node.cpOut.y = (cpOffsetDoc.y / lenIn) * lenOut;
            }
          }
        } else {
          node.cpOut = cpOffsetDoc;
          if (node.symmetric) {
            node.cpIn = { x: -cpOffsetDoc.x, y: -cpOffsetDoc.y };
          } else {
            const lenIn = Math.hypot(node.cpIn.x, node.cpIn.y);
            const lenOut = Math.hypot(cpOffsetDoc.x, cpOffsetDoc.y);
            if (lenOut > 0) {
              node.cpIn.x = (cpOffsetDoc.x / lenOut) * lenIn;
              node.cpIn.y = (cpOffsetDoc.y / lenOut) * lenIn;
            }
          }
        }
      } else {
        // Corner: only move the dragged control point
        node[cpType] = cpOffsetDoc;
      }

      this.#stateMachine.updateSelectedPath({ points: path.points });
      return;
    }

    // Node drag: move the node AND its control points together
    if (this._handleDragHandle.startsWith('node:')) {
      const nodeIndex = parseInt(this._handleDragHandle.split(':')[1], 10);
      if (isNaN(nodeIndex) || nodeIndex >= path.points.length) return;

      const origPoint = this._handleDragOrigPoints[nodeIndex];
      const node = path.points[nodeIndex];
      node.x = newDocPos.x;
      node.y = newDocPos.y;
      // Control points are relative offsets, keep original values
      node.cpIn = { x: origPoint.cpIn?.x || 0, y: origPoint.cpIn?.y || 0 };
      node.cpOut = { x: origPoint.cpOut?.x || 0, y: origPoint.cpOut?.y || 0 };

      this.#stateMachine.updateSelectedPath({ points: path.points });
      return;
    }

    // BBox deformation (unchanged)
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

    path.points = orig.map(p => {
      const np = this._normalizePoint(p);
      const scaled = {
        x: doX ? anchorX + (p.x - anchorX) * scaleX : p.x,
        y: doY ? anchorY + (p.y - anchorY) * scaleY : p.y,
        cpIn: { x: np.cpIn.x * scaleX, y: np.cpIn.y * scaleY },
        cpOut: { x: np.cpOut.x * scaleX, y: np.cpOut.y * scaleY },
        smooth: np.smooth,
      };
      return scaled;
    });
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

    // SelectionManager events
    if (this.#selectionManager) {
      this.#selectionManager.on('selectionChange', () => this._redraw());
      this.#selectionManager.on('handleDrag', () => this._redraw());
    }

    // Cursor events — drawing or selection bbox
    overlay.engine.on('cursorActivate', (e) => {
      if (this.#stateMachine.mode === 'drawingTool') {
        const pt = this.#screenToDoc(e.touchX, e.touchY);
        this.#stateMachine.currentPath = [{ x: pt.x, y: pt.y }];
      } else if (this.#stateMachine.mode === 'selection') {
        // In selection mode, cursorActivate starts a bbox (both object and node mode)
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
      } else if (this.#stateMachine.mode === 'selection') {
        // Update bbox de sélection
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
      } else if (this.#stateMachine.mode === 'selection') {
        // End of bbox — perform additive selection
        if (this.#selectionManager.selectMode === SelectMode.OBJECT) {
          this._addPathsInBBox();
        } else {
          this._addNodesInBBox();
        }
        this._selBBoxStart = null;
        this._selBBoxCurrent = null;
      }
    });
    this._selBBoxStart = null;
    this._selBBoxCurrent = null;

    overlay.engine.on('tap', (e) => {
      if (this.#stateMachine.mode !== 'selection') return;

      if (this.#selectionManager.selectMode === SelectMode.OBJECT) {
        // Object mode: tap toggles whole path
        const pt = this.#screenToDoc(e.x, e.y);
        const found = this._findPathAtPoint(pt.x, pt.y);
        if (found) {
          this.#selectionManager.togglePath(found);
        } else {
          // Tap on empty space — deselect
          this.#selectionManager.selectPath(null);
        }
      } else {
        // Node mode: tap toggles nodes on the active path
        const sx = e.x;
        const sy = e.y;

        // Check if tap hit a node handle
        let hitHandle = null;
        let minDist = Infinity;
        if (this._handleCenters) {
          for (const h of this._handleCenters) {
            const d = Math.hypot(sx - h.x, sy - h.y);
            if (d < minDist) { minDist = d; hitHandle = h; }
          }
        }

        // Determine node index from handle name (node:N, cpIn:N, cpOut:N)
        let nodeIdx = -1;
        if (hitHandle) {
          const parts = hitHandle.name.split(':');
          nodeIdx = parseInt(parts[1], 10);
        }

        if (nodeIdx >= 0) {
          // Toggle this node
          this.#selectionManager.toggleNode(nodeIdx);
        } else {
          // Tap on empty space or non-handle area
          const pt = this.#screenToDoc(sx, sy);
          const found = this._findPathAtPoint(pt.x, pt.y);
          if (found && found !== this.#selectionManager.selectedPath) {
            // Switch active path
            this.#selectionManager.selectPath(found);
          } else if (!found) {
            // Tap on empty space — deselect
            this.#selectionManager.selectPath(null);
          }
        }
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

    // Zoom + Pan via pinch (2-finger gesture)
    overlay.engine.on('pinchStart', (e) => {
      const cx = (e.x1 + e.x2) / 2;
      const cy = (e.y1 + e.y2) / 2;
      const doc = this.#screenToDoc(cx, cy);
      this._pinchDocCenter = doc;
      this._pinchScreenCenter = { x: cx, y: cy };
    });
    overlay.engine.on('pinchChange', (e) => {
      if (this._pinchDocCenter) {
        this.#zoomAt(this._pinchDocCenter.x, this._pinchDocCenter.y, e.scale / this._pinchLastScale);
      }
      // Pan: convert screen center movement to document delta
      const cx = (e.x1 + e.x2) / 2;
      const cy = (e.y1 + e.y2) / 2;
      if (this._pinchScreenCenter) {
        const oldDoc = this.#screenToDoc(this._pinchScreenCenter.x, this._pinchScreenCenter.y);
        const newDoc = this.#screenToDoc(cx, cy);
        const docDx = newDoc.x - oldDoc.x;
        const docDy = newDoc.y - oldDoc.y;
        if (Math.abs(docDx) > 0.5 || Math.abs(docDy) > 0.5) {
          this.#pan(docDx, docDy);
        }
      }
      this._pinchScreenCenter = { x: cx, y: cy };
      this._pinchLastScale = e.scale;
    });
    overlay.engine.on('pinchEnd', () => {
      this._pinchDocCenter = null;
      this._pinchLastScale = 1;
      this._pinchScreenCenter = null;
    });
    this._pinchDocCenter = null;
    this._pinchLastScale = 1;
    this._pinchScreenCenter = null;

    // Handle hit detection via overlay touch (capture phase, before TNT)
    // Only used in 'nodeSelection' mode for dragging selected node handles.
    // In 'nodes' mode, TNT cursor events handle bbox selection.
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this.#touchOverlay.addEventListener('touchstart', this._handleTouchStart, { passive: false, capture: true });
  }

  _handleTouchStart(e) {
    if (this._handleDragHandle) return; // already dragging
    if (this.#stateMachine.mode !== 'selection') return;
    if (e.touches.length > 1) return; // multi-touch → let TNT handle

    // Only intercept in 'nodeSelection' mode (nodes already selected).
    // In 'nodes' mode, let TNT cursor events handle bbox selection.
    if (this.#stateMachine.selectables !== 'nodeSelection') return;

    const touch = e.touches[0];
    const rect = this.#el.getBoundingClientRect();
    const sx = touch.clientX - rect.left;
    const sy = touch.clientY - rect.top;

    let hit = null;
    let minDist = Infinity;
    for (const h of this._handleCenters) {
      const d = Math.hypot(sx - h.x, sy - h.y);
      if (d < minDist) { minDist = d; hit = h; }
    }

    if (hit && minDist <= this._handleHitRadius * 1.5) {
      e.stopPropagation();
      this._startHandleDrag(hit.name, sx, sy);
    }
  }

  /**
   * Add paths found in the bbox to the selection (additive).
   */
  _addPathsInBBox() {
    if (!this._selBBoxStart || !this._selBBoxCurrent) return;
    const x1 = Math.min(this._selBBoxStart.x, this._selBBoxCurrent.x);
    const y1 = Math.min(this._selBBoxStart.y, this._selBBoxCurrent.y);
    const x2 = Math.max(this._selBBoxStart.x, this._selBBoxCurrent.x);
    const y2 = Math.max(this._selBBoxStart.y, this._selBBoxCurrent.y);

    // Ignore if too small (was a tap)
    if (x2 - x1 < 5 && y2 - y1 < 5) return;

    const paths = this.#stateMachine.paths;
    const found = [];
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      for (const p of path.points) {
        if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
          found.push(path);
          break;
        }
      }
    }

    // Add first found path (top-most) to selection
    if (found.length > 0) {
      this.#selectionManager.selectPath(found[0]);
    }
  }

  /**
   * Add nodes found in the bbox to the current node selection (additive).
   */
  _addNodesInBBox() {
    if (!this._selBBoxStart || !this._selBBoxCurrent) return;
    const x1 = Math.min(this._selBBoxStart.x, this._selBBoxCurrent.x);
    const y1 = Math.min(this._selBBoxStart.y, this._selBBoxCurrent.y);
    const x2 = Math.max(this._selBBoxStart.x, this._selBBoxCurrent.x);
    const y2 = Math.max(this._selBBoxStart.y, this._selBBoxCurrent.y);

    // Ignore if too small (was a tap)
    if (x2 - x1 < 5 && y2 - y1 < 5) return;

    const path = this.#selectionManager.selectedPath;
    if (!path) return;

    const found = [];
    path.points.forEach((p, i) => {
      if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
        found.push(i);
      }
    });

    if (found.length > 0) {
      this.#selectionManager.addNodes(found);
    }
  }

}
