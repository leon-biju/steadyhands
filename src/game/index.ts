import './ui.css'
import { ReactorSim, levelOf } from './sim.ts'
import { ReactorView } from './reactor.ts'
import { createUI, type GameUI } from './ui.ts'
import { Popups } from './popups.ts'
import type { Difficulty } from './config.ts'
import { GameSounds } from './sounds.ts'

export function startGame(root: HTMLElement): { sim: ReactorSim; ui: GameUI; popups: Popups; begin(d: Difficulty): void } {
  const sim = new ReactorSim()
  const ui = createUI(root, sim)
  const popups = new Popups(sim, ui)
  ui.onRestart = () => popups.reset()
  const view = new ReactorView(ui.canvas)
  const sounds = new GameSounds()

  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ui.update(dt)
    if (!ui.paused) sim.update(dt)
    view.render(ui.paused ? dt * 0.15 : dt, sim.visuals())
    const s = sim.state
    const critical = s.melted || levelOf('temperature', s.temperature) === 'crit' || levelOf('pressure', s.pressure) === 'crit'
    sounds.update(dt, sim.controls.vent && !s.melted && !ui.paused, critical && sim.started && !ui.paused)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  const begin = (d: Difficulty) => {
    sim.difficulty = d
    sim.reset()
    sim.started = true
    popups.reset()
  }
  return { sim, ui, popups, begin }
}
