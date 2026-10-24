import type { HandState, InputFrame, Point } from '../shared/types'
import { INPUT_CONFIG as C } from './config'
import { cursor } from './gestures'

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]
const PALM = [0, 1, 5, 9, 13, 17]

function strokeSkeleton(ctx: CanvasRenderingContext2D, lm: Point[], w: number, h: number) {
  ctx.beginPath()
  for (const [a, b] of BONES) {
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
  }
  ctx.stroke()
}

// Draws the two floating hands (skeleton, palm, cursor) in play-area coords.
// w/h are the canvas size in CSS px.
export function drawHands(ctx: CanvasRenderingContext2D, frame: InputFrame, w: number, h: number) {
  for (const hand of [frame.left, frame.right]) {
    if (hand.tracked) drawHand(ctx, hand, w, h)
  }
}

function drawHand(ctx: CanvasRenderingContext2D, hand: HandState, w: number, h: number) {
  const color = C.handColors[hand.side]
  // Fade while we're in the dropout grace period.
  const alpha = hand.lostMs > 0 ? 0.35 : 1
  const p = cursor(hand)
  const x = p.x * w
  const y = p.y * h
  // Shrink the drawn skeleton around the cursor so the ring stays on the fingertips.
  const k = C.handDrawScale
  const lm = hand.landmarks.map((q) => ({ ...q, x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k }))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (lm.length) {
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * 0.2
    ctx.beginPath()
    PALM.forEach((i, n) => (n ? ctx.lineTo(lm[i].x * w, lm[i].y * h) : ctx.moveTo(lm[i].x * w, lm[i].y * h)))
    ctx.fill()

    ctx.globalAlpha = alpha
    ctx.shadowColor = color
    ctx.shadowBlur = 16
    ctx.strokeStyle = color
    ctx.lineWidth = 7 * Math.max(k, 0.4)
    strokeSkeleton(ctx, lm, w, h)
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    for (const p of lm) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Cursor ring; fills in as the pinch closes.
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, 16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.globalAlpha = alpha * (0.3 + 0.7 * hand.pinchStrength)
  ctx.beginPath()
  ctx.arc(x, y, 16 * hand.pinchStrength, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = alpha
  ctx.font = 'bold 13px monospace'
  ctx.fillText(hand.gesture.toUpperCase(), x + 22, y - 12)
  ctx.restore()
}

// Full-screen transparent canvas on top of everything that shows the floating hands.
export class HandLayer {
  readonly canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!

  constructor(parent: HTMLElement = document.body) {
    this.canvas.className = 'hand-layer'
    parent.appendChild(this.canvas)
  }

  draw(frame: InputFrame) {
    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr)
      this.canvas.height = Math.round(h * dpr)
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.clearRect(0, 0, w, h)
    drawHands(this.ctx, frame, w, h)
  }
}

// Thin skeleton in camera coords, for the webcam window.
export function drawCameraSkeleton(ctx: CanvasRenderingContext2D, hands: Record<'left' | 'right', Point[]>, w: number, h: number) {
  ctx.lineWidth = 2
  for (const side of ['left', 'right'] as const) {
    if (!hands[side].length) continue
    ctx.strokeStyle = C.handColors[side]
    strokeSkeleton(ctx, hands[side], w, h)
  }
}
