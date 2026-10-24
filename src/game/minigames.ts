// Runs the minigames: each one happens once per shift, in random order, at a random time inside
// one of the SHIFT.minigameWindows. While one is up, controls and popups wait (see main.ts).
import type { InputFrame } from '../shared/types.ts'
import { SHIFT } from './config.ts'
import { LightsOut } from './lightsOut.ts'
import { Homer } from './homer.ts'
import type { ReactorSim } from './sim.ts'
import type { GameUI } from './ui.ts'

interface Minigame {
  active: boolean
  start(): void
  reset(): void
  update(frame: InputFrame, dt: number): void
}

export class Minigames {
  readonly lightsOut: LightsOut
  readonly homer: Homer
  private sim: ReactorSim
  private queue: { at: number; game: Minigame }[] = []

  constructor(sim: ReactorSim, ui: GameUI) {
    this.sim = sim
    this.lightsOut = new LightsOut(sim, ui)
    this.homer = new Homer(sim, ui)
  }

  get active() {
    return this.lightsOut.active || this.homer.active
  }

  /** new shift: stop anything running and roll new times */
  reset() {
    const games: Minigame[] = Math.random() < 0.5 ? [this.lightsOut, this.homer] : [this.homer, this.lightsOut]
    for (const g of games) g.reset()
    this.queue = games.map((game, i) => {
      const [a, b] = SHIFT.minigameWindows[i]
      return { at: a + Math.random() * (b - a), game }
    })
  }

  /** dt in ms */
  update(frame: InputFrame, dt: number) {
    const next = this.queue[0]
    if (next && !this.active && this.sim.started && !this.sim.over && this.sim.state.time >= next.at) {
      this.queue.shift()
      next.game.start()
    }
    this.lightsOut.update(frame, dt)
    this.homer.update(frame, dt)
  }
}
