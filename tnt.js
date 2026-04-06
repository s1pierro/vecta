/**
 * @fileoverview TNT.js — Touch & No-Touch, v0.8.5
 *
 * Module d'abstraction des interactions tactiles pour surfaces mobiles.
 * Surmonte l'occlusion du doigt via un curseur déporté à distance fixe.
 *
 * Exports : {@link TouchEngine}, {@link CursorKinematics}, {@link TouchOverlay}
 *
 * @module tnt
 * @version 0.8.5
 */
class TouchEngine {
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = {
      dist: 80,
      tappingToPressingFrontier: 500,
      pressingToLongPressingFrontier: 1500,
      ...opts,
    };

    this.handlers = {};
    this.touches = new Map();
    this.cursor = { x: 0, y: 0, active: false };
    this.state = 'idle';
    this.touchCount = 0;

    this.firstTouchId = null;
    this.grabId = null;
    this.gestureStartStamp = null;
    this._grabActivatedAt = null;
    this._maxDelta = 0;
    this._tapTimer = null;
    this._longPressTimer = null;
    this._bangTimer = null;
    this._bangPending = false;
    this._pinchInitDist = 0;
    this._lastPinchScale = 1;
    this._rect = null;
    this._pending2 = false;
    this._pending2InitDist = 0;
    this._pending2Center = null;
    this._lastCenter = null;

    this._bind();
  }

  get isGrabbing() { return this.state === 'grabbing'; }
  get dist() { return this.opts.dist; }
  set dist(v) { this.opts.dist = v; }
  get tappingToPressingFrontier() { return this.opts.tappingToPressingFrontier; }
  set tappingToPressingFrontier(v) { this.opts.tappingToPressingFrontier = v; }
  get pressingToLongPressingFrontier() { return this.opts.pressingToLongPressingFrontier; }
  set pressingToLongPressingFrontier(v) { this.opts.pressingToLongPressingFrontier = v; }

  on(type, fn) {
    (this.handlers[type] ||= []).push(fn);
  }

  emit(type, data) {
    console.debug(`[TNT] ${type}`, data);
    (this.handlers[type] || []).forEach(fn => fn(data));
  }

  _setState(next) {
    console.debug(`[TNT] ${this.state} → ${next}`);
    this.state = next;
    this.emit('stateChange', { state: next });
  }

  _clearTimers() {
    clearTimeout(this._tapTimer);
    clearTimeout(this._longPressTimer);
    clearTimeout(this._bangTimer);
    this._tapTimer = null;
    this._longPressTimer = null;
    this._bangTimer = null;
  }

  _toIdle() {
    this._clearTimers();
    this.state = 'idle';
    this.touchCount = 0;
    this.firstTouchId = null;
    this.grabId = null;
    this.gestureStartStamp = null;
    this._grabActivatedAt = null;
    this._maxDelta = 0;
    this._bangPending = false;
    this._pinchInitDist = 0;
    this._lastPinchScale = 1;
    this._pending2 = false;
    this._pending2InitDist = 0;
    this._pending2Center = null;
    this._lastCenter = null;
    this.cursor.active = false;
    this.touches.clear();
    this.emit('stateChange', { state: 'idle' });
  }

  _bind() {
    const opt = { passive: false };
    this._hTouchStart = e => this._start(e);
    this._hTouchMove = e => this._move(e);
    this._hTouchEnd = e => this._end(e);
    this.el.addEventListener('touchstart', this._hTouchStart, opt);
    this.el.addEventListener('touchmove', this._hTouchMove, opt);
    this.el.addEventListener('touchend', this._hTouchEnd, opt);
    this.el.addEventListener('touchcancel', this._hTouchEnd, opt);
  }

  destroy() {
    const opt = { passive: false };
    this.el.removeEventListener('touchstart', this._hTouchStart, opt);
    this.el.removeEventListener('touchmove', this._hTouchMove, opt);
    this.el.removeEventListener('touchend', this._hTouchEnd, opt);
    this.el.removeEventListener('touchcancel', this._hTouchEnd, opt);
    this._toIdle();
  }

  _pos(t) {
    const r = this._rect;
    return { x: t.clientX - (r ? r.left : 0), y: t.clientY - (r ? r.top : 0) };
  }

  _start(e) {
    this._rect = this.el.getBoundingClientRect();
    this.touchCount += e.changedTouches.length;

    for (const t of e.changedTouches) {
      const pos = this._pos(t);
      this.touches.set(t.identifier, { start: { ...pos }, prev: { ...pos } });
    }

    if (this.touchCount >= 5) {
      if (this.cursor.active) {
        this.emit('cancelCursor', { x: this.cursor.x, y: this.cursor.y, state: 'idle' });
      }
      this._clearTimers();
      this.state = 'idle';
      this.firstTouchId = null;
      this.grabId = null;
      this.gestureStartStamp = null;
      this._grabActivatedAt = null;
      this._maxDelta = 0;
      this._pinchInitDist = 0;
      this._lastPinchScale = 1;
      this._pending2 = false;
      this._pending2InitDist = 0;
      this._pending2Center = null;
      this._lastCenter = null;
      this.cursor.active = false;
      this.emit('stateChange', { state: 'idle' });

      if (!this._bangPending) {
        this._bangPending = true;
        this._bangTimer = setTimeout(() => {
          this._bangPending = false;
          const pts = [...this.touches.values()];
          const x = pts.length ? pts.reduce((s, t) => s + t.prev.x, 0) / pts.length : 0;
          const y = pts.length ? pts.reduce((s, t) => s + t.prev.y, 0) / pts.length : 0;
          this.emit('tntBang', { x, y });
          this._toIdle();
        }, this.opts.pressingToLongPressingFrontier);
      }
      return;
    }

    if (this.state === 'idle' && this.touchCount === 1) {
      const t0 = e.changedTouches[0];
      const pos0 = this._pos(t0);
      this.firstTouchId = t0.identifier;
      this.gestureStartStamp = e.timeStamp;
      this.cursor.x = pos0.x;
      this.cursor.y = pos0.y;
      this.cursor.active = true;
      this._setState('tapping');

      this._tapTimer = setTimeout(() => {
        if (this.state !== 'tapping') return;
        this._setState('pressing');

        const remaining = this.opts.pressingToLongPressingFrontier - this.opts.tappingToPressingFrontier;
        this._longPressTimer = setTimeout(() => {
          if (this.state !== 'pressing') return;
          this._setState('longPressing');
        }, Math.max(0, remaining));
      }, this.opts.tappingToPressingFrontier);

      return;
    }

    if (this.touchCount === 2 && this.state === 'tapping') {
      this._clearTimers();
      const [a, b] = [...this.touches.values()];
      this._pending2 = true;
      this._pending2InitDist = Math.hypot(b.prev.x - a.prev.x, b.prev.y - a.prev.y);
      this._pending2Center = { x: (a.prev.x + b.prev.x) / 2, y: (a.prev.y + b.prev.y) / 2 };
    }
  }

  _move(e) {
    if (this._bangPending || this.state === 'idle') return;

    if (this.touchCount >= 5) {
      for (const t of e.changedTouches) {
        const data = this.touches.get(t.identifier);
        if (data) data.prev = this._pos(t);
      }
      return;
    }

    for (const t of e.changedTouches) {
      const data = this.touches.get(t.identifier);
      if (!data) continue;

      const pos = this._pos(t);
      const dx = pos.x - data.prev.x;
      const dy = pos.y - data.prev.y;
      data.prev = pos;

      const dist = Math.hypot(pos.x - data.start.x, pos.y - data.start.y);
      if (dist > this._maxDelta) this._maxDelta = dist;

      if ((this.state === 'pressing' || this.state === 'longPressing') && t.identifier === this.firstTouchId) {
        if (dist >= this.opts.dist) {
          const px = pos.x, py = pos.y;
          this._toIdle();
          this.emit('cancel', { x: px, y: py, state: 'idle' });
          return;
        }
      }

      if (this.state === 'grabbing' && t.identifier === this.grabId) {
        const cdx = this.cursor.x - pos.x;
        const cdy = this.cursor.y - pos.y;
        const cd = Math.hypot(cdx, cdy) || 0.0001;
        this.cursor.x = pos.x + (cdx / cd) * this.opts.dist;
        this.cursor.y = pos.y + (cdy / cd) * this.opts.dist;
        this.emit('cursorMove', {
          x: this.cursor.x, y: this.cursor.y,
          touchX: pos.x, touchY: pos.y,
          state: 'grabbing',
        });
        continue;
      }

      if (this.state === 'tapping' && !this._pending2 && t.identifier === this.firstTouchId) {
        if (Math.hypot(pos.x - data.start.x, pos.y - data.start.y) >= this.opts.dist) {
          this._clearTimers();
          const cdx = data.start.x - pos.x;
          const cdy = data.start.y - pos.y;
          const cd = Math.hypot(cdx, cdy) || 0.0001;
          this.cursor.x = pos.x + (cdx / cd) * this.opts.dist;
          this.cursor.y = pos.y + (cdy / cd) * this.opts.dist;
          this._grabActivatedAt = { x: this.cursor.x, y: this.cursor.y };
          this.grabId = t.identifier;
          this._setState('grabbing');
          this.emit('cursorActivate', {
            x: this.cursor.x, y: this.cursor.y,
            touchX: pos.x, touchY: pos.y,
            state: 'grabbing',
          });
        }
      }
    }

    if (this._pending2 && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      const curDist = Math.hypot(b.prev.x - a.prev.x, b.prev.y - a.prev.y);
      const center = { x: (a.prev.x + b.prev.x) / 2, y: (a.prev.y + b.prev.y) / 2 };
      const deltaDist = Math.abs(curDist - this._pending2InitDist);
      const centerMov = Math.hypot(center.x - this._pending2Center.x, center.y - this._pending2Center.y);
      const threshold = this.opts.dist / 4;

      if (deltaDist >= threshold) {
        this._pending2 = false;
        this._pinchInitDist = curDist;
        this._lastPinchScale = 1;
        this._lastCenter = { x: center.x, y: center.y };
        this._setState('pinching');
        this.emit('pinchStart', { scale: 1, state: 'pinching',
          x1: a.prev.x, y1: a.prev.y, x2: b.prev.x, y2: b.prev.y });
      } else if (centerMov >= threshold) {
        this._pending2 = false;
        this._lastCenter = { x: center.x, y: center.y };
        this._setState('catching');
        this.emit('catchAt', { x: center.x, y: center.y, state: 'catching',
          x1: a.prev.x, y1: a.prev.y, x2: b.prev.x, y2: b.prev.y });
      }
    }

    if (this.state === 'pinching' && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      const curDist = Math.hypot(b.prev.x - a.prev.x, b.prev.y - a.prev.y);
      const scale = this._pinchInitDist > 0 ? curDist / this._pinchInitDist : 1;
      this._lastPinchScale = scale;
      this._lastCenter = { x: (a.prev.x + b.prev.x) / 2, y: (a.prev.y + b.prev.y) / 2 };
      this.emit('pinchChange', { scale, state: 'pinching',
        x1: a.prev.x, y1: a.prev.y, x2: b.prev.x, y2: b.prev.y });
    }

    if (this.state === 'catching' && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this._lastCenter = { x: (a.prev.x + b.prev.x) / 2, y: (a.prev.y + b.prev.y) / 2 };
      this.emit('catchMove', {
        x: this._lastCenter.x, y: this._lastCenter.y,
        x1: a.prev.x, y1: a.prev.y, x2: b.prev.x, y2: b.prev.y,
        state: 'catching',
      });
    }
  }

  _end(e) {
    this.touchCount = Math.max(0, this.touchCount - e.changedTouches.length);

    if (this._bangPending) {
      this._clearTimers();
      this._bangPending = false;
      for (const t of e.changedTouches) this.touches.delete(t.identifier);
      this._toIdle();
      return;
    }

    for (const t of e.changedTouches) {
      const data = this.touches.get(t.identifier);
      if (!data) continue;

      if (this.state === 'grabbing' && t.identifier === this.grabId) {
        const activated = { ...this._grabActivatedAt };
        const payload = {
          x: this.cursor.x, y: this.cursor.y,
          activatedAt: activated,
          vector: { x: this.cursor.x - activated.x, y: this.cursor.y - activated.y },
          state: 'idle',
        };
        this.touches.delete(t.identifier);
        this._toIdle();
        this.emit('cursorRelease', payload);
        return;
      }

      this.touches.delete(t.identifier);
    }

    if (this.state === 'pinching') {
      const scale = this._lastPinchScale;
      const duration = this.gestureStartStamp ? performance.now() - this.gestureStartStamp : 0;
      const { x, y } = this._lastCenter ?? { x: 0, y: 0 };
      this._toIdle();
      this.emit('pinchEnd', { x, y, scale, duration, state: 'idle' });
      return;
    }

    if (this.state === 'catching') {
      const { x, y } = this._lastCenter ?? { x: 0, y: 0 };
      this._toIdle();
      this.emit('catchDrop', { x, y, state: 'idle' });
      return;
    }

    if (this._pending2) {
      this._toIdle();
      return;
    }

    if (this.touchCount === 0 && this.gestureStartStamp !== null) {
      const dt = e.timeStamp - this.gestureStartStamp;
      const finalState = this.state;
      const t0 = e.changedTouches[0];
      const { x, y } = this._pos(t0);
      const precision = this._maxDelta;

      const isSingleTouch = finalState === 'tapping'
        || finalState === 'pressing'
        || finalState === 'longPressing';
      this._toIdle();

      if (!isSingleTouch) return;

      const b1 = this.opts.tappingToPressingFrontier;
      const b2 = this.opts.pressingToLongPressingFrontier;
      if (dt < b1) {
        this.emit('tap', { x, y, intensity: dt / b1, precision });
      } else if (dt < b2) {
        this.emit('press', { x, y, intensity: (dt - b1) / (b2 - b1), precision });
      } else {
        this.emit('longPress', { x, y, msAfterMin: dt - b2, precision });
      }
    }
  }
}

class CursorKinematics {
  constructor(opts = {}) {
    this.x = 0;
    this.y = 0;
    this.dist = opts.dist ?? 80;
    this.initialized = false;
  }

  init(px, py) {
    this.x = px + this.dist;
    this.y = py;
    this.initialized = true;
  }

  activate(cursorX, cursorY, touchX, touchY) {
    const dx = cursorX - touchX;
    const dy = cursorY - touchY;
    const d = Math.hypot(dx, dy) || 0.0001;
    this.x = touchX + (dx / d) * this.dist;
    this.y = touchY + (dy / d) * this.dist;
    this.initialized = true;
  }

  reset() {
    this.initialized = false;
  }

  update(px, py) {
    if (!this.initialized) { this.init(px, py); return; }

    const dx = this.x - px;
    const dy = this.y - py;
    const d = Math.hypot(dx, dy) || 0.0001;
    this.x = px + (dx / d) * this.dist;
    this.y = py + (dy / d) * this.dist;
  }
}

class TouchOverlay {
  constructor(container, opts = {}) {
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.contactSize = opts.contactSize ?? 24;
    this.cursorSize = opts.cursorSize ?? 14;
    this.rodEnabled = opts.rodEnabled ?? true;
    this.pulseEnabled = opts.pulseEnabled ?? true;

    this._engine = new TouchEngine(container, {
      dist: opts.dist ?? 80,
      tappingToPressingFrontier: opts.tappingToPressingFrontier ?? 500,
      pressingToLongPressingFrontier: opts.pressingToLongPressingFrontier ?? 1500,
    });

    this._kine = new CursorKinematics({
      dist: opts.dist ?? 80,
    });

    this._el = container;
    this._contactEl = null;
    this._cursorEl = null;
    this._rodEl = null;
    this._dot1El = null;
    this._dot2El = null;
    this._multiLineEl = null;
    this._dotCenterEl = null;

    this._buildDOM();
    this._bindEvents();
  }

  get engine() { return this._engine; }
  get kine() { return this._kine; }
  get el() { return this._el; }

  set contactSize(v) {
    this._contactSize = v;
    if (this._contactEl) {
      this._contactEl.style.width = v + 'px';
      this._contactEl.style.height = v + 'px';
    }
  }
  get contactSize() { return this._contactSize; }

  set cursorSize(v) {
    this._cursorSize = v;
    if (this._cursorEl) {
      this._cursorEl.style.width = v + 'px';
      this._cursorEl.style.height = v + 'px';
    }
  }
  get cursorSize() { return this._cursorSize; }

  set rodEnabled(v) {
    this._rodEnabled = v;
    if (this._rodEl) this._rodEl.style.opacity = v ? '1' : '0';
  }
  get rodEnabled() { return this._rodEnabled; }

  set pulseEnabled(v) { this._pulseEnabled = v; }
  get pulseEnabled() { return this._pulseEnabled; }

  _buildDOM() {
    this._contactEl = document.createElement('div');
    this._contactEl.style.cssText = [
      'position:absolute', 'border-radius:50%', 'background:#f00',
      'transform:translate(-50%,-50%)', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.1s',
      `width:${this._contactSize}px`, `height:${this._contactSize}px`,
    ].join(';');
    this._el.appendChild(this._contactEl);

    this._cursorEl = document.createElement('div');
    this._cursorEl.style.cssText = [
      'position:absolute', 'border-radius:50%', 'background:#0f0',
      'transform:translate(-50%,-50%)', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.1s',
      `width:${this._cursorSize}px`, `height:${this._cursorSize}px`,
    ].join(';');
    this._el.appendChild(this._cursorEl);

    this._rodEl = document.createElement('div');
    this._rodEl.style.cssText = [
      'position:absolute', 'height:2px', 'background:#888',
      'transform-origin:left center', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.1s',
    ].join(';');
    this._el.appendChild(this._rodEl);

    const dotBase = [
      'position:absolute', 'border-radius:50%',
      'transform:translate(-50%,-50%)', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.1s',
      `width:${this._contactSize}px`, `height:${this._contactSize}px`,
    ].join(';');

    this._dot1El = document.createElement('div');
    this._dot1El.style.cssText = dotBase;
    this._el.appendChild(this._dot1El);

    this._dot2El = document.createElement('div');
    this._dot2El.style.cssText = dotBase;
    this._el.appendChild(this._dot2El);

    this._multiLineEl = document.createElement('div');
    this._multiLineEl.style.cssText = [
      'position:absolute', 'height:2px',
      'transform-origin:left center', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.1s',
    ].join(';');
    this._el.appendChild(this._multiLineEl);

    const cSize = Math.round(this._contactSize * 0.6);
    this._dotCenterEl = document.createElement('div');
    this._dotCenterEl.style.cssText = [
      'position:absolute', 'border-radius:50%', 'background:transparent',
      'border:2px solid', 'transform:translate(-50%,-50%)', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.1s',
      `width:${cSize}px`, `height:${cSize}px`,
    ].join(';');
    this._el.appendChild(this._dotCenterEl);

    const style = document.createElement('style');
    style.textContent = `
@keyframes tnt-pulse {
  from { opacity:0.8; transform:translate(-50%,-50%) scale(1); }
  to   { opacity:0;   transform:translate(-50%,-50%) scale(2.8); }
}
@keyframes tnt-disc {
  from { opacity:0.65; transform:translate(-50%,-50%) scale(0.8); }
  to   { opacity:0;    transform:translate(-50%,-50%) scale(2.8); }
}
@keyframes tnt-ring-shrink {
  from { opacity:0.7; transform:translate(-50%,-50%) scale(2.4); }
  to   { opacity:0;   transform:translate(-50%,-50%) scale(0.4); }
}
@keyframes tnt-burst-dot {
  from { opacity:0.9; transform:translate(-50%,-50%); }
  to   { opacity:0;   transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); }
}
@keyframes tnt-burst-in {
  from { opacity:0.9; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); }
  to   { opacity:0;   transform:translate(-50%,-50%); }
}`;
    document.head.appendChild(style);
  }

  _show() {
    this._contactEl.style.opacity = '1';
    this._cursorEl.style.opacity = '1';
    if (this._rodEnabled) this._rodEl.style.opacity = '1';
  }

  _hide() {
    this._contactEl.style.opacity = '0';
    this._cursorEl.style.opacity = '0';
    this._rodEl.style.opacity = '0';
    this._kine.reset();
  }

  _render(tx, ty) {
    this._contactEl.style.left = tx + 'px';
    this._contactEl.style.top = ty + 'px';
    this._cursorEl.style.left = this._kine.x + 'px';
    this._cursorEl.style.top = this._kine.y + 'px';

    if (this._rodEnabled) {
      const dx = this._kine.x - tx;
      const dy = this._kine.y - ty;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      this._rodEl.style.left = tx + 'px';
      this._rodEl.style.top = ty + 'px';
      this._rodEl.style.width = len + 'px';
      this._rodEl.style.transform = `rotate(${angle}rad)`;
    }
  }

  _showMulti(color) {
    this._dot1El.style.background = color;
    this._dot2El.style.background = color;
    this._multiLineEl.style.background = color;
    this._dotCenterEl.style.borderColor = color;
    this._dot1El.style.opacity = '1';
    this._dot2El.style.opacity = '1';
    this._multiLineEl.style.opacity = '1';
    this._dotCenterEl.style.opacity = '1';
  }

  _hideMulti() {
    this._dot1El.style.opacity = '0';
    this._dot2El.style.opacity = '0';
    this._multiLineEl.style.opacity = '0';
    this._dotCenterEl.style.opacity = '0';
  }

  _renderMulti(x1, y1, x2, y2) {
    this._dot1El.style.left = x1 + 'px';
    this._dot1El.style.top = y1 + 'px';
    this._dot2El.style.left = x2 + 'px';
    this._dot2El.style.top = y2 + 'px';
    this._dotCenterEl.style.left = ((x1 + x2) / 2) + 'px';
    this._dotCenterEl.style.top = ((y1 + y2) / 2) + 'px';
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    this._multiLineEl.style.left = x1 + 'px';
    this._multiLineEl.style.top = y1 + 'px';
    this._multiLineEl.style.width = len + 'px';
    this._multiLineEl.style.transform = `rotate(${angle}rad)`;
  }

  _anim(type, x, y, color, { size = this._cursorSize * 3, duration = '0.45s', delay = '0s' } = {}) {
    if (!this._pulseEnabled) return;

    if (type === 'burst' || type === 'burst-in') {
      const N = 8, r = size * 2.1;
      const kf = type === 'burst-in' ? 'tnt-burst-in' : 'tnt-burst-dot';
      const ease = type === 'burst-in' ? 'ease-in' : 'ease-out';
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const dot = document.createElement('div');
        dot.style.cssText = [
          'position:absolute', 'border-radius:50%', 'pointer-events:none',
          `background:${color}`, 'width:20px', 'height:20px',
          `left:${x}px`, `top:${y}px`,
          `--dx:${(Math.cos(angle) * r).toFixed(1)}px`,
          `--dy:${(Math.sin(angle) * r).toFixed(1)}px`,
          `animation:${kf} ${duration} ${ease} ${delay} forwards`,
        ].join(';');
        this._el.appendChild(dot);
        dot.addEventListener('animationend', () => dot.remove(), { once: true });
      }
      return;
    }

    const kf = type === 'disc' ? 'tnt-disc'
      : type === 'ring-shrink' ? 'tnt-ring-shrink'
      : 'tnt-pulse';
    const el = document.createElement('div');
    const isFilled = type === 'disc';
    el.style.cssText = [
      'position:absolute', 'border-radius:50%', 'pointer-events:none',
      'transform:translate(-50%,-50%)',
      `left:${x}px`, `top:${y}px`,
      `width:${size}px`, `height:${size}px`,
      isFilled ? `background:${color}; opacity:0` : `border:2px solid ${color}; opacity:0`,
      `animation:${kf} ${duration} ease-out ${delay} forwards`,
    ].join(';');
    this._el.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  _bindEvents() {
    this._engine.on('tap', e => {
      this._anim('ring', e.x, e.y, '#0ff', { size: this._cursorSize * 2.5, duration: '0.3s' });
    });

    this._engine.on('press', e => {
      this._anim('ring', e.x, e.y, '#ff0', { duration: '0.5s' });
      this._anim('ring', e.x, e.y, '#ff0', { duration: '0.5s', delay: '0.12s' });
    });

    this._engine.on('longPress', e => {
      this._anim('ring', e.x, e.y, '#f0f', { duration: '0.55s' });
      this._anim('ring', e.x, e.y, '#f0f', { duration: '0.55s', delay: '0.1s' });
      this._anim('ring', e.x, e.y, '#f0f', { duration: '0.55s', delay: '0.2s' });
    });

    this._engine.on('cursorActivate', e => {
      this._kine.activate(e.x, e.y, e.touchX, e.touchY);
      this._show();
      this._render(e.touchX, e.touchY);
      this._anim('ring', e.x, e.y, '#0f8', { duration: '0.5s' });
    });

    this._engine.on('cursorMove', e => {
      this._kine.update(e.touchX, e.touchY);
      this._render(e.touchX, e.touchY);
    });

    this._engine.on('cursorRelease', e => {
      this._hide();
      this._anim('ring-shrink', e.x, e.y, '#8fc', { duration: '0.35s' });
    });

    this._engine.on('cancelCursor', e => {
      this._hide();
      this._anim('ring-shrink', e.x, e.y, '#f88', { duration: '0.3s' });
    });

    this._engine.on('pinchStart', e => {
      this._showMulti('#f80');
      this._renderMulti(e.x1, e.y1, e.x2, e.y2);
      const cx = (e.x1 + e.x2) / 2, cy = (e.y1 + e.y2) / 2;
      this._anim('disc', cx, cy, '#f80', { duration: '0.4s' });
    });
    this._engine.on('pinchChange', e => this._renderMulti(e.x1, e.y1, e.x2, e.y2));
    this._engine.on('pinchEnd', e => {
      this._hideMulti();
      this._anim('disc', e.x, e.y, '#fc8', { size: this._cursorSize * 2, duration: '0.35s' });
    });

    this._engine.on('tntBang', e => {
      const S = this._cursorSize;
      this._anim('ring', e.x, e.y, '#0ff', { size: S * 2.5, duration: '0.5s' });
      this._anim('ring', e.x, e.y, '#ff0', { size: S * 3, duration: '0.55s', delay: '0.04s' });
      this._anim('ring', e.x, e.y, '#f0f', { size: S * 3.5, duration: '0.6s', delay: '0.08s' });
      this._anim('ring', e.x, e.y, '#0f8', { size: S * 4, duration: '0.65s', delay: '0.12s' });
      this._anim('ring-shrink', e.x, e.y, '#8fc', { size: S * 4, duration: '0.5s', delay: '0.05s' });
      this._anim('ring-shrink', e.x, e.y, '#f88', { size: S * 3.5, duration: '0.45s', delay: '0.1s' });
      this._anim('disc', e.x, e.y, '#f80', { size: S * 4, duration: '0.55s', delay: '0.06s' });
      this._anim('disc', e.x, e.y, '#fc8', { size: S * 3, duration: '0.5s', delay: '0.12s' });
      this._anim('burst', e.x, e.y, '#7cf', { size: S * 4, duration: '0.6s', delay: '0.03s' });
      this._anim('burst-in', e.x, e.y, '#08f', { size: S * 4.5, duration: '0.65s', delay: '0.07s' });
    });

    this._engine.on('catchAt', e => {
      this._showMulti('#08f');
      this._renderMulti(e.x1, e.y1, e.x2, e.y2);
      const cx = (e.x1 + e.x2) / 2, cy = (e.y1 + e.y2) / 2;
      this._anim('burst-in', cx, cy, '#08f', { size: this._cursorSize * 3, duration: '0.5s' });
    });
    this._engine.on('catchMove', e => this._renderMulti(e.x1, e.y1, e.x2, e.y2));
    this._engine.on('catchDrop', e => {
      this._hideMulti();
      this._anim('burst', e.x, e.y, '#7cf', { size: this._cursorSize * 2.5, duration: '0.45s' });
    });
  }
}

class DropCursor {
  constructor(container, opts = {}) {
    this._id = ++_dcCount;
    this._con = container;
    this._x = opts.x ?? 150;
    this._y = opts.y ?? 200;
    this._ang = opts.angle ?? 0;
    this._R = opts.size ?? 52;
    this._H = opts.height ?? 115;
    this._pad = 16;

    this._el = null;
    this._svg = null;
    this._baseDisc = null;
    this._orientDisc = null;

    this._mode = null;
    this._tid = null;
    this._sx = 0;
    this._sy = 0;
    this._ox = 0;
    this._oy = 0;
    this._isDrag = false;
    this._interactive = true;

    this._handlers = {};
    this._onMove = null;
    this._onEnd = null;

    if (opts.enabled) this._mount();
  }

  get enabled() { return !!this._el; }
  set enabled(v) { !!v === this.enabled ? null : v ? this._mount() : this._unmount(); }

  get angle() { return this._ang; }
  set angle(v) { this._ang = v; this._el && this._render(); }

  get interactive() { return this._interactive; }
  set interactive(v) {
    this._interactive = !!v;
    if (!this._interactive && this._mode) {
      this._mode = null;
      this._tid = null;
      this._isDrag = false;
    }
  }

  get size() { return this._R; }
  set size(v) { this._R = v; this._el && this._render(); }

  get height() { return this._H; }
  set height(v) { this._H = v; this._el && this._render(); }

  get x() { return this._x; }
  get y() { return this._y; }

  on(type, fn) { (this._handlers[type] ??= []).push(fn); return this; }

  emit(type, data) { (this._handlers[type] ?? []).forEach(fn => fn(data)); }

  _mount() {
    if (getComputedStyle(this._con).position === 'static')
      this._con.style.position = 'relative';

    this._el = document.createElement('div');
    this._el.style.cssText = 'position:absolute;z-index:9998;pointer-events:none;';

    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.style.cssText = 'display:block;overflow:visible;pointer-events:none;';
    this._el.appendChild(this._svg);

    this._baseDisc = document.createElement('div');
    this._baseDisc.style.cssText =
      'position:absolute;border-radius:50%;touch-action:none;pointer-events:auto;box-sizing:border-box;';
    this._el.appendChild(this._baseDisc);

    this._orientDisc = document.createElement('div');
    this._orientDisc.style.cssText =
      'position:absolute;border-radius:50%;touch-action:none;pointer-events:auto;box-sizing:border-box;';
    this._el.appendChild(this._orientDisc);

    this._con.appendChild(this._el);
    this._render();
    this._bindTouch();
  }

  _unmount() {
    if (!this._el) return;
    document.removeEventListener('touchmove', this._onMove);
    document.removeEventListener('touchend', this._onEnd);
    document.removeEventListener('touchcancel', this._onEnd);
    this._el.remove();
    this._el = this._svg = this._baseDisc = this._orientDisc = null;
  }

  _render() {
    const R = this._R, H = this._H, p = this._pad;
    const W = 2 * (R + p);
    const Ht = H + R + 2 * p;
    const cx = R + p;
    const cy = H + p;
    const tx = cx, ty = p;

    const d = [
      `M ${tx} ${ty}`,
      `C ${cx + R * 0.38} ${ty + H * 0.42}  ${cx + R} ${cy - R * 0.58}  ${cx + R} ${cy}`,
      `A ${R} ${R} 0 0 1 ${cx - R} ${cy}`,
      `C ${cx - R} ${cy - R * 0.58}  ${cx - R * 0.38} ${ty + H * 0.42}  ${tx} ${ty} Z`,
    ].join(' ');

    this._svg.setAttribute('width', W);
    this._svg.setAttribute('height', Ht);
    this._svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
    this._svg.style.filter = 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))';
    this._svg.innerHTML = `<path d="${d}"
      fill="none"
      stroke="rgba(255,255,255,0.75)"
      stroke-width="2"
      stroke-linejoin="round"/>`;

    const bd = this._baseDisc.style;
    bd.width = bd.height = `${R * 2}px`;
    bd.left = `${cx - R}px`;
    bd.top = `${cy - R}px`;
    bd.background = 'rgba(255,255,255,0.13)';
    bd.border = '1.5px solid rgba(255,255,255,0.40)';

    const or = 12;
    const od = this._orientDisc.style;
    od.width = od.height = `${or * 2}px`;
    od.left = `${tx - or}px`;
    od.top = `${ty - or}px`;
    od.background = 'rgba(255,255,255,0.10)';
    od.border = '2px solid rgba(255,255,255,0.88)';

    this._el.style.left = `${this._x - cx}px`;
    this._el.style.top = `${this._y - cy}px`;
    this._el.style.width = `${W}px`;
    this._el.style.height = `${Ht}px`;
    this._el.style.transformOrigin = `${cx}px ${cy}px`;
    this._el.style.transform = `rotate(${this._ang}deg)`;
  }

  _bindTouch() {
    const startHandler = (mode) => (e) => {
      if (!this._interactive) return;
      e.stopPropagation();
      e.preventDefault();
      if (this._mode) return;

      const t = e.changedTouches[0];
      const rect = this._con.getBoundingClientRect();
      this._mode = mode;
      this._tid = t.identifier;
      this._sx = t.clientX - rect.left;
      this._sy = t.clientY - rect.top;
      this._ox = this._x;
      this._oy = this._y;
      this._isDrag = false;
    };

    this._baseDisc.addEventListener('touchstart', startHandler('move'), { passive: false });
    this._orientDisc.addEventListener('touchstart', startHandler('orient'), { passive: false });

    this._onMove = e => {
      if (!this._mode) return;
      e.preventDefault();
      const t = Array.from(e.changedTouches).find(t => t.identifier === this._tid);
      if (!t) return;

      const rect = this._con.getBoundingClientRect();
      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;

      if (this._mode === 'move') {
        if (!this._isDrag && Math.hypot(tx - this._sx, ty - this._sy) > 8)
          this._isDrag = true;
        if (this._isDrag) {
          this._x = this._ox + (tx - this._sx);
          this._y = this._oy + (ty - this._sy);
          this._render();
        }
      } else {
        this._ang = Math.atan2(tx - this._x, -(ty - this._y)) * 180 / Math.PI;
        this._isDrag = true;
        this._render();
      }
    };

    this._onEnd = e => {
      if (!Array.from(e.changedTouches).some(t => t.identifier === this._tid)) return;
      const endedMode = this._mode;
      const endedDrag = this._isDrag;
      this._mode = null;
      this._tid = null;
      this._isDrag = false;

      if (endedMode === 'move') {
        if (endedDrag) {
          this.emit('move', { x: this._x, y: this._y });
        } else {
          const { x: tx, y: ty } = this._tipPos();
          this._clickEffect(tx, ty);
          this.emit('click', { x: tx, y: ty });
        }
      } else if (endedMode === 'orient') {
        this.emit('orient', { angle: this._ang });
      }
    };

    document.addEventListener('touchmove', this._onMove, { passive: false });
    document.addEventListener('touchend', this._onEnd);
    document.addEventListener('touchcancel', this._onEnd);
  }

  _tipPos() {
    const rad = this._ang * Math.PI / 180;
    return {
      x: this._x + this._H * Math.sin(rad),
      y: this._y - this._H * Math.cos(rad),
    };
  }

  _clickEffect(tx, ty) {
    const s = 26;
    const div = document.createElement('div');
    div.style.cssText =
      `position:absolute;width:${s}px;height:${s}px;` +
      `left:${tx - s / 2}px;top:${ty - s / 2}px;` +
      `border:2px solid rgba(255,255,255,0.92);box-sizing:border-box;` +
      `pointer-events:none;z-index:9999;` +
      `transform:scale(0.35);opacity:1;` +
      `transition:transform 380ms ease-out,opacity 380ms ease-out;`;
    this._el.appendChild(div);
    requestAnimationFrame(() => {
      div.style.transform = 'scale(1)';
      div.style.opacity = '0';
    });
    div.addEventListener('transitionend', () => div.remove(), { once: true });
  }
}

let _dcCount = 0;