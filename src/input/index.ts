import type { InputProvider } from '../shared/types'
import { HandTracker } from './handTracker'
import { MouseProvider } from './mouseProvider'

export { HandTracker } from './handTracker'
export { MouseProvider } from './mouseProvider'
export { drawHands } from './overlay'

// Picks the provider from the URL: ?input=mouse or ?input=hands (default).
export function createInputProvider(target: HTMLElement | null = null): InputProvider {
  const mode = new URLSearchParams(location.search).get('input')
  return mode === 'mouse' ? new MouseProvider(target) : new HandTracker()
}
