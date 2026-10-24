// Reactor core renderer. Flat fills and strokes only: no gradients, no blur.
import { REACTOR } from './config.ts'
import type { ReactorVisuals } from './sim.ts'

const TAU = Math.PI * 2

type RGB = [number, number, number]
const HEAT_STOPS: [number, RGB][] = [
  [0, [79, 216, 232]], // cyan
  [0.45, [79, 216, 232]],
  [0.63, [245, 166, 35]], // amber (warn)
  [0.82, [229, 72, 77]], // red (crit)
  [1, [229, 72, 77]],
]
const COOLANT: RGB = [77, 148, 255]
const STEAM: RGB = [200, 212, 224]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function heatColor(h: number): RGB {
  h = clamp01(h)
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [p1, c1] = HEAT_STOPS[i]
    const [p0, c0] = HEAT_STOPS[i - 1]
    if (h <= p1) {
      const t = (h - p0) / (p1 - p0 || 1)
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)]
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1]
}
const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const tint = (c: RGB, f: number): RGB => [lerp(c[0], 255, f), lerp(c[1], 255, f), lerp(c[2], 255, f)]

interface Spark {
  a: number
  r: number
  speed: number
  size: number
  life: number
  decay: number
}
interface Jet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
}

export class ReactorView {
  bpm = 0
  pulse = 0

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private t = 0
  private phase = 0
  private heat = 0.35
  private inst = 0.2
  private cool = 0
  private waves: { life: number }[] = []
  private sparks: Spark[] = []
  private jets: Jet[] = []
  private jetTimer = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    new ResizeObserver(() => this.resize()).observe(canvas)
    this.resize()
    for (let i = 0; i < REACTOR.sparks; i++) this.sparks.push(this.spawn(true))
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = r.width
    this.h = r.height
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
  }

  private spawn(randomLife = false): Spark {
    return {
      a: Math.random() * TAU,
      r: 0.4 + Math.random() * 0.5,
      speed: (0.25 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1),
      size: 0.8 + Math.random() * 1.4,
      life: randomLife ? Math.random() : 1,
      decay: 0.15 + Math.random() * 0.35,
    }
  }

  render(dt: number, v: ReactorVisuals) {
    const k = 1 - Math.exp(-dt * 2.5)
    this.heat += ((v.melted ? 1 : v.heat) - this.heat) * k
    this.inst += ((v.melted ? 1 : v.instability) - this.inst) * k
    this.cool += (v.coolant - this.cool) * (1 - Math.exp(-dt * 8))
    const heat = clamp01(this.heat)
    const inst = clamp01(this.inst)
    this.t += dt
    const t = this.t

    // heartbeat: sharp beat + softer echo
    this.bpm = REACTOR.bpmMin + (REACTOR.bpmMax - REACTOR.bpmMin) * heat + inst * 20
    const prev = this.phase
    this.phase += (dt * this.bpm) / 60
    if (Math.floor(this.phase) !== Math.floor(prev)) this.waves.push({ life: 1 })
    const frac = this.phase % 1
    const pulse = Math.max(Math.exp(-frac * 4.5), frac > 0.3 ? Math.exp(-(frac - 0.3) * 7) * 0.45 : 0)
    this.pulse = pulse

    const { ctx, w, h } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const R = Math.min(w * 0.3, h * 0.31)
    const shake = inst * inst * 4
    const cx = w / 2 + (Math.random() - 0.5) * shake
    const cy = h * 0.47 + (Math.random() - 0.5) * shake
    const col = heatColor(heat)

    // crosshair + guide circles
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(140,165,190,0.10)'
    ctx.beginPath()
    ctx.moveTo(cx - R * 1.3, cy)
    ctx.lineTo(cx + R * 1.3, cy)
    ctx.moveTo(cx, cy - R * 1.3)
    ctx.lineTo(cx, cy + R * 1.3)
    ctx.stroke()
    for (const m of [0.8, 1.0, 1.22]) {
      circle(ctx, cx, cy, R * m)
      ctx.stroke()
    }

    // outer tick ring (slow rotation)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(t * 0.03)
    const minor = new Path2D()
    const major = new Path2D()
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * TAU
      const c = Math.cos(a)
      const s = Math.sin(a)
      const p = i % 12 === 0 ? major : minor
      const r1 = i % 12 === 0 ? 1.15 : 1.105
      p.moveTo(c * R * 1.07, s * R * 1.07)
      p.lineTo(c * R * r1, s * R * r1)
    }
    ctx.strokeStyle = 'rgba(140,165,190,0.22)'
    ctx.stroke(minor)
    ctx.lineWidth = 2
    ctx.strokeStyle = rgb(col, 0.75)
    ctx.stroke(major)
    ctx.restore()

    // flat stepped halo (translucent discs, no gradients)
    const coreR = R * (0.25 + heat * 0.06 + pulse * 0.03 + inst * 0.02)
    for (const [m, a] of [
      [2.6, 0.035],
      [2.1, 0.05],
      [1.65, 0.07],
    ] as const) {
      ctx.fillStyle = rgb(col, a + pulse * 0.03)
      circle(ctx, cx, cy, coreR * m)
      ctx.fill()
    }

    // coil segments with chasing light
    const segs = 16
    const ringW = R * 0.05
    ctx.lineWidth = ringW
    ctx.lineCap = 'butt'
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * TAU - t * 0.12
      const lit = Math.max(0, Math.sin(t * (2.5 + heat * 3) - i * 0.8))
      const glitch = inst > 0.6 && Math.random() < (inst - 0.6) * 0.25 ? 0.2 : 1
      ctx.strokeStyle = rgb(col, (0.16 + lit * 0.7 + pulse * 0.1) * glitch)
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.93, a0, a0 + (TAU / segs) * 0.72)
      ctx.stroke()
    }
    // coolant flowing along an inner channel
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(140,165,190,0.14)'
    circle(ctx, cx, cy, R * 0.85)
    ctx.stroke()
    if (this.cool > 0.02) {
      ctx.setLineDash([R * 0.07, R * 0.05])
      ctx.lineDashOffset = -t * 260 * this.cool
      ctx.strokeStyle = rgb(COOLANT, 0.3 + this.cool * 0.7)
      ctx.lineWidth = 4
      circle(ctx, cx, cy, R * 0.85)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // inner dashed containment ring
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-t * (0.5 + heat))
    ctx.setLineDash([R * 0.05, R * 0.035])
    ctx.lineWidth = 2
    ctx.strokeStyle = rgb(col, 0.35 + pulse * 0.25)
    circle(ctx, 0, 0, R * 0.66)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // shockwaves
    for (const wv of this.waves) {
      wv.life -= dt * 0.9
      if (wv.life <= 0) continue
      ctx.strokeStyle = rgb(tint(col, 0.2), wv.life * 0.5)
      ctx.lineWidth = 0.5 + wv.life * 2.5
      circle(ctx, cx, cy, lerp(coreR, R * 1.2, 1 - wv.life))
      ctx.stroke()
    }
    this.waves = this.waves.filter((wv) => wv.life > 0)

    // plasma filaments
    ctx.lineWidth = 1.4
    for (let f = 0; f < 7; f++) {
      const amp = 0.07 + inst * 0.28
      const n = 3 + (f % 4)
      const dir = f % 2 ? 1 : -1
      const speed = (0.6 + f * 0.17) * (1 + heat)
      ctx.strokeStyle = rgb(tint(col, 0.25), 0.3 + pulse * 0.25)
      ctx.beginPath()
      for (let i = 0; i <= 120; i++) {
        const th = (i / 120) * TAU
        const r = coreR * (1.05 + amp * Math.sin(n * th + t * speed * dir + f * 1.3) + 0.05 * Math.sin(7 * th - t * 2.2))
        const x = cx + Math.cos(th) * r
        const y = cy + Math.sin(th) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // core: flat concentric discs
    ctx.fillStyle = rgb(col)
    circle(ctx, cx, cy, coreR)
    ctx.fill()
    ctx.fillStyle = rgb(tint(col, 0.45))
    circle(ctx, cx, cy, coreR * 0.68)
    ctx.fill()
    ctx.fillStyle = rgb(tint(col, 0.85))
    circle(ctx, cx, cy, coreR * 0.38)
    ctx.fill()

    // orbiting sparks
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]
      s.a += s.speed * dt * (0.6 + heat * 1.6)
      s.life -= s.decay * dt
      if (s.life <= 0) {
        this.sparks[i] = this.spawn()
        continue
      }
      const r = R * s.r * (1 + (Math.random() - 0.5) * inst * 0.08)
      ctx.fillStyle = rgb(tint(col, 0.4), Math.sin(s.life * Math.PI) * (0.4 + pulse * 0.4))
      ctx.fillRect(cx + Math.cos(s.a) * r - s.size / 2, cy + Math.sin(s.a) * r - s.size / 2, s.size, s.size)
    }

    // vent ports + steam jets
    const ports = [-Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7]
    for (const a of ports) {
      const px = cx + Math.cos(a) * R * 1.07
      const py = cy + Math.sin(a) * R * 1.07
      ctx.fillStyle = v.venting ? rgb(STEAM, 0.9) : 'rgba(140,165,190,0.35)'
      ctx.fillRect(px - 5, py - 5, 10, 10)
    }
    if (v.venting) {
      this.jetTimer -= dt
      if (this.jetTimer <= 0) {
        this.jetTimer = 0.03
        for (const a of ports) {
          const spread = (Math.random() - 0.5) * 0.35
          const sp = 160 + Math.random() * 120
          this.jets.push({
            x: cx + Math.cos(a) * R * 1.07,
            y: cy + Math.sin(a) * R * 1.07,
            vx: Math.cos(a + spread) * sp,
            vy: Math.sin(a + spread) * sp,
            r: 3 + Math.random() * 4,
            life: 1,
          })
        }
      }
    }
    for (const j of this.jets) {
      j.life -= dt * 1.6
      j.x += j.vx * dt
      j.y += j.vy * dt
      j.vx *= 0.97
      j.vy *= 0.97
      j.r += dt * 26
      if (j.life <= 0) continue
      ctx.fillStyle = rgb(STEAM, j.life * 0.28)
      circle(ctx, j.x, j.y, j.r)
      ctx.fill()
    }
    this.jets = this.jets.filter((j) => j.life > 0)
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, TAU)
}
