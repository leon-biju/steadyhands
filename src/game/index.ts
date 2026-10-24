import './ui.css'
import { ReactorSim } from './sim.ts'
import { ReactorView } from './reactor.ts'
import { createUI, type GameUI } from './ui.ts'

export function startGame(root: HTMLElement): { sim: ReactorSim; ui: GameUI } {
  const sim = new ReactorSim()
  const ui = createUI(root, sim)
  const view = new ReactorView(ui.canvas)

  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ui.update(dt)
    if (!ui.paused) sim.update(dt)
    view.render(ui.paused ? dt * 0.15 : dt, sim.visuals())
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return { sim, ui }
}
