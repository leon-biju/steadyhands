// Standalone page for testing hand tracking: /input-debug.html (?input=mouse for the fallback).
// Flow: start input -> calibration (hands only) -> placeholder reactor panel.
// Floating hands and the webcam window sit on top of everything; press H to toggle live numbers.
import type { HandState } from '../shared/types'
import type { CalibrationResult } from './index'
import { Calibration, HandLayer, HandTracker, WebcamView, createInputProvider, showInputError } from './index'
import { type DemoPanel, mountDemoPanel } from './demoPanel'

const app = document.getElementById('app')!
const hud = document.getElementById('hud')!

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

async function main() {
  const input = createInputProvider()
  try {
    await input.start()
  } catch (e) {
    hud.remove()
    showInputError((e as Error).message)
    return
  }

  const hands = new HandLayer()
  const webcam = input instanceof HandTracker ? new WebcamView(input) : null
  let calibration = input instanceof HandTracker ? new Calibration(input) : null
  let panel: DemoPanel | null = calibration ? null : mountDemoPanel(app, { twoHands: true })
  let last = performance.now()

  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') hud.hidden = !hud.hidden
  })

  const tick = (now: number) => {
    requestAnimationFrame(tick)
    const dt = now - last
    last = now
    const frame = input.getFrame()

    if (calibration) {
      const result: CalibrationResult | null = calibration.update(frame)
      if (result) {
        calibration = null
        panel = mountDemoPanel(app, result)
      }
    }
    panel?.update(frame, dt)
    hands.draw(frame)
    webcam?.draw()

    if (!hud.hidden) {
      const both = frame.left.pinching && frame.right.pinching
      hud.textContent = [`source: ${frame.source}  (H to hide)`, fmt(frame.left), fmt(frame.right), both ? 'TWO-HANDED PINCH' : ''].join('\n')
    }
  }
  requestAnimationFrame(tick)
}

main()
