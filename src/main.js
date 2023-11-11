import './style.css'

function fitCanvas(canvas) {
  const parent = canvas.parentElement
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = parent.clientWidth
  const h = parent.clientHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h, dpr }
}


function mountShell() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <header class="bar">
      <h1>Mercury</h1>
      <div class="meta"><div>Integrity: <strong id="stat-hp">0</strong></div><div>Waves: <strong id="stat-wave">0</strong></div><div>Forts: <strong id="stat-forts">0</strong></div></div>
    </header>
    <div class="stage-wrap">
      <canvas id="stage"></canvas>
      <div class="overlay show" id="overlay">
        <div class="card">
          <h2>Mercury</h2>
          <p>Hold the ridge. Place forts on high ground. Attackers path around elevation. Starve their advance before your wall integrity fails.</p>
          <div class="row">
            <button class="btn" id="btn-start" type="button">Start</button>
          </div>
        </div>
      </div>
    </div>
    <footer class="bar">
      <span id="status">Ready</span>
      <button class="btn" id="btn-reset" type="button">Reset</button>
    </footer>
  `
  return {
    canvas: document.getElementById('stage'),
    overlay: document.getElementById('overlay'),
    status: document.getElementById('status'),
    btnStart: document.getElementById('btn-start'),
    btnReset: document.getElementById('btn-reset'),
    setStat(id, value) {
      const el = document.getElementById(id)
      if (el) el.textContent = String(value)
    }
  }
}

﻿const state = {
  running: false,
  hp: 100,
  wave: 1,
  forts: [],
  enemies: [],
  height: null,
  cols: 48,
  rows: 28,
  t: 0,
  spawn: 0
}
let ui, ctx, W, H, cell
function genHeight(cols, rows) {
  const g = new Float32Array(cols * rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = x / cols
      const ny = y / rows
      const ridge = Math.exp(-Math.pow((ny - 0.45 - 0.08 * Math.sin(nx * 6)) * 4.2, 2))
      const noise = Math.sin(x * 0.55) * Math.cos(y * 0.4) * 0.12
      g[y * cols + x] = Math.min(1, Math.max(0, ridge * 0.85 + noise + ny * 0.05))
    }
  }
  return g
}
function costAt(x, y) {
  if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return 999
  const h = state.height[y * state.cols + x]
  let c = 1 + h * 3.5
  for (const f of state.forts) {
    if (Math.hypot(f.x - x, f.y - y) < 2.2) c += 6
  }
  return c
}
function pathfind(sx, sy, tx, ty) {
