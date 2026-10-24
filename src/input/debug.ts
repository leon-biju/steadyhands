// Standalone page for testing hand tracking: /input-debug.html (?input=mouse for the fallback).
import type { HandState } from '../shared/types'
import { HandTracker, createInputProvider, drawHands } from './index'

const stage = document.getElementById('stage')!
const canvas = document.getElementById('overlay') as HTMLCanvasElement
const hud = document.getElementById('hud')!
const ctx = canvas.getContext('2d')!

const input = createInputProvider(stage)

function fmt(h: HandState): string {
  if (!h.tracked) return `${h.side.padEnd(5)}  --`
  return [
    h.side.padEnd(5),
    h.gesture.padEnd(5),
    `${(h.gestureMs / 1000).toFixed(1)}s`.padStart(6),
    `pinch ${h.pinchStrength.toFixed(2)}`,
    `size ${h.size.toFixed(2)}`,
    `(${h.pointer.x.toFixed(2)}, ${h.pointer.y.toFixed(2)})`,
    h.lostMs > 0 ? `LOST ${Math.round(h.lostMs)}ms` : '',
  ].join('  ')
}

function render() {
  requestAnimationFrame(render)
  const r = stage.getBoundingClientRect()
  if (canvas.width !== r.width || canvas.height !== r.height) {
    canvas.width = r.width
    canvas.height = r.height
  }
  const frame = input.getFrame()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawHands(ctx, frame)

  const both = frame.left.pinching && frame.right.pinching
  const fps = input instanceof HandTracker ? `  ${input.fps} fps` : ''
  hud.textContent = [`source: ${frame.source}${fps}`, fmt(frame.left), fmt(frame.right), both ? 'TWO-HANDED PINCH' : ''].join('\n')
}

input
  .start()
  .then(() => {
    if (input instanceof HandTracker) stage.prepend(input.video)
    render()
  })
  .catch((e: Error) => {
    hud.innerHTML = `<span id="error">${e.message}</span>`
    console.error(e)
  })
