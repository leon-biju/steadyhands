import { startGame } from './game/index.ts'

const game = startGame(document.querySelector<HTMLDivElement>('#app')!)

// dev only: poke the game from the browser console, e.g. game.sim.state.temperature = 180
if (import.meta.env.DEV) Object.assign(window, { game })
