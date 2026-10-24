// PLACEHOLDER reactor interface for testing input until the game branch lands.
// The real reactor UI belongs in src/game; delete this file (and demoPanel.css) then.
import type { InputFrame } from '../shared/types'
import './demoPanel.css'
import { HoldButton } from './holdButton'

export interface DemoPanel {
  update(frame: InputFrame, dt: number): void
}

export function mountDemoPanel(parent: HTMLElement, opts: { twoHands: boolean }): DemoPanel {
  parent.innerHTML = `
    <div class="demo-panel">
      <header class="demo-header">REACTOR CONTROL · UNIT 7</header>
      <section class="demo-gauges">
        <div class="demo-gauge"><span>CORE TEMP</span><div class="demo-meter"><div data-gauge="temp"></div></div></div>
        <div class="demo-gauge"><span>PLASMA STABILITY</span><div class="demo-meter"><div data-gauge="plasma"></div></div></div>
        <div class="demo-gauge"><span>POWER OUTPUT</span><div class="demo-meter"><div data-gauge="power"></div></div></div>
      </section>
      <section class="demo-core"><div class="demo-core-ring"><div class="demo-core-glow"></div></div></section>
      <section class="demo-buttons">
        <button class="hold-button demo-btn" data-btn="vent">VENT PLASMA<small>pinch &amp; hold 3s</small></button>
        <button class="hold-button demo-btn" data-btn="flush">COOLANT FLUSH<small>fist &amp; hold 3s</small></button>
        <button class="hold-button demo-btn demo-btn-danger" data-btn="scram">EMERGENCY SCRAM<small>${opts.twoHands ? 'both hands pinch 3s' : 'pinch &amp; hold 3s'}</small></button>
      </section>
      <div class="demo-toast"></div>
    </div>`

  const toast = parent.querySelector<HTMLElement>('.demo-toast')!
  let toastTimer = 0
  const showMessage = (text: string) => {
    toast.textContent = text
    toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2500)
  }

  const btn = (name: string) => parent.querySelector<HTMLElement>(`[data-btn="${name}"]`)!
  const buttons = [
    new HoldButton(btn('vent'), { gesture: 'pinch', hands: 1, onHold: () => showMessage('Plasma vented. Pressure nominal.') }),
    new HoldButton(btn('flush'), { gesture: 'fist', hands: 1, onHold: () => showMessage('Coolant flushed.') }),
    new HoldButton(btn('scram'), {
      gesture: 'pinch',
      hands: opts.twoHands ? 2 : 1,
      onHold: () => showMessage('SCRAM engaged! (not really, this is a demo)'),
    }),
  ]

  // Fake wobbling gauges so the panel feels alive.
  const gauges = [...parent.querySelectorAll<HTMLElement>('[data-gauge]')]
  let t = 0

  return {
    update(frame, dt) {
      t += dt / 1000
      gauges.forEach((g, i) => (g.style.width = `${55 + 30 * Math.sin(t * (0.7 + i * 0.4) + i)}%`))
      for (const b of buttons) b.update(frame, dt)
    },
  }
}
