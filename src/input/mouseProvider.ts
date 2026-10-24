import type { Gesture, HandState, InputFrame, InputProvider, Point } from '../shared/types'
import { emptyHand } from './handTracker'

// Mouse fallback. The mouse drives the right hand:
//   move = pointer, left button = pinch, right button = fist, otherwise open palm.
// Hold Space to also put the left hand at the cursor, pinching (for testing two-handed holds).
export class MouseProvider implements InputProvider {
  private pos: Point = { x: 0.5, y: 0.5 }
  private leftDown = false
  private rightDown = false
  private space = false
  private right = emptyHand('right')
  private left = emptyHand('left')
  private since = { left: 0, right: 0 }

  // Coordinates are normalized to this element (defaults to the whole window).
  private target: HTMLElement | null
  constructor(target: HTMLElement | null = null) {
    this.target = target
  }

  async start(): Promise<void> {
    window.addEventListener('mousemove', this.onMove)
    window.addEventListener('mousedown', this.onDown)
    window.addEventListener('mouseup', this.onUp)
    window.addEventListener('contextmenu', this.onContext)
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKey)
  }

  stop(): void {
    window.removeEventListener('mousemove', this.onMove)
    window.removeEventListener('mousedown', this.onDown)
    window.removeEventListener('mouseup', this.onUp)
    window.removeEventListener('contextmenu', this.onContext)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKey)
  }

  getFrame(): InputFrame {
    const now = performance.now()
    const gesture: Gesture = this.leftDown ? 'pinch' : this.rightDown ? 'fist' : 'open'
    this.right = this.hand(this.right, true, gesture, now)
    this.left = this.hand(this.left, this.space, 'pinch', now)
    return { time: now, source: 'mouse', left: this.left, right: this.right }
  }

  private hand(prev: HandState, tracked: boolean, gesture: Gesture, now: number): HandState {
    if (!tracked) return emptyHand(prev.side)
    if (!prev.tracked || prev.gesture !== gesture) this.since[prev.side] = now
    return {
      ...emptyHand(prev.side),
      tracked: true,
      pointer: this.pos,
      pinchPoint: this.pos,
      gesture,
      gestureMs: now - this.since[prev.side],
      pinching: gesture === 'pinch',
      pinchStrength: gesture === 'pinch' ? 1 : 0,
      size: 0.15,
    }
  }

  private onMove = (e: MouseEvent) => {
    const r = this.target?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    this.pos = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  private onDown = (e: MouseEvent) => {
    if (e.button === 0) this.leftDown = true
    if (e.button === 2) this.rightDown = true
  }
  private onUp = (e: MouseEvent) => {
    if (e.button === 0) this.leftDown = false
    if (e.button === 2) this.rightDown = false
  }
  private onContext = (e: Event) => e.preventDefault()
  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.space = e.type === 'keydown'
  }
}
