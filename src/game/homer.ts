// Homer minigame. He's fallen asleep face-down on the console and the reactor heats up while his
// face is on the buttons. Pinch a donut and drag it to his mouth: too fast or letting go drops it.
// Art: drop src/assets/homer.png (or homer-asleep.png + homer-awake.png) in and it's picked up
// automatically; until then he's drawn as a placeholder.
import type { InputFrame } from '../shared/types.ts'
import { GAUGES, HOMER as H } from './config.ts'
import type { ReactorSim } from './sim.ts'
import type { GameUI } from './ui.ts'

type Phase = 'idle' | 'sleep' | 'eat' | 'fail'
type Side = 'left' | 'right'

const art = import.meta.glob('../assets/homer*.{png,webp,jpg}', { eager: true, import: 'default' }) as Record<string, string>
function loadArt(match: string) {
  const url = Object.entries(art).find(([k]) => k.includes(match))?.[1] ?? Object.values(art)[0]
  if (!url) return null
  const img = new Image()
  img.src = url
  return img
}
const ASLEEP = loadArt('asleep')
const AWAKE = loadArt('awake')

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

  private get mouth() {
    const b = H.box
    return { x: (b.x + H.mouth.x * b.w) * this.w, y: (b.y + H.mouth.y * b.h) * this.h }
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
    const b = { x: H.box.x * w, y: H.box.y * h, w: H.box.w * w, h: H.box.h * h }
    const img = awake ? (AWAKE ?? ASLEEP) : ASLEEP
    if (img?.complete && img.naturalWidth) {
      // fit inside the box, bottom-aligned
      const k = Math.min(b.w / img.naturalWidth, b.h / img.naturalHeight)
      const iw = img.naturalWidth * k
      const ih = img.naturalHeight * k
      ctx.save()
      if (awake && !AWAKE) {
        // only one pose: sit him up a bit
        ctx.translate(b.x + b.w / 2, b.y + b.h)
        ctx.rotate(-0.15)
        ctx.translate(-(b.x + b.w / 2), -(b.y + b.h))
      }
      ctx.drawImage(img, b.x + (b.w - iw) / 2, b.y + b.h - ih, iw, ih)
      ctx.restore()
    } else {
      this.drawPlaceholder(b, awake)
    }

    const m = this.mouth
    if (this.phase === 'sleep') {
      // target ring on the mouth, and snoring
      ctx.strokeStyle = `rgba(255,214,0,${0.5 + 0.3 * Math.sin(this.phaseMs / 200)})`
      ctx.lineWidth = 3
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.arc(m.x, m.y, H.mouthRadius * h, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      for (let i = 0; i < 3; i++) {
        const t = ((this.phaseMs / 1400 + i / 3) % 1)
        ctx.globalAlpha = 1 - t
        ctx.font = `900 ${Math.round(h * (0.03 + t * 0.03))}px Impact, "Arial Black", sans-serif`
        ctx.fillText('Z', b.x + b.w * 0.75 + t * 40, b.y + b.h * 0.3 - t * 80)
      }
      ctx.globalAlpha = 1
      this.drawDonut()
      this.drawHud()
    } else {
      this.bubble(m.x, b.y + b.h * 0.05, awake ? 'Mmm... donut' : "D'oh!")
    }
  }

  private drawHud() {
    const { ctx, w, h } = this
    const need = H.donuts[this.sim.difficulty]
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffd600'
    ctx.font = `900 ${Math.round(h * 0.06)}px Impact, "Arial Black", sans-serif`
    ctx.fillText('HOMER FELL ASLEEP ON THE CONSOLE', w / 2, h * 0.1)
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
    ctx.fillStyle = '#d9a35b'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff7eb6'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2)
    ctx.fill()
    const colors = ['#fff', '#4fd8e8', '#ffd600', '#46c27a', '#e5484d']
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const rr = r * (0.5 + (i % 3) * 0.12)
      ctx.save()
      ctx.translate(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      ctx.rotate(a * 3)
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(-r * 0.09, -r * 0.03, r * 0.18, r * 0.06)
      ctx.restore()
    }
    ctx.fillStyle = 'rgba(4,6,8,1)'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.3, 0, Math.PI * 2)
    ctx.fill()
    if (!held && !this.donut.falling) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, H.grabRadius * this.h * (1 + 0.08 * Math.sin(this.phaseMs / 150)), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // stand-in until the real image is in: big yellow head lying on its side
  private drawPlaceholder(b: { x: number; y: number; w: number; h: number }, awake: boolean) {
    const { ctx } = this
    const cx = b.x + b.w * 0.5
    const cy = b.y + b.h * 0.6
    const rx = b.w * 0.34
    const ry = b.h * 0.3
    // console he's lying on
    ctx.fillStyle = '#2a3038'
    ctx.fillRect(b.x, b.y + b.h * 0.85, b.w, b.h * 0.15)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(awake ? -0.1 : 0.35)
    ctx.fillStyle = '#ffd90f'
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    // stubble
    ctx.fillStyle = '#c9a06a'
    ctx.beginPath()
    ctx.ellipse(-rx * 0.15, ry * 0.45, rx * 0.55, ry * 0.42, 0, 0, Math.PI)
    ctx.fill()
    // eyes
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    for (const dx of [-0.35, 0.05]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(rx * dx, -ry * 0.25, ry * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      if (awake) {
        ctx.fillStyle = '#000'
        ctx.arc(rx * dx, -ry * 0.25, ry * 0.04, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // eyelid
        ctx.fillStyle = '#ffd90f'
        ctx.arc(rx * dx, -ry * 0.25, ry * 0.2, Math.PI, 0)
        ctx.fill()
        ctx.stroke()
      }
    }
    // hairs
    ctx.beginPath()
    ctx.arc(-rx * 0.1, -ry * 1.0, ry * 0.25, Math.PI, 0)
    ctx.arc(rx * 0.25, -ry * 0.95, ry * 0.25, Math.PI, 0)
    ctx.stroke()
    ctx.restore()
    // mouth sits where the config says, so feeding lines up with the real image later
    const m = this.mouth
    ctx.fillStyle = '#5a1a12'
    ctx.beginPath()
    ctx.ellipse(m.x, m.y, rx * 0.22, awake ? ry * 0.22 : ry * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffd600'
    ctx.font = '700 11px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('[placeholder: homer.png]', cx, b.y + b.h * 0.95)
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
