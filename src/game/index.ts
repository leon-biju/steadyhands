import './ui.css'
import { ReactorSim, levelOf } from './sim.ts'
import { ReactorView } from './reactor.ts'
import { createUI, type GameUI } from './ui.ts'
import { Popups } from './popups.ts'
import { Narrator } from './narrator.ts'
import { LIGHTS_OUT, type Difficulty } from './config.ts'
import { GameSounds } from './sounds.ts'
import { Minigames } from './minigames.ts'
import type { LightsOut } from './lightsOut.ts'
import type { Homer } from './homer.ts'

export function startGame(root: HTMLElement): { sim: ReactorSim; ui: GameUI; popups: Popups; narrator: Narrator; minigames: Minigames; lightsOut: LightsOut; homer: Homer; begin(d: Difficulty): void } {
  const sim = new ReactorSim()
  const ui = createUI(root, sim)
  const popups = new Popups(sim, ui)
  const minigames = new Minigames(sim, ui)
  ui.onRestart = () => {
    popups.reset()
    minigames.reset()
  }
  const narrator = new Narrator(sim)
  const view = new ReactorView(ui.canvas)
  const sounds = new GameSounds()

  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ui.update(dt)
    // the reactor slows down (but doesn't stop) while you're in a minigame
    if (!ui.paused) sim.update(minigames.active ? dt * LIGHTS_OUT.simSpeed : dt)
    view.render(ui.paused ? dt * 0.15 : dt, sim.visuals())
    const s = sim.state
    // no alarm over the win music
    const critical = !s.won && (s.melted || levelOf('temperature', s.temperature) === 'crit' || levelOf('pressure', s.pressure) === 'crit')
    sounds.update(dt, sim.controls.vent && !s.melted && !ui.paused, critical && sim.started && !ui.paused, s.won)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  const begin = (d: Difficulty) => {
    sim.difficulty = d
    sim.reset()
    sim.started = true
    popups.reset()
    minigames.reset()
  }
  return { sim, ui, popups, narrator, minigames, lightsOut: minigames.lightsOut, homer: minigames.homer, begin }
}
