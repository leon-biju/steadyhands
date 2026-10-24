// Random intrusive messages. They sit on top of the panel, block the controls under them
// and close with a pinch hold. How often / how many / how annoying comes from DIFFICULTY.
import type { InputFrame, Point } from '../shared/types.ts'
import { HoldButton } from '../input/holdButton.ts'
import { DIFFICULTY, POPUP, type Dist } from './config.ts'
import type { ReactorSim } from './sim.ts'
import type { GameUI } from './ui.ts'

// Box-Muller, clamped
function gauss(d: Dist) {
  const n = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
  return Math.min(d.max, Math.max(d.min, d.mean + n * d.sd))
}

interface Popup {
  el: HTMLElement
  btn: HoldButton
  x: number
  y: number
  vx: number
  vy: number
}

export class Popups {
  private list: Popup[] = []
  private timer = 0
  private sim: ReactorSim
  private ui: GameUI

  constructor(sim: ReactorSim, ui: GameUI) {
    this.sim = sim
    this.ui = ui
  }

  private get def() {
    return DIFFICULTY[this.sim.difficulty].popups
  }

  /** clears everything and restarts the spawn timer */
  reset() {
    for (const p of this.list) p.el.remove()
    this.list = []
    this.timer = gauss(this.def.every)
  }

  /** true if a screen point (0..1) is under a popup */
  covers(p: Point) {
    const x = p.x * window.innerWidth
    const y = p.y * window.innerHeight
    return this.list.some((q) => {
      const r = q.el.getBoundingClientRect()
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    })
  }

  /** dt in ms */
  update(frame: InputFrame, dt: number) {
    // clear on game over so they don't cover the restart button
    if (this.sim.state.melted && this.list.length) this.reset()
    if (!this.sim.started || this.sim.state.melted || this.ui.paused) return
    const d = this.def

    // easy only starts counting once the last one is closed
    if (d.maxOnScreen > 1 || this.list.length === 0) this.timer -= dt / 1000
    if (this.timer <= 0) {
      const n = Math.round(gauss(d.count))
      for (let i = 0; i < n && this.list.length < d.maxOnScreen; i++) this.spawn()
      this.timer = gauss(d.every)
    }

    for (const p of this.list) {
      if (d.drift) {
        const r = p.el.getBoundingClientRect()
        p.x += p.vx * (dt / 1000)
        p.y += p.vy * (dt / 1000)
        if (p.x < 0 || p.x + r.width > window.innerWidth) p.vx *= -1
        if (p.y < 0 || p.y + r.height > window.innerHeight) p.vy *= -1
        this.place(p)
      }
      p.btn.update(frame, dt)
    }
  }

  private spawn() {
    const d = this.def
    const el = document.createElement('div')
    el.className = 'popup'
    el.style.width = `${POPUP.width}px`
    el.innerHTML = `
      <div class="popup-head"><span>⚠ Notice</span><i>×</i></div>
      <p></p>
      <div class="popup-close">Pinch to close</div>`
    el.querySelector('p')!.textContent = POPUP.text[Math.floor(Math.random() * POPUP.text.length)]
    document.body.appendChild(el)

    const w = el.offsetWidth
    const h = el.offsetHeight
    let x = Math.random() * (window.innerWidth - w)
    let y = Math.random() * (window.innerHeight - h)
    if (Math.random() < d.onControlsChance) {
      const target = document.querySelector(Math.random() < 0.5 ? '.lever-body' : '.vent-guard')
      if (target) {
        const r = target.getBoundingClientRect()
        x = r.left + r.width / 2 - w / 2 + (Math.random() - 0.5) * 60
        y = r.top + r.height / 2 - h / 2 + (Math.random() - 0.5) * 60
      }
    }
    const a = Math.random() * Math.PI * 2
    const p: Popup = {
      el,
      x: Math.min(window.innerWidth - w, Math.max(0, x)),
      y: Math.min(window.innerHeight - h, Math.max(0, y)),
      vx: Math.cos(a) * d.drift,
      vy: Math.sin(a) * d.drift,
      btn: new HoldButton(el, { gesture: 'pinch', hands: 1, holdMs: d.closeMs, onHold: () => this.close(p) }),
    }
    this.place(p)
    this.list.push(p)
  }

  private place(p: Popup) {
    p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
  }

  private close(p: Popup) {
    p.el.remove()
    this.list = this.list.filter((q) => q !== p)
  }
}
