import './ui.css'
import { ReactorSim } from './sim.ts'
import { ReactorView } from './reactor.ts'
import { createUI, type GameUI } from './ui.ts'
import { Popups } from './popups.ts'
import { Narrator } from './narrator.ts'
import type { Difficulty } from './config.ts'

export function startGame(root: HTMLElement): { sim: ReactorSim; ui: GameUI; popups: Popups; narrator: Narrator; begin(d: Difficulty): void } {
  const sim = new ReactorSim()
  const ui = createUI(root, sim)
  const popups = new Popups(sim, ui)
  ui.onRestart = () => popups.reset()
  const narrator = new Narrator(sim)
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
  const begin = (d: Difficulty) => {
    sim.difficulty = d
    sim.reset()
    sim.started = true
    popups.reset()
  }
  return { sim, ui, popups, narrator, begin }
}
