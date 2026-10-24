import type { HandState, InputFrame } from '../shared/types'
import { INPUT_CONFIG as C } from './config'
import type { HandTracker } from './handTracker'

export interface CalibrationResult {
  // False if the player chose one-handed mode.
  twoHands: boolean
}

interface Step {
  title: string
  sub: string
  holdMs: number
  check: (f: InputFrame) => boolean
  onDone?: (f: InputFrame) => void
}

const visible = (h: HandState) => h.tracked && h.lostMs === 0

// Start-of-game screen: walks the player through showing their hands so we know
// tracking works, fixes swapped left/right, and checks pinching.
// Call update() every frame; it returns the result once finished.
export class Calibration {
  readonly el = document.createElement('div')
  private tracker: HandTracker
  private steps: Step[]
  private index = 0
  private heldMs = 0
  private doneMs = 0
  private last = performance.now()
  private twoHands = true
  private titleEl: HTMLElement
  private subEl: HTMLElement
  private stepEl: HTMLElement
  private barEl: HTMLElement
  private hintEl: HTMLElement

  constructor(tracker: HandTracker, parent: HTMLElement = document.body) {
    this.tracker = tracker
    this.steps = [
      {
        title: 'Raise your RIGHT hand',
        sub: 'Open palm, facing the camera',
        holdMs: C.calibStepMs,
        check: (f) => visible(f.left) !== visible(f.right) && (f.left.gesture === 'open' || f.right.gesture === 'open'),
        // Only one hand is up and it's the right one, so if we labelled it left, labels are swapped.
        onDone: (f) => {
          if (visible(f.left)) this.tracker.flipHandedness()
        },
      },
      {
        title: 'Now raise your LEFT hand too',
        sub: 'Both hands open in front of the camera',
        holdMs: C.calibStepMs,
        check: (f) => visible(f.left) && visible(f.right),
      },
      {
        title: 'Pinch with both hands',
        sub: 'Touch thumb and index finger together',
        holdMs: C.calibStepMs,
        check: (f) => (this.twoHands ? f.left.pinching && f.right.pinching : f.left.pinching || f.right.pinching),
      },
    ]

    this.el.className = 'calibration'
    this.el.innerHTML = `
      <div class="calibration-card">
        <div class="calibration-step"></div>
        <h1 class="calibration-title"></h1>
        <p class="calibration-sub"></p>
        <div class="calibration-bar"><div></div></div>
        <p class="calibration-hint"></p>
        <p class="calibration-keys">Enter: play one-handed</p>
      </div>`
    this.titleEl = this.el.querySelector('.calibration-title')!
    this.subEl = this.el.querySelector('.calibration-sub')!
    this.stepEl = this.el.querySelector('.calibration-step')!
    this.barEl = this.el.querySelector('.calibration-bar > div')!
    this.hintEl = this.el.querySelector('.calibration-hint')!
    parent.appendChild(this.el)
    window.addEventListener('keydown', this.onKey)
  }

  update(frame: InputFrame): CalibrationResult | null {
    const now = performance.now()
    const dt = now - this.last
    this.last = now

    if (this.index >= this.steps.length) {
      this.doneMs += dt
      if (this.doneMs < C.calibDoneMs) return null
      this.destroy()
      return { twoHands: this.twoHands }
    }

    const step = this.steps[this.index]
    // Fill while the pose is right, drain twice as fast when it isn't.
    this.heldMs = step.check(frame) ? this.heldMs + dt : Math.max(0, this.heldMs - dt * 2)
    if (this.heldMs >= step.holdMs) {
      step.onDone?.(frame)
      this.next()
    }

    const sizes = [frame.left, frame.right].filter(visible).map((h) => h.size)
    this.hintEl.textContent = sizes.some((s) => s < C.calibTooFarSize) ? 'Move a bit closer to the camera' : ''
    this.render()
    return null
  }

  private next() {
    this.index++
    this.heldMs = 0
    // One-handed players skip the "both hands" step.
    if (!this.twoHands && this.index === 1) this.index++
  }

  private render() {
    if (this.index >= this.steps.length) {
      this.stepEl.textContent = ''
      this.titleEl.textContent = 'Calibrated!'
      this.subEl.textContent = 'Keep the reactor alive.'
      this.barEl.style.width = '100%'
      return
    }
    const step = this.steps[this.index]
    const one = !this.twoHands
    this.stepEl.textContent = `STEP ${this.index + 1} / ${this.steps.length}${one ? ' · ONE-HANDED' : ''}`
    this.titleEl.textContent = one && this.index === 2 ? 'Pinch your fingers' : step.title
    this.subEl.textContent = step.sub
    this.barEl.style.width = `${(this.heldMs / step.holdMs) * 100}%`
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !this.twoHands) return
    this.twoHands = false
    if (this.index === 1) this.next()
  }

  private destroy() {
    window.removeEventListener('keydown', this.onKey)
    this.el.remove()
  }
}
