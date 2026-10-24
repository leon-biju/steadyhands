// Homer minigame. He's hogging the console and the reactor heats up while he's leaning on the
// buttons. Bribe him off it with a donut. Pinch a donut and drag it to his mouth: too fast or letting go drops it.
// Homer's image is drawn flipped so he faces left, towards the donut.
import homerUrl from '../assets/Homer_Simpson.webp'
import donutUrl from '../assets/homer_donut.png'
import type { InputFrame } from '../shared/types.ts'
import { GAUGES, HOMER as H } from './config.ts'
import type { ReactorSim } from './sim.ts'
import type { GameUI } from './ui.ts'

type Phase = 'idle' | 'sleep' | 'eat' | 'fail'
type Side = 'left' | 'right'

function load(url: string) {
  const img = new Image()
  img.src = url
  return img
}
const HOMER_IMG = load(homerUrl)
const DONUT_IMG = load(donutUrl)
const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function say(text: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.pitch = 0.6
  u.rate = 0.9
  speechSynthesis.speak(u)
}

export class Homer {
  phase: Phase = 'idle'
  private sim: ReactorSim
  private ui: GameUI
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private w = 0
  private h = 0
  private dpr = 1
  private phaseMs = 0
  private fed = 0
  private donut = { x: 0, y: 0, vy: 0, held: null as Side | null, falling: false, respawnIn: 0 }
  private speed = 0
  private lastPinch: { x: number; y: number } | null = null
  private slipped = false

  constructor(sim: ReactorSim, ui: GameUI) {
    this.sim = sim
    this.ui = ui
    this.canvas.className = 'homer-game'
    this.canvas.hidden = true
    document.body.appendChild(this.canvas)
    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  get active() {
    return this.phase !== 'idle'
  }

  reset() {
    this.phase = 'idle'
    this.canvas.hidden = true
  }

  /** start right now (dev console: game.homer.start()) */
  start() {
    if (this.active) return
    this.fed = 0
    this.spawnDonut()
    this.canvas.hidden = false
    this.go('sleep')
  }

  /** dt in ms */
  update(frame: InputFrame, dt: number) {
    if (this.active && this.sim.over) this.reset()
    if (!this.active || this.ui.paused) return
    this.phaseMs += dt

    if (this.phase === 'sleep') {
      const s = this.sim.state
      s.temperature = Math.min(GAUGES.temperature.max, s.temperature + (H.heatPerSec * dt) / 1000)
      this.updateDonut(frame, dt)
      if (this.phase === 'sleep' && this.phaseMs > H.timeLimitMs) {
        s.meltdown = Math.min(100, s.meltdown + H.failPenalty)
        say("D'oh!")
        this.go('fail')
      }
    } else if (this.phaseMs > (this.phase === 'eat' ? H.eatMs : H.failMs)) {
      this.reset()
      return
    }
    this.draw()
  }

  private go(p: Phase) {
    this.phase = p
    this.phaseMs = 0
  }

  /** where Homer is drawn: his image fitted inside H.box, bottom-aligned */
  private get rect() {
    const b = { x: H.box.x * this.w, y: H.box.y * this.h, w: H.box.w * this.w, h: H.box.h * this.h }
    if (!ready(HOMER_IMG)) return b
    const k = Math.min(b.w / HOMER_IMG.naturalWidth, b.h / HOMER_IMG.naturalHeight)
    const w = HOMER_IMG.naturalWidth * k
    const h = HOMER_IMG.naturalHeight * k
    return { x: b.x + (b.w - w) / 2, y: b.y + b.h - h, w, h }
  }

  private get mouth() {
    const r = this.rect
    return { x: r.x + H.mouth.x * r.w, y: r.y + H.mouth.y * r.h }
  }

  private spawnDonut() {
    // left side of the screen, away from Homer
    this.donut = { x: rand(0.1, 0.4) * this.w, y: rand(0.25, 0.8) * this.h, vy: 0, held: null, falling: false, respawnIn: 0 }
    this.lastPinch = null
    this.speed = 0
  }

  private updateDonut(frame: InputFrame, dt: number) {
    const d = this.donut
    if (d.falling) {
      d.vy += this.h * 3 * (dt / 1000)
      d.y += d.vy * (dt / 1000)
      if ((d.respawnIn -= dt) <= 0) this.spawnDonut()
      return
    }

    if (d.held) {
      const hand = frame[d.held]
      if (!hand.tracked || !hand.pinching) return this.drop(false)
      const p = { x: hand.pinchPoint.x * this.w, y: hand.pinchPoint.y * this.h }
      if (this.lastPinch && dt > 0) {
        const raw = Math.hypot(p.x - this.lastPinch.x, p.y - this.lastPinch.y) / this.w / (dt / 1000)
        this.speed += (raw - this.speed) * (1 - Math.exp(-dt / H.speedSmoothMs))
      }
      this.lastPinch = p
      d.x = p.x
      d.y = p.y
      if (this.speed > H.maxDragSpeed) return this.drop(true)
      const m = this.mouth
      if (Math.hypot(d.x - m.x, d.y - m.y) < H.mouthRadius * this.h) {
        this.fed++
        if (this.fed >= H.donuts[this.sim.difficulty]) {
          say('Mmm... donut')
          this.go('eat')
        } else {
          say('Mmm')
          this.spawnDonut()
        }
      }
      return
    }

    // grab: a fresh pinch near the donut
    const grab = [frame.left, frame.right].find(
      (h) => h.tracked && h.pinching && Math.hypot(h.pinchPoint.x * this.w - d.x, h.pinchPoint.y * this.h - d.y) < H.grabRadius * this.h,
    )
    if (grab) {
      d.held = grab.side
      this.lastPinch = null
      this.speed = 0
    }
  }

  private drop(slipped: boolean) {
    this.slipped = slipped
    Object.assign(this.donut, { held: null, falling: true, vy: 0, respawnIn: H.dropRespawnMs })
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1
    this.w = window.innerWidth
    this.h = window.innerHeight
    this.canvas.width = this.w * this.dpr
    this.canvas.height = this.h * this.dpr
  }

  // ---- drawing ----

  private draw() {
    const { ctx, w, h } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(4,6,8,0.6)'
    ctx.fillRect(0, 0, w, h)

    const awake = this.phase === 'eat'
    const b = this.rect
    if (ready(HOMER_IMG)) {
      // happy hop while he eats, otherwise a slow idle sway
      const hop = awake ? -Math.abs(Math.sin(this.phaseMs / 120)) * h * 0.02 : 0
      const sway = awake ? 0 : Math.sin(this.phaseMs / 700) * 0.02
      ctx.save()
      ctx.translate(b.x + b.w / 2, b.y + b.h + hop)
      ctx.rotate(sway)
      ctx.scale(-1, 1)
      ctx.drawImage(HOMER_IMG, -b.w / 2, -b.h, b.w, b.h)
      ctx.restore()
    }

    const m = this.mouth
    if (this.phase === 'sleep') {
      // target ring on the mouth
      ctx.strokeStyle = `rgba(255,214,0,${0.5 + 0.3 * Math.sin(this.phaseMs / 200)})`
      ctx.lineWidth = 3
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.arc(m.x, m.y, H.mouthRadius * h, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      this.drawDonut()
      this.drawHud()
    } else {
      this.bubble(m.x, b.y - h * 0.02, awake ? 'Mmm... donut' : "D'oh!")
    }
  }

  private drawHud() {
    const { ctx, w, h } = this
    const need = H.donuts[this.sim.difficulty]
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffd600'
    ctx.font = `900 ${Math.round(h * 0.06)}px Impact, "Arial Black", sans-serif`
    ctx.fillText('HOMER IS HOGGING THE CONSOLE', w / 2, h * 0.1)
    ctx.font = '600 15px ui-monospace, monospace'
    ctx.fillStyle = '#fff'
    const msg = this.donut.falling ? (this.slipped ? 'Too fast! It slipped.' : 'You dropped it!') : `Pinch the donut and drag it to his mouth. Slowly. ${need > 1 ? `(${this.fed}/${need})` : ''}`
    ctx.fillText(msg, w / 2, h * 0.1 + 30)
    const bw = w * 0.3
    const t = Math.min(1, this.phaseMs / H.timeLimitMs)
    ctx.fillStyle = 'rgba(255,214,0,0.25)'
    ctx.fillRect(w / 2 - bw / 2, h * 0.1 + 44, bw, 6)
    ctx.fillStyle = '#ffd600'
    ctx.fillRect(w / 2 - bw / 2, h * 0.1 + 44, bw * (1 - t), 6)
  }

  private drawDonut() {
    const { ctx } = this
    const { x, y, held } = this.donut
    const r = H.donutRadius * this.h * (held ? 1.1 : 1)
    if (ready(DONUT_IMG)) ctx.drawImage(DONUT_IMG, x - r, y - r, r * 2, r * 2)
    if (!held && !this.donut.falling) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, H.grabRadius * this.h * (1 + 0.08 * Math.sin(this.phaseMs / 150)), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  private bubble(x: number, y: number, text: string) {
    const { ctx } = this
    ctx.font = `900 ${Math.round(this.h * 0.05)}px Impact, "Arial Black", sans-serif`
    const tw = ctx.measureText(text).width
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(x - tw / 2 - 20, y - this.h * 0.06, tw + 40, this.h * 0.08, 16)
    ctx.fill()
    ctx.fillStyle = '#000'
    ctx.textAlign = 'center'
    ctx.fillText(text, x, y)
  }
}
