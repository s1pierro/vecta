/**
 * JsonEditCard — Recursive, auto-composing JSON editor.
 *
 * Renders any JSON value (primitive, array, object) as editable DOM elements.
 * Uses recursion: arrays/objects create child JsonEditCard instances.
 *
 * Usage:
 *   const card = new JsonEditCard({ a: 1, b: [2, 3] }, container);
 *   card.getValue(); // → { a: 1, b: [2, 3] }
 *   card.on('change', (val) => console.log(val));
 */
class JsonEditCard {
  #json;
  #domDest;
  #onChange = [];
  #children = [];
  #root;

  /**
   * @param {*} json — any JSON-serializable value
   * @param {HTMLElement} domDest — container to render into
   * @param {object} [options]
   * @param {boolean} [options.showType=true] — show type labels
   * @param {boolean} [options.deletable=false] — show delete button
   * @param {string} [options.label] — optional label for this card
   * @param {Function} [options.onDelete] — callback when delete clicked
   * @param {boolean} [options.inTypedArray=false] — true when inside a typed array
   * @param {number} [options.depth=0] — nesting depth for styling
   */
  constructor(json, domDest, options = {}) {
    this.#json = json;
    this.#domDest = domDest;
    this._options = {
      showType: options.showType !== false,
      deletable: options.deletable === true,
      label: options.label || '',
      onDelete: options.onDelete || null,
      inTypedArray: options.inTypedArray === true,
      depth: typeof options.depth === 'number' ? options.depth : 0
    };
    this.#build();
  }

  /** Build the DOM structure */
  #build() {
    this.#domDest.innerHTML = '';
    this.#children = [];
    this.#root = document.createElement('div');

    // Root card: transparent bg + light padding
    this.#root.className = 'json-edit-card';

    // Direct children (depth 0): orange bg + black text
    if (this._options.depth === 0) {
      this.#root.classList.add('jec-root-level');
    } else {
      // Deeper levels: moderate border
      this.#root.classList.add('jec-nested-level');
    }

    // Label row (if label provided or deletable)
    if (this._options.label || this._options.deletable) {
      const labelRow = document.createElement('div');
      labelRow.className = 'jec-label-row';

      if (this._options.label) {
        const lbl = document.createElement('span');
        lbl.className = 'jec-label';
        lbl.textContent = this._options.label;
        labelRow.appendChild(lbl);
      }

      if (this._options.deletable && this._options.onDelete) {
        const delBtn = document.createElement('button');
        delBtn.className = 'jec-del-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', () => this._options.onDelete());
        labelRow.appendChild(delBtn);
      }

      this.#root.appendChild(labelRow);
    }

    // Render the value
    const valueDom = this.#render(this.#json);
    this.#root.appendChild(valueDom);
    this.#domDest.appendChild(this.#root);
  }

  /** Infer the common type of array elements */
  static #inferArrayTypes(arr) {
    if (arr.length === 0) return 'empty';
    const types = arr.map(v => v === null ? 'null' : typeof v);
    const unique = [...new Set(types)];
    if (unique.length === 1) return unique[0];
    // Check if all non-null items share a type
    const nonNull = types.filter(t => t !== 'null');
    if (nonNull.length === 0) return 'null';
    const nonNullUnique = [...new Set(nonNull)];
    if (nonNullUnique.length === 1) return `${nonNullUnique[0]}?`;
    return 'mixed';
  }

  /** Recursively render a value */
  #render(value) {
    if (value === null || value === undefined) {
      return this.#renderNull();
    }
    if (typeof value === 'boolean') {
      return this.#renderBool(value);
    }
    if (typeof value === 'number') {
      return this.#renderNumber(value);
    }
    if (typeof value === 'string') {
      return this.#renderString(value);
    }
    if (Array.isArray(value)) {
      return this.#renderArray(value);
    }
    if (typeof value === 'object') {
      return this.#renderObject(value);
    }
    const span = document.createElement('span');
    span.textContent = String(value);
    return span;
  }

  #renderNull() {
    if (this._options.inTypedArray) {
      // Inside a typed array — just show null label
      const el = document.createElement('span');
      el.className = 'jec-null';
      el.textContent = 'null';
      return el;
    }
    // Not in typed array — show type selector
    const wrapper = document.createElement('div');
    wrapper.className = 'jec-null-editor';

    const label = document.createElement('span');
    label.className = 'jec-null-label';
    label.textContent = 'null';
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.className = 'jec-type-select';
    select.innerHTML = '<option value="">→ type</option><option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option><option value="object">object</option><option value="array">array</option>';
    select.addEventListener('change', () => {
      const type = select.value;
      let newVal = null;
      switch (type) {
        case 'string': newVal = ''; break;
        case 'number': newVal = 0; break;
        case 'boolean': newVal = false; break;
        case 'object': newVal = {}; break;
        case 'array': newVal = []; break;
      }
      if (newVal !== null) this.#emit(newVal);
    });
    wrapper.appendChild(select);
    return wrapper;
  }

  #renderBool(value) {
    const wrapper = document.createElement('label');
    wrapper.className = 'jec-bool';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = value;
    toggle.addEventListener('change', () => {
      this.#emit(toggle.checked);
    });
    wrapper.appendChild(toggle);
    const lbl = document.createElement('span');
    lbl.textContent = String(value);
    wrapper.appendChild(lbl);
    return wrapper;
  }

  #renderNumber(value) {
    const wrapper = document.createElement('span');
    wrapper.className = 'jec-number';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.style.cssText = 'background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);font-family:monospace;font-size:0.8em;width:80px;padding:1px 4px;';
    input.addEventListener('change', () => {
      this.#emit(parseFloat(input.value) || 0);
    });
    wrapper.appendChild(input);
    return wrapper;
  }

  #renderString(value) {
    const wrapper = document.createElement('span');
    wrapper.className = 'jec-string';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.style.cssText = 'background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);font-family:monospace;font-size:0.8em;width:140px;padding:1px 4px;';
    input.addEventListener('change', () => {
      this.#emit(input.value);
    });
    wrapper.appendChild(input);
    return wrapper;
  }

  #renderArray(arr) {
    const container = document.createElement('div');
    container.className = 'jec-array';

    const inferredType = JsonEditCard.#inferArrayTypes(arr);
    const typeLabel = inferredType === 'empty' ? 'empty' :
                      inferredType === 'mixed' ? 'mixed' :
                      inferredType.endsWith('?') ? `${inferredType.slice(0, -1)}|null` :
                      inferredType;

    const header = document.createElement('div');
    header.className = 'jec-header';
    header.innerHTML = `<span class="jec-type-tag">Array[${arr.length}]</span><span class="jec-type-tag jec-type-inner">&lt;${typeLabel}&gt;</span>`;
    container.appendChild(header);

    const items = document.createElement('div');
    items.className = 'jec-items';

    // When typed, coerce nulls to default value of that type (without emitting to avoid infinite loop)
    const isTypedArray = !['empty', 'mixed', 'null'].includes(inferredType);
    const baseType = isTypedArray ? inferredType.replace(/\?$/, '') : null;
    if (isTypedArray) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === null || arr[i] === undefined) {
          arr[i] = JsonEditCard.#defaultValueForType(baseType);
        }
      }
    }

    arr.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'jec-row';

      const idx = document.createElement('span');
      idx.className = 'jec-idx';
      idx.textContent = `${i}:`;
      row.appendChild(idx);

      const childDest = document.createElement('div');
      childDest.className = 'jec-child';

      const card = new JsonEditCard(item, childDest, {
        deletable: true,
        inTypedArray: isTypedArray,
        depth: this._options.depth + 1,
        onDelete: () => {
          arr.splice(i, 1);
          this.#emit(arr);
        }
      });
      card.on('change', () => {
        arr[i] = card.getValue();
        this.#emit(arr);
      });
      this.#children.push(card);

      row.appendChild(childDest);
      items.appendChild(row);
    });

    container.appendChild(items);

    // Add button — create element of the dominant type
    const addBtn = document.createElement('button');
    addBtn.className = 'jec-add-btn';
    addBtn.textContent = '+ add';
    addBtn.addEventListener('click', () => {
      const newVal = isTypedArray ? JsonEditCard.#defaultValueForType(baseType) : null;
      arr.push(newVal);
      this.#emit(arr);
    });
    container.appendChild(addBtn);

    return container;
  }

  /** Get default value for a given type name */
  static #defaultValueForType(type) {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      default: return null;
    }
  }

  #renderObject(obj) {
    const container = document.createElement('div');
    container.className = 'jec-object';

    const header = document.createElement('div');
    header.className = 'jec-header';
    header.innerHTML = `<span class="jec-type-tag">Object{${Object.keys(obj).length}}</span>`;
    container.appendChild(header);

    const keys = document.createElement('div');
    keys.className = 'jec-keys';

    for (const key of Object.keys(obj)) {
      const row = document.createElement('div');
      row.className = 'jec-row';

      const lbl = document.createElement('span');
      lbl.className = 'jec-key-name';
      lbl.textContent = key;
      row.appendChild(lbl);

      const childDest = document.createElement('div');
      childDest.className = 'jec-child';

      const card = new JsonEditCard(obj[key], childDest, { label: '', depth: this._options.depth + 1 });
      card.on('change', () => {
        obj[key] = card.getValue();
        this.#emit(obj);
      });
      this.#children.push(card);

      row.appendChild(childDest);
      keys.appendChild(row);
    }

    container.appendChild(keys);

    // Add key row: input + button
    const addRow = document.createElement('div');
    addRow.className = 'jec-add-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'key name';
    keyInput.className = 'jec-key-input';
    keyInput.style.cssText = 'flex:1;background:transparent;border:1px dashed rgba(255,255,255,0.2);border-radius:3px;padding:2px 6px;color:inherit;font-size:0.75em;font-family:monospace;';

    const addBtn = document.createElement('button');
    addBtn.className = 'jec-add-btn';
    addBtn.textContent = '+';

    const doAdd = () => {
      const name = keyInput.value.trim();
      if (!name) return;
      if (obj.hasOwnProperty(name)) return; // key already exists
      obj[name] = null;
      keyInput.value = '';
      this.#emit(obj);
    };

    addBtn.addEventListener('click', doAdd);
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAdd();
    });

    addRow.appendChild(keyInput);
    addRow.appendChild(addBtn);
    container.appendChild(addRow);

    return container;
  }

  /** Get the current value */
  getValue() {
    return this.#json;
  }

  /** Subscribe to changes */
  on(event, cb) {
    if (event === 'change') {
      this.#onChange.push(cb);
    }
  }

  /** Emit a change event */
  #emit(newValue) {
    this.#json = newValue;
    this.#build();
    for (const cb of this.#onChange) {
      cb(newValue);
    }
  }

  /** Destroy this card and clean up */
  destroy() {
    this.#children.forEach(c => c.destroy());
    this.#children = [];
    this.#root.remove();
  }
}
