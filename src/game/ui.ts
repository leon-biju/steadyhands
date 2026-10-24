// Full-screen frame: small gauges mounted on the side rails, reactor window filling the middle,
// bare controls (front-facing coolant lever, guarded vent button) inside the window.
// Hand-tracking hooks (returned from startGame): ui.press('vent'), ui.release('vent'),
// ui.setLever(0..1) / ui.setLever(null) to let it spring back, ui.hitTest(x, y).
// Add the `is-hover` class to a control for a fingertip hover state.
import { GAUGES, SHIFT, UI, type GaugeDef, type GaugeKey } from './config.ts'
import { levelOf, type Level, type ReactorSim } from './sim.ts'


const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const pct = (v: number, d: GaugeDef) => (v / d.max) * 100
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const fmtTick = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))

type GaugeKind = 'temp' | 'press' | 'grid'

function gauge(d: GaugeDef, kind: GaugeKind) {
  const minor = d.step / 5
  let ticks = ''
  for (let v = 0; v <= d.max + 1e-6; v += minor) {
    const major = Math.abs(v / d.step - Math.round(v / d.step)) < 1e-6
    ticks += `<i class="tk${major ? ' mj' : ''}" style="bottom:${pct(v, d)}%">${major ? `<span>${fmtTick(v)}</span>` : ''}</i>`
  }
  let zones = ''
  if (d.warn !== undefined && d.crit !== undefined) {
    zones = `<i class="zn warn" style="bottom:${pct(d.warn, d)}%;height:${pct(d.crit - d.warn, d)}%"></i>
             <i class="zn crit" style="bottom:${pct(d.crit, d)}%;top:0"></i>`
  }
  if (d.target !== undefined) {
    const lo = pct(d.target * (1 - UI.targetBand), d)
    const hi = pct(d.target * (1 + UI.targetBand), d)
    zones += `<i class="zn tgt" style="bottom:${lo}%;height:${hi - lo}%"></i>`
  }
  const extra =
    kind === 'press'
      ? Array.from({ length: 5 }, (_, i) => `<i class="bubble" style="left:${15 + ((i * 29) % 55)}%;animation-delay:${-i * 0.5}s"></i>`).join('')
      : '<i class="shimmer"></i>'
  const cells = kind === 'grid' ? `<div class="g-cells">${'<i></i>'.repeat(24)}</div>` : ''
  const target = d.target !== undefined ? `<i class="g-target" style="bottom:${pct(d.target, d)}%"></i>` : ''
  return `
  <div class="gauge g-${kind}" data-g="${d.key}" data-level="ok">
    <div class="g-head"><span class="g-name">${d.label}</span></div>
    <div class="g-body">
      <div class="g-scale">${ticks}</div>
      <div class="g-zones">${zones}</div>
      <div class="g-col">
        <div class="g-fill">${extra}</div>
        ${cells}
        <i class="g-peak"></i>
        ${target}
      </div>
      <div class="g-rail"><i class="g-ptr"></i></div>
    </div>
    <div class="g-read"><b>0</b><span>${d.unit}</span></div>
  </div>`
}

function leverTicks() {
  let s = ''
  for (let i = 0; i <= 10; i++) {
    const label = i === 0 ? 'OFF' : i === 5 ? '50' : i === 10 ? 'MAX' : ''
    s += `<i class="lt${label ? ' mj' : ''}" style="top:${i * 10}%">${label ? `<span>${label}</span>` : ''}</i>`
  }
  return s
}

function template() {
  return `
<div class="frame">
  <i class="rivet" style="top:7px;left:7px"></i><i class="rivet" style="top:7px;right:7px"></i>
  <i class="rivet" style="bottom:7px;left:7px"></i><i class="rivet" style="bottom:7px;right:7px"></i>

  <aside class="rail left">
    ${gauge(GAUGES.temperature, 'temp')}
    ${gauge(GAUGES.pressure, 'press')}
  </aside>

  <section class="window">
    <canvas class="core-canvas"></canvas>

    <div class="hud tr">
      <div class="readout"><span>Left</span><b class="t-time">02:00</b></div>
      <div class="readout"><span>Score</span><b class="t-score">000000</b></div>
      <button class="btn" data-act="pause">Pause</button>
      <button class="btn" data-act="reset">Reset</button>
    </div>

    <div class="lever" data-ctl="coolant" style="--p:0">
      <div class="lever-body">
        <div class="lever-ticks">${leverTicks()}</div>
        <div class="lever-slot"><i class="lever-flow"></i></div>
        <div class="lever-handle"><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="ctl-label">Coolant <kbd>W</kbd><b class="lever-pct">0%</b></div>
    </div>

    <div class="vent" data-ctl="vent">
      <div class="vent-guard"><button class="vent-btn" aria-label="Pressure vent">Vent</button></div>
      <div class="ctl-label">Vent <kbd>E</kbd><b class="vent-state">Closed</b></div>
    </div>
  </section>

  <aside class="rail right">
    ${gauge(GAUGES.output, 'grid')}
  </aside>

  <div class="overlay" hidden>
    <div class="overlay-card">
      <span class="ov-code">ERR 0x7F · SCRAM FAILURE</span>
      <h1>Containment lost</h1>
      <p>Shift lasted <b class="ov-time">00:00</b> · score <b class="ov-score">0</b></p>
      <button class="btn big" data-act="restart">Restart reactor</button>
    </div>
  </div>
</div>`
}

export interface GameUI {
  canvas: HTMLCanvasElement
  paused: boolean
  update(dt: number): void
  press(id: 'vent'): void
  release(id: 'vent'): void
  /** drive the coolant lever directly (0..1); null lets it spring back */
  setLever(amount: number | null): void
  hitTest(x: number, y: number): HTMLElement | null
  /** called after Reset / Restart */
  onRestart?: () => void
}

export function createUI(root: HTMLElement, sim: ReactorSim): GameUI {
  root.innerHTML = template()
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!

  // ---- gauges ----
  const gauges = (Object.keys(GAUGES) as GaugeKey[]).map((key) => {
    const el = $(`[data-g="${key}"]`)
    const d = GAUGES[key]
    return {
      key,
      d,
      el,
      fill: el.querySelector<HTMLElement>('.g-fill')!,
      ptr: el.querySelector<HTMLElement>('.g-ptr')!,
      peakEl: el.querySelector<HTMLElement>('.g-peak')!,
      num: el.querySelector<HTMLElement>('.g-read b')!,
      fmt: new Intl.NumberFormat('en-GB', { minimumFractionDigits: d.decimals, maximumFractionDigits: d.decimals }),
      shown: sim.state[key],
      peak: sim.state[key],
      peakAge: 0,
      level: 'ok' as Level,
    }
  })

  const tTime = $('.t-time')
  const tScore = $('.t-score')
  const overlay = $('.overlay')

  // ---- coolant lever: front-facing, pull the handle down the slot ----
  const lever = $('.lever')
  const leverBody = $('.lever-body')
  const slot = $('.lever-slot')
  const leverPct = $('.lever-pct')
  let leverAmt = 0
  let leverDrag = false
  let leverKey = false
  let leverExternal: number | null = null

  function leverFromPointer(e: PointerEvent) {
    const r = slot.getBoundingClientRect()
    leverAmt = clamp01((e.clientY - r.top) / r.height)
  }
  leverBody.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    leverBody.setPointerCapture(e.pointerId)
    leverDrag = true
    lever.classList.add('is-held')
    leverFromPointer(e)
  })
  leverBody.addEventListener('pointermove', (e) => {
    if (leverDrag) leverFromPointer(e)
  })
  const leverUp = () => {
    leverDrag = false
    lever.classList.remove('is-held')
  }
  leverBody.addEventListener('pointerup', leverUp)
  leverBody.addEventListener('pointercancel', leverUp)
  leverBody.addEventListener('lostpointercapture', leverUp)

  // ---- vent button ----
  const vent = $('.vent')
  const ventBtn = $('.vent-btn')
  const ventState = $('.vent-state')
  function press() {
    if (sim.over) return
    sim.controls.vent = true
    vent.classList.add('is-held')
    ventState.textContent = 'Open'
  }
  function release() {
    sim.controls.vent = false
    vent.classList.remove('is-held')
    ventState.textContent = 'Closed'
  }
  ventBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    ventBtn.setPointerCapture(e.pointerId)
    press()
  })
  ventBtn.addEventListener('pointerup', release)
  ventBtn.addEventListener('pointercancel', release)
  ventBtn.addEventListener('lostpointercapture', release)

  // ---- keyboard ----
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'KeyW') leverKey = true
    if (e.code === 'KeyE') press()
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') leverKey = false
    if (e.code === 'KeyE') release()
  })
  window.addEventListener('blur', () => {
    leverKey = false
    leverUp()
    release()
  })

  // ---- buttons ----
  const ui: GameUI = {
    canvas: $<HTMLCanvasElement>('.core-canvas'),
    paused: false,
    update,
    press,
    release,
    setLever(a) {
      leverExternal = a === null ? null : clamp01(a)
    },
    hitTest(x, y) {
      const el = document.elementFromPoint(x, y)
      return (el?.closest('.lever, .vent, .btn') as HTMLElement) ?? null
    },
  }
  const pauseBtn = $('[data-act="pause"]')
  pauseBtn.addEventListener('click', () => {
    ui.paused = !ui.paused
    pauseBtn.textContent = ui.paused ? 'Resume' : 'Pause'
    document.body.classList.toggle('is-paused', ui.paused)
  })
  const restart = () => {
    sim.reset()
    leverAmt = 0
    overlay.hidden = true
    ui.onRestart?.()
  }
  $('[data-act="reset"]').addEventListener('click', restart)
  $('[data-act="restart"]').addEventListener('click', restart)

  // ---- per frame ----
  let lastStatus = ''

  function update(dt: number) {
    const s = sim.state

    // lever: external > key > drag > spring back up
    if (leverExternal !== null) leverAmt = leverExternal
    else if (leverKey) leverAmt = Math.min(1, leverAmt + dt * UI.leverKeySpeed)
    else if (!leverDrag) leverAmt *= Math.exp(-dt * UI.leverSpring)
    if (leverAmt < 0.002) leverAmt = 0
    lever.style.setProperty('--p', leverAmt.toFixed(4))
    leverPct.textContent = `${Math.round(leverAmt * 100)}%`
    lever.classList.toggle('is-on', leverAmt > 0.05)
    sim.controls.coolant = sim.over ? 0 : leverAmt

    // gauges
    const k = 1 - Math.exp(-dt * UI.gaugeSmoothing)
    let worst: Level = 'ok'
    for (const g of gauges) {
      const v = s[g.key]
      g.shown += (v - g.shown) * k
      const f = clamp01(g.shown / g.d.max) * 100
      g.fill.style.height = `${f.toFixed(2)}%`
      g.ptr.style.bottom = `${f.toFixed(2)}%`
      g.num.textContent = g.fmt.format(g.shown)

      if (g.shown >= g.peak) {
        g.peak = g.shown
        g.peakAge = 0
      } else if ((g.peakAge += dt) > UI.peakHoldSec) {
        g.peak = Math.max(g.shown, g.peak - g.d.max * UI.peakFall * dt)
      }
      g.peakEl.style.bottom = `${(clamp01(g.peak / g.d.max) * 100).toFixed(2)}%`

      const lvl = levelOf(g.key, v)
      if (lvl !== g.level) {
        g.level = lvl
        g.el.dataset.level = lvl
      }
      if (lvl === 'crit' || (lvl === 'warn' && worst === 'ok')) worst = lvl
    }
    gauges[2].el.classList.toggle('on-target', Math.abs(s.output - GAUGES.output.target!) < GAUGES.output.target! * UI.targetBand)

    const st = s.melted ? 'melt' : s.won ? 'ok' : worst
    if (st !== lastStatus) {
      lastStatus = st
      document.body.dataset.level = st
    }

    tTime.textContent = mmss(Math.max(0, Math.ceil(SHIFT.lengthSec - s.time)))
    tScore.textContent = String(Math.floor(sim.score)).padStart(6, '0')

    if (sim.over && overlay.hidden) {
      overlay.hidden = false
      overlay.classList.toggle('won', s.won)
      $('.ov-code').textContent = s.won ? 'SHIFT COMPLETE · ALL SYSTEMS NOMINAL' : 'ERR 0x7F · SCRAM FAILURE'
      $('.overlay-card h1').textContent = s.won ? 'You survived' : 'Containment lost'
      $('[data-act="restart"]').textContent = s.won ? 'Play again' : 'Restart reactor'
      $('.ov-time').textContent = mmss(s.time)
      $('.ov-score').textContent = String(Math.floor(sim.score))
      release()
    }
  }

  return ui
}
