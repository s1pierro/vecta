const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const w = canvasContainer.clientWidth;
  const h = canvasContainer.clientHeight;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const overlay = new TouchOverlay(document.getElementById('canvasContainer'), {
  dist: 0,
  contactSize: 24,
  cursorSize: 14,
  rodEnabled: true,
  pulseEnabled: true
});

class TouchPanel {
  constructor(overlay) {
    this.overlay = overlay;
    this.el = document.getElementById('panel');
    this._visible = true;
    
    this._bindEvents();
  }

  _bindEvents() {
    this.overlay.engine.on('tntBang', () => this.toggle());
  }

  isVisible() {
    return this._visible;
  }

  toggle() {
    this._visible = !this._visible;
    this.el.classList.toggle('hidden', !this._visible);
    canvasContainer.style.left = this._visible ? '60px' : '0';
  }

  show() {
    this._visible = true;
    this.el.classList.remove('hidden');
    canvasContainer.style.left = '60px';
  }

  hide() {
    this._visible = false;
    this.el.classList.add('hidden');
    canvasContainer.style.left = '0';
  }
}

const panel = new TouchPanel(overlay);

let paths = [];
let currentPath = null;
let currentTool = 'draw';
let currentColor = '#ffffff';
let currentSize = 8;

function draw() {
  ctx.clearRect(0, 0, canvasContainer.clientWidth, canvasContainer.clientHeight);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  paths.forEach(path => {
    if (path.points.length < 2) return;
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.size;
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
  });

  if (currentPath && currentPath.length >= 2) {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.beginPath();
    ctx.moveTo(currentPath[0].x, currentPath[0].y);
    for (let i = 1; i < currentPath.length; i++) {
      ctx.lineTo(currentPath[i].x, currentPath[i].y);
    }
    ctx.stroke();
  }
}

document.querySelectorAll('.panel-tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.panel-tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    console.log('Tool:', currentTool);
  });
});

document.querySelectorAll('.panel-color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.panel-color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    draw();
    console.log('Color:', currentColor);
  });
});

document.querySelectorAll('.panel-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.panel-size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSize = parseInt(btn.dataset.size);
    draw();
    console.log('Size:', currentSize);
  });
});

document.getElementById('togglePanelBtn').addEventListener('click', () => {
  panel.toggle();
});

const fullscreenBtn = document.getElementById('fullscreenBtn');
const expandIcon = fullscreenBtn.querySelector('.expand-icon');
const compressIcon = fullscreenBtn.querySelector('.compress-icon');

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    expandIcon.style.display = 'none';
    compressIcon.style.display = 'block';
  } else {
    expandIcon.style.display = 'block';
    compressIcon.style.display = 'none';
  }
});

overlay.engine.on('tap', e => {
  console.log('Tap:', e.x, e.y);
});

overlay.engine.on('cursorActivate', e => {
  currentPath = [{ x: e.touchX, y: e.touchY }];
  draw();
});

overlay.engine.on('cursorMove', e => {
  if (currentPath) {
    currentPath.push({ x: e.touchX, y: e.touchY });
    draw();
  }
});

overlay.engine.on('cursorRelease', e => {
  if (currentPath && currentPath.length > 1) {
    paths.push({
      points: currentPath,
      color: currentColor,
      size: currentSize
    });
  }
  currentPath = null;
  draw();
});

console.log('Vecta initialized with TNT.js');
console.log('TouchOverlay:', overlay);
console.log('TouchEngine:', overlay.engine);
