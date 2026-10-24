import type { InputProvider } from '../shared/types'
import { HandTracker } from './handTracker'
import './input.css'
import { MouseProvider } from './mouseProvider'

export { Calibration } from './calibration'
export type { CalibrationResult } from './calibration'
export { HandTracker } from './handTracker'
export { HoldButton } from './holdButton'
export { MouseProvider } from './mouseProvider'
export { HandLayer, drawHands } from './overlay'
export { WebcamView } from './webcamView'

// Picks the provider from the URL: ?input=mouse or ?input=hands (default).
export function createInputProvider(target: HTMLElement | null = null): InputProvider {
  const mode = new URLSearchParams(location.search).get('input')
  return mode === 'mouse' ? new MouseProvider(target) : new HandTracker()
}

// Full-screen error with a link to the mouse fallback.
export function showInputError(message: string) {
  const el = document.createElement('div')
  el.className = 'input-error'
  el.innerHTML = `<div></div><a href="?input=mouse">Play with the mouse instead</a>`
  el.firstElementChild!.textContent = message
  document.body.appendChild(el)
}
