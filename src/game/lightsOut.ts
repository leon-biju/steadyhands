// "Lights Out" horror minigame. The power cuts and the screen goes black; an open palm is a
// flashlight. Find the breaker and hold a fist on it to get the lights back. Partway through
// something shows up in the dark: hold both hands perfectly still until it leaves, or it gets you
// (jump scare + meltdown penalty). Sounds are synthesised so there are no assets to load.
import type { InputFrame } from '../shared/types.ts'
import { cursor } from '../input/gestures.ts'
import { LIGHTS_OUT as L } from './config.ts'
import type { ReactorSim } from './sim.ts'
import type { GameUI } from './ui.ts'

type Phase = 'idle' | 'flickerOut' | 'dark' | 'freeze' | 'scare' | 'flickerIn'
type Side = 'left' | 'right'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export class LightsOut {
  phase: Phase = 'idle'
  private sim: ReactorSim
  private ui: GameUI
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private mask = document.createElement('canvas')
  private dark = document.createElement('canvas')
  private w = 0
  private h = 0
  private dpr = 1

  private phaseMs = 0
  private darkMs = 0 // total time spent looking for the breaker
  private breaker = { x: 0, y: 0, held: 0 }
  private freezeAt = 0
  private froze = false
  private creature = { x: 0, y: 0 }
  private scareThen: 'dark' | 'end' = 'end'
  private speed = { left: 0, right: 0 }
  private last: Record<Side, { x: number; y: number } | null> = { left: null, right: null }
  private wasTracked = { left: false, right: false }
  private sfx = new Sfx()

  constructor(sim: ReactorSim, ui: GameUI) {
    this.sim = sim
    this.ui = ui
    this.canvas.className = 'lights-out'
    this.canvas.hidden = true
    document.body.appendChild(this.canvas)
    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  get active() {
    return this.phase !== 'idle'
  }

  reset() {
    this.end()
  }

  /** start right now (also handy from the dev console: game.lightsOut.start()) */
  start() {
    if (this.active) return
    const m = L.breakerMargin
    this.breaker = { x: rand(m, 1 - m) * this.w, y: rand(m, 1 - m) * this.h, held: 0 }
    this.freezeAt = rand(L.freezeAfterMs[0], L.freezeAfterMs[1])
    this.froze = false
    this.darkMs = 0
    this.canvas.hidden = false
    this.go('flickerOut')
    this.sfx.cut()
  }

  /** dt in ms */
  update(frame: InputFrame, dt: number) {
    if (this.active && this.sim.over) this.end()
    if (!this.active || this.sim.over || this.ui.paused) return

    this.track(frame, dt)
    this.phaseMs += dt
    switch (this.phase) {
      case 'flickerOut':
        if (this.phaseMs > L.flickerMs) this.go('dark')
        break
      case 'dark':
        this.darkMs += dt
        this.sfx.heartbeat(dt, 1)
        if (!this.froze && this.darkMs > this.freezeAt) this.startFreeze()
        else if (this.darkMs > L.timeLimitMs) this.scare('end')
        else if (this.updateBreaker(frame, dt)) {
          this.sfx.cut()
          this.go('flickerIn')
        }
        break
      case 'freeze':
        this.sfx.heartbeat(dt, 2.2)
        if (this.phaseMs > L.freezeGraceMs && this.moved(frame)) this.scare('dark')
        else if (this.phaseMs > L.freezeMs) {
          this.sfx.drone(false)
          this.go('dark')
        }
        break
      case 'scare':
        if (this.phaseMs > L.scareMs) this.go(this.scareThen === 'dark' ? 'dark' : 'flickerIn')
        break
      case 'flickerIn':
        if (this.phaseMs > L.flickerMs) this.end()
        break
    }
    this.draw(frame)
  }

  private go(p: Phase) {
    this.phase = p
    this.phaseMs = 0
  }

  private end() {
    this.phase = 'idle'
    this.canvas.hidden = true
    this.sfx.drone(false)
  }

  private startFreeze() {
    this.froze = true
    // somewhere away from the breaker so it doesn't sit on top of it
    do {
      this.creature = { x: rand(0.15, 0.85) * this.w, y: rand(0.3, 0.7) * this.h }
    } while (Math.hypot(this.creature.x - this.breaker.x, this.creature.y - this.breaker.y) < this.h * 0.3)
    this.go('freeze')
    this.sfx.drone(true)
    this.sfx.sting()
  }

  private scare(then: 'dark' | 'end') {
    this.scareThen = then
    this.sfx.drone(false)
    this.sfx.scream()
    this.sim.state.meltdown = Math.min(100, this.sim.state.meltdown + L.scarePenalty)
    this.go('scare')
  }

  /** smoothed hand speed, in screen widths per second */
  private track(frame: InputFrame, dt: number) {
    const k = 1 - Math.exp(-dt / L.moveSmoothMs)
    for (const side of ['left', 'right'] as Side[]) {
      const hand = frame[side]
      const prev = this.last[side]
      let raw = 0
      if (hand.tracked && prev && dt > 0) {
        raw = Math.hypot(hand.pointer.x - prev.x, ((hand.pointer.y - prev.y) * this.h) / this.w) / (dt / 1000)
      }
      this.speed[side] += (raw - this.speed[side]) * k
      this.last[side] = hand.tracked ? { ...hand.pointer } : null
    }
  }

  /** moving, or pulling a hand out of view, both count */
  private moved(frame: InputFrame) {
    let moved = false
    for (const side of ['left', 'right'] as Side[]) {
      const tracked = frame[side].tracked
      if (this.speed[side] > L.moveLimit || (this.wasTracked[side] && !tracked)) moved = true
      this.wasTracked[side] = tracked
    }
    return moved
  }

  /** fist held on the breaker; true once it's thrown */
  private updateBreaker(frame: InputFrame, dt: number) {
    const b = this.breaker
    const on = [frame.left, frame.right].some((h) => {
      if (!h.tracked || h.gesture !== 'fist') return false
      const p = cursor(h)
      return Math.hypot(p.x * this.w - b.x, p.y * this.h - b.y) < L.breakerSize
    })
    b.held = on ? b.held + dt : Math.max(0, b.held - dt * 2)
    return b.held >= L.breakerHoldMs
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1
    this.w = window.innerWidth
    this.h = window.innerHeight
    for (const c of [this.canvas, this.mask, this.dark]) {
      c.width = this.w * this.dpr
      c.height = this.h * this.dpr
    }
  }

  // ---- drawing ----

  private draw(frame: InputFrame) {
    const { ctx, w, h } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)

    if (this.phase === 'scare') return this.drawScare()
    if (this.phase === 'flickerOut' || this.phase === 'flickerIn') {
      // stutter: random on/off, mostly dark going out, mostly lit coming back
      const t = this.phaseMs / L.flickerMs
      const lit = Math.random() < (this.phase === 'flickerOut' ? 1 - t : t)
      if (!lit) {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, w, h)
      }
      return
    }

    // light mask: soft circles where the hands are
    const m = this.mask.getContext('2d')!
    m.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    m.clearRect(0, 0, w, h)
    for (const hand of [frame.left, frame.right]) {
      if (!hand.tracked) continue
      const p = cursor(hand)
      const r = h * (hand.gesture === 'open' ? L.beamRadius : L.dimRadius) * rand(0.96, 1.04)
      const g = m.createRadialGradient(p.x * w, p.y * h, r * 0.2, p.x * w, p.y * h, r)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.6, 'rgba(255,255,255,0.7)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      m.fillStyle = g
      m.fillRect(0, 0, w, h)
    }

    // things that only show in the light
    this.drawBreaker()
    if (this.phase === 'freeze') this.drawCreature(false)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(this.mask, 0, 0, w, h)

    // darkness everywhere else, behind them
    const d = this.dark.getContext('2d')!
    d.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    d.globalCompositeOperation = 'source-over'
    d.fillStyle = 'rgba(0,0,0,0.985)'
    d.clearRect(0, 0, w, h)
    d.fillRect(0, 0, w, h)
    d.globalCompositeOperation = 'destination-out'
    d.drawImage(this.mask, 0, 0, w, h)
    ctx.globalCompositeOperation = 'destination-over'
    ctx.drawImage(this.dark, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    // always visible: its eyes, and the text
    if (this.phase === 'freeze') {
      this.drawCreature(true)
      this.drawFreezeText()
    } else {
      ctx.font = '600 15px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(229,72,77,${0.55 + 0.25 * Math.sin(this.darkMs / 300)})`
      ctx.fillText('POWER FAILURE · open palm to see · fist on the breaker', w / 2, 40)
    }
  }

  private drawBreaker() {
    const { ctx } = this
    const { x, y, held } = this.breaker
    const s = L.breakerSize
    ctx.fillStyle = '#4a4f55'
    ctx.strokeStyle = '#f5a623'
    ctx.lineWidth = 3
    ctx.fillRect(x - s / 2, y - s * 0.7, s, s * 1.4)
    ctx.strokeRect(x - s / 2, y - s * 0.7, s, s * 1.4)
    // switch, flips up as it's held
    const t = held / L.breakerHoldMs
    ctx.fillStyle = '#1b1e22'
    ctx.fillRect(x - s * 0.15, y - s * 0.4, s * 0.3, s * 0.8)
    ctx.fillStyle = t > 0 ? '#f5a623' : '#c9ccd1'
    ctx.fillRect(x - s * 0.2, y + s * 0.2 - t * s * 0.55, s * 0.4, s * 0.22)
    ctx.fillStyle = '#f5a623'
    ctx.font = '700 11px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('MAIN BREAKER', x, y + s * 0.95)
    if (held > 0) {
      ctx.beginPath()
      ctx.arc(x, y, s * 0.95, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2)
      ctx.lineWidth = 5
      ctx.stroke()
    }
  }

  private drawCreature(eyesOnly: boolean) {
    const { ctx } = this
    const grow = 1 + (this.phaseMs / L.freezeMs) * 0.7 // it creeps closer
    const u = this.h * 0.09 * grow
    const { x, y } = this.creature
    if (!eyesOnly) {
      ctx.fillStyle = '#16100f'
      ctx.beginPath()
      ctx.ellipse(x, y - u * 0.4, u * 0.75, u, 0, 0, Math.PI * 2) // head
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x - u * 2.2, y + u * 4)
      ctx.quadraticCurveTo(x - u * 1.6, y + u * 0.6, x, y + u * 0.5)
      ctx.quadraticCurveTo(x + u * 1.6, y + u * 0.6, x + u * 2.2, y + u * 4)
      ctx.fill()
      return
    }
    const blink = Math.sin(this.phaseMs / 170) > 0.97
    if (blink) return
    ctx.fillStyle = '#ff2a2a'
    ctx.shadowColor = '#ff0000'
    ctx.shadowBlur = 18
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath()
      ctx.ellipse(x + dx * u, y - u * 0.5, u * 0.12, u * 0.07, dx * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  private drawFreezeText() {
    const { ctx, w, h } = this
    const t = Math.min(1, this.phaseMs / L.freezeMs)
    const jitter = () => rand(-2, 2)
    ctx.textAlign = 'center'
    ctx.font = `900 ${Math.round(h * 0.11)}px Impact, "Arial Black", sans-serif`
    ctx.fillStyle = '#e5484d'
    ctx.fillText("DON'T MOVE", w / 2 + jitter(), h * 0.2 + jitter())
    // bar runs out as it loses interest
    const bw = w * 0.3
    ctx.fillStyle = 'rgba(229,72,77,0.25)'
    ctx.fillRect(w / 2 - bw / 2, h * 0.24, bw, 6)
    ctx.fillStyle = '#e5484d'
    ctx.fillRect(w / 2 - bw / 2, h * 0.24, bw * (1 - t), 6)
  }

  private drawScare() {
    const { ctx, w, h } = this
    const t = this.phaseMs / L.scareMs
    const zoom = Math.min(1.15, 0.5 + t * 6)
    const shake = (1 - t) * 40
    ctx.fillStyle = Math.random() < 0.3 ? '#5a0000' : '#000'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.translate(w / 2 + rand(-shake, shake), h / 2 + rand(-shake, shake))
    ctx.scale(zoom, zoom)
    const u = Math.min(w, h) * 0.45
    // face
    ctx.fillStyle = '#cfc9bb'
    ctx.beginPath()
    ctx.ellipse(0, 0, u * 0.72, u, 0, 0, Math.PI * 2)
    ctx.fill()
    // sockets
    ctx.fillStyle = '#000'
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath()
      ctx.ellipse(dx * u, -u * 0.25, u * 0.17, u * 0.22, dx, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#ff1a1a'
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath()
      ctx.arc(dx * u, -u * 0.22, u * 0.035, 0, Math.PI * 2)
      ctx.fill()
    }
    // mouth, stretched open
    ctx.fillStyle = '#0a0000'
    ctx.beginPath()
    ctx.ellipse(0, u * 0.45, u * 0.3, u * 0.38, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e8e2d0'
    for (let i = -3; i <= 3; i++) {
      for (const [y0, dir] of [[0.12, 1], [0.78, -1]] as const) {
        const x0 = i * u * 0.075
        ctx.beginPath()
        ctx.moveTo(x0 - u * 0.035, u * y0)
        ctx.lineTo(x0 + u * 0.035, u * y0)
        ctx.lineTo(x0, u * (y0 + dir * 0.13))
        ctx.fill()
      }
    }
    ctx.restore()
  }
}

// Tiny Web Audio synth: power cut thunk, heartbeat, drone, sting, scream.
class Sfx {
  private ac: AudioContext | null = null
  private beatIn = 0
  private droneNodes: { stop(): void } | null = null

  private get ctx() {
    this.ac ??= new AudioContext()
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {})
    return this.ac
  }

  private out(gain: number) {
    const g = this.ctx.createGain()
    g.gain.value = gain * L.volume
    g.connect(this.ctx.destination)
    return g
  }

  private noise(sec: number) {
    const ac = this.ctx
    const buf = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    return src
  }

  private thump(freq: number, gain: number, sec: number, at = 0) {
    const ac = this.ctx
    const t = ac.currentTime + at
    const o = ac.createOscillator()
    const g = this.out(0)
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + sec)
    g.gain.setValueAtTime(gain * L.volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + sec)
    o.connect(g)
    o.start(t)
    o.stop(t + sec)
  }

  cut() {
    this.thump(70, 1, 0.6)
    const n = this.noise(0.15)
    const g = this.out(0.4)
    n.connect(g)
    n.start()
  }

  /** call every frame; rate 1 = resting, higher = panicking */
  heartbeat(dt: number, rate: number) {
    this.beatIn -= (dt / 1000) * rate
    if (this.beatIn > 0) return
    this.beatIn = 0.95
    this.thump(55, 0.9, 0.18)
    this.thump(50, 0.6, 0.18, 0.22)
  }

  sting() {
    const ac = this.ctx
    const t = ac.currentTime
    for (const f of [440, 466, 622]) {
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const g = this.out(0)
      g.gain.setValueAtTime(0.12 * L.volume, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
      o.connect(g)
      o.start(t)
      o.stop(t + 1.2)
    }
  }

  drone(on: boolean) {
    if (!on) {
      this.droneNodes?.stop()
      this.droneNodes = null
      return
    }
    if (this.droneNodes) return
    const ac = this.ctx
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 300
    const g = this.out(0.25)
    lp.connect(g)
    const oscs = [41, 41.6, 61.8].map((f) => {
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(lp)
      o.start()
      return o
    })
    this.droneNodes = { stop: () => oscs.forEach((o) => o.stop()) }
  }

  scream() {
    const ac = this.ctx
    const t = ac.currentTime
    const sec = L.scareMs / 1000
    const n = this.noise(sec)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 3
    bp.frequency.setValueAtTime(2500, t)
    bp.frequency.exponentialRampToValueAtTime(600, t + sec)
    const g = this.out(0)
    g.gain.setValueAtTime(1.2 * L.volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + sec)
    n.connect(bp).connect(g)
    n.start(t)
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(900, t)
    o.frequency.exponentialRampToValueAtTime(150, t + sec)
    const og = this.out(0)
    og.gain.setValueAtTime(0.35 * L.volume, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + sec)
    o.connect(og)
    o.start(t)
    o.stop(t + sec)
    this.thump(80, 1, 0.5)
  }
}

