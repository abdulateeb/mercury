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
  const key = (x, y) => y * state.cols + x
  const open = [[0, sx, sy]]
  const came = new Map()
  const gScore = new Map([[key(sx, sy), 0]])
  const closed = new Set()
  while (open.length) {
    open.sort((a, b) => a[0] - b[0])
    const cur = open.shift()
    const x = cur[1]
    const y = cur[2]
    const k = key(x, y)
    if (closed.has(k)) continue
    closed.add(k)
    if (x === tx && y === ty) {
      const path = [[x, y]]
      let ck = k
      while (came.has(ck)) {
        const p = came.get(ck)
        path.push(p)
        ck = key(p[0], p[1])
      }
      path.reverse()
      return path
    }
    for (const pair of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + pair[0]
      const ny = y + pair[1]
      if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue
      const nk = key(nx, ny)
      if (closed.has(nk)) continue
      const tent = (gScore.get(k) || 0) + costAt(nx, ny)
      if (tent < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, [x, y])
        gScore.set(nk, tent)
        open.push([tent + Math.hypot(tx - nx, ty - ny), nx, ny])
      }
    }
  }
  return null
}
function reset() {
  state.hp = 100
  state.wave = 1
  state.forts = []
  state.enemies = []
  state.height = genHeight(state.cols, state.rows)
  state.t = 0
  state.spawn = 0
  ui.setStat('stat-hp', state.hp)
  ui.setStat('stat-wave', state.wave)
  ui.setStat('stat-forts', 0)
  ui.status.textContent = 'Place forts on the ridge, then survive waves'
}
function spawnEnemy() {
  const sx = Math.floor(Math.random() * state.cols)
  const path = pathfind(sx, 0, Math.floor(state.cols * 0.5), state.rows - 1) || [[sx, 0], [Math.floor(state.cols * 0.5), state.rows - 1]]
  state.enemies.push({ path, i: 0, prog: 0, hp: 2 + state.wave * 0.4 })
}
function update(dt) {
  if (!state.running) return
  state.t += dt
  state.spawn -= dt
  if (state.spawn <= 0) {
    spawnEnemy()
    state.spawn = Math.max(0.55, 1.6 - state.wave * 0.08)
  }
  if (state.t > 18 + state.wave * 2) {
    state.wave += 1
    state.t = 0
    ui.setStat('stat-wave', state.wave)
  }
  for (const e of state.enemies) {
    e.prog += dt * (1.5 + state.wave * 0.05)
    while (e.prog > 1 && e.i < e.path.length - 1) {
      e.prog -= 1
      e.i += 1
      const x = e.path[e.i][0]
      const y = e.path[e.i][1]
      for (const f of state.forts) {
        if (Math.hypot(f.x - x, f.y - y) < 1.6) {
          e.hp -= 1
          f.hp -= 0.35
        }
      }
    }
    if (e.i >= e.path.length - 1) {
      state.hp -= 4
      e.hp = 0
      ui.setStat('stat-hp', Math.max(0, Math.floor(state.hp)))
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0)
  state.forts = state.forts.filter((f) => f.hp > 0)
  ui.setStat('stat-forts', state.forts.length)
  if (state.hp <= 0) {
    state.running = false
    ui.status.textContent = 'Ridge lost. Reset to rebuild.'
    ui.overlay.classList.add('show')
  }
}
function draw() {
  ctx.clearRect(0, 0, W, H)
  cell = Math.min(W / state.cols, H / state.rows)
  const ox = (W - cell * state.cols) * 0.5
  const oy = (H - cell * state.rows) * 0.5
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const h = state.height[y * state.cols + x]
      const shade = 40 + h * 120
      ctx.fillStyle = 'rgb(' + Math.floor(shade * 0.7) + ',' + Math.floor(shade * 0.55) + ',' + Math.floor(shade * 0.35) + ')'
      ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5)
    }
  }
  for (const f of state.forts) {
    ctx.fillStyle = '#b86b3d'
    ctx.fillRect(ox + f.x * cell + 2, oy + f.y * cell + 2, cell - 4, cell - 4)
  }
  for (const e of state.enemies) {
    const a = e.path[e.i]
    const b = e.path[Math.min(e.i + 1, e.path.length - 1)]
    const x = a[0] + (b[0] - a[0]) * Math.min(1, e.prog)
    const y = a[1] + (b[1] - a[1]) * Math.min(1, e.prog)
    ctx.fillStyle = '#5a2a1e'
    ctx.beginPath()
    ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#e6dcc8'
  ctx.fillRect(ox, oy + (state.rows - 1) * cell, cell * state.cols, 3)
}
function loop(prev) {
  const now = performance.now()
  update(Math.min(0.05, (now - prev) / 1000))
  draw()
  requestAnimationFrame(() => loop(now))
}
function onClick(ev) {
  if (!state.running) return
  const rect = ui.canvas.getBoundingClientRect()
  cell = Math.min(W / state.cols, H / state.rows)
  const ox = (W - cell * state.cols) * 0.5
  const oy = (H - cell * state.rows) * 0.5
  const x = Math.floor((ev.clientX - rect.left - ox) / cell)
  const y = Math.floor((ev.clientY - rect.top - oy) / cell)
  if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return
  if (state.height[y * state.cols + x] < 0.42) {
    ui.status.textContent = 'Forts need higher ground'
    return
  }
  if (state.forts.some((f) => f.x === x && f.y === y)) return
  if (state.forts.length >= 10 + state.wave) {
    ui.status.textContent = 'Fort budget reached for this wave'
    return
  }
  state.forts.push({ x, y, hp: 8 })
  ui.setStat('stat-forts', state.forts.length)
  ui.status.textContent = 'Fort placed'
}
function resize() {
  const r = fitCanvas(ui.canvas)
  ctx = r.ctx
  W = r.w
  H = r.h
}
ui = mountShell()
reset()
resize()
window.addEventListener('resize', resize)
ui.canvas.addEventListener('click', onClick)
ui.btnStart.addEventListener('click', () => {
  ui.overlay.classList.remove('show')
  state.running = true
  ui.status.textContent = 'Defending ridge'
})
ui.btnReset.addEventListener('click', () => {
  reset()
  state.running = false
  ui.overlay.classList.add('show')
})
requestAnimationFrame((t) => loop(t))
void 2;
