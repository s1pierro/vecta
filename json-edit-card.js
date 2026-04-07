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
   */
  constructor(json, domDest, options = {}) {
    this.#json = json;
    this.#domDest = domDest;
    this._options = {
      showType: options.showType !== false,
      deletable: options.deletable === true,
      label: options.label || '',
      onDelete: options.onDelete || null
    };
    this.#build();
  }

  /** Build the DOM structure */
  #build() {
    this.#domDest.innerHTML = '';
    this.#children = [];
    this.#root = document.createElement('div');
    this.#root.className = 'json-edit-card';

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
    // Fallback
    const span = document.createElement('span');
    span.textContent = String(value);
    return span;
  }

  #renderNull() {
    const el = document.createElement('span');
    el.className = 'jec-null';
    el.textContent = 'null';
    el.addEventListener('click', () => {
      this.#emit(null);
    });
    el.style.cursor = 'pointer';
    return el;
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
    // Update label on change
    toggle.addEventListener('change', () => {
      lbl.textContent = String(toggle.checked);
    });
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

    const header = document.createElement('div');
    header.className = 'jec-header';
    header.innerHTML = `<span class="jec-type-tag">Array[${arr.length}]</span>`;
    container.appendChild(header);

    const items = document.createElement('div');
    items.className = 'jec-items';

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

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'jec-add-btn';
    addBtn.textContent = '+ add';
    addBtn.addEventListener('click', () => {
      arr.push(null);
      this.#emit(arr);
    });
    container.appendChild(addBtn);

    return container;
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

      const card = new JsonEditCard(obj[key], childDest, { label: '' });
      card.on('change', () => {
        obj[key] = card.getValue();
        this.#emit(obj);
      });
      this.#children.push(card);

      row.appendChild(childDest);
      keys.appendChild(row);
    }

    container.appendChild(keys);
    return container;
  }

  /** Get the current value */
  getValue() {
    // For arrays/objects, collect from children
    const root = this.#root;
    // Re-read from source
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
    // Rebuild to reflect changes
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
