import type { HandState, InputFrame } from '../shared/types'

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const COLORS = { left: '#4fc3f7', right: '#ffb74d' }

// Draws hand skeletons and pointers onto a 2D canvas covering the play area.
export function drawHands(ctx: CanvasRenderingContext2D, frame: InputFrame) {
  const { width: w, height: h } = ctx.canvas
  for (const hand of [frame.left, frame.right]) {
    if (hand.tracked) drawHand(ctx, hand, w, h)
  }
}

function drawHand(ctx: CanvasRenderingContext2D, hand: HandState, w: number, h: number) {
  const color = COLORS[hand.side]
  // Fade while we're in the dropout grace period.
  ctx.globalAlpha = hand.lostMs > 0 ? 0.35 : 1
  const lm = hand.landmarks

  if (lm.length) {
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    for (const [a, b] of BONES) {
      ctx.moveTo(lm[a].x * w, lm[a].y * h)
      ctx.lineTo(lm[b].x * w, lm[b].y * h)
    }
    ctx.stroke()
    ctx.fillStyle = '#fff'
    for (const p of lm) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Pointer ring; fills in as the pinch closes.
  const p = hand.pinching ? hand.pinchPoint : hand.pointer
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(p.x * w, p.y * h, 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.globalAlpha *= 0.3 + 0.7 * hand.pinchStrength
  ctx.beginPath()
  ctx.arc(p.x * w, p.y * h, 14 * hand.pinchStrength, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = color
  ctx.fillText(`${hand.side}: ${hand.gesture}`, p.x * w + 18, p.y * h - 10)
}
