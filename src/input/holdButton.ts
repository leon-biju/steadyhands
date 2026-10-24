import type { Gesture, InputFrame } from '../shared/types'
import { INPUT_CONFIG as C } from './config'
import { cursor } from './gestures'

export interface HoldButtonOptions {
  // Gesture the hand(s) must make while over the button.
  gesture: Gesture
  // How many hands must be on it at once.
  hands: 1 | 2
  holdMs?: number
  onHold: () => void
}

// Turns any DOM element into a hold-to-activate button for hands.
// Sets --progress (0..1) on the element and toggles .hover / .holding / .done classes.
export class HoldButton {
  progress = 0
  private heldMs = 0
  private releasedMs = 0
  private fired = false
  readonly el: HTMLElement
  private opts: HoldButtonOptions

  constructor(el: HTMLElement, opts: HoldButtonOptions) {
    this.el = el
    this.opts = opts
  }

  update(frame: InputFrame, dt: number) {
    const r = this.el.getBoundingClientRect()
    const pad = C.buttonPaddingPx
    const over = [frame.left, frame.right].filter((hand) => {
      if (!hand.tracked) return false
      const p = cursor(hand)
      const x = p.x * window.innerWidth
      const y = p.y * window.innerHeight
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
    })
    const holding = over.filter((hand) => hand.gesture === this.opts.gesture).length >= this.opts.hands
    const holdMs = this.opts.holdMs ?? C.holdMs

    if (holding) {
      this.releasedMs = 0
      if (!this.fired) {
        this.heldMs += dt
        if (this.heldMs >= holdMs) {
          this.fired = true
          this.opts.onHold()
        }
      }
    } else {
      // Short wobbles don't reset progress.
      this.releasedMs += dt
      if (this.releasedMs > C.holdReleaseGraceMs) {
        this.heldMs = 0
        this.fired = false
      }
    }

    this.progress = Math.min(1, this.heldMs / holdMs)
    this.el.style.setProperty('--progress', this.progress.toFixed(3))
    this.el.classList.toggle('hover', over.length > 0)
    this.el.classList.toggle('holding', holding && !this.fired)
    this.el.classList.toggle('done', this.fired)
  }
}
