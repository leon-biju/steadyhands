import type { Gesture, HandState, Point } from '../shared/types'
import { INPUT_CONFIG as C } from './config'

// MediaPipe hand landmark indices
export const WRIST = 0
export const THUMB_TIP = 4
export const INDEX_TIP = 8
export const MIDDLE_MCP = 9

// [pip, tip] for index, middle, ring, pinky
const FINGERS: [number, number][] = [
  [6, 8],
  [10, 12],
  [14, 16],
  [18, 20],
]

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function handSize(lm: Point[]): number {
  return dist(lm[WRIST], lm[MIDDLE_MCP])
}

// Thumb-index distance relative to hand size, so it works near or far from the camera.
export function pinchRatio(lm: Point[]): number {
  return dist(lm[THUMB_TIP], lm[INDEX_TIP]) / Math.max(handSize(lm), 1e-6)
}

export function pinchStrength(ratio: number): number {
  const t = (C.pinchStrengthMax - ratio) / (C.pinchStrengthMax - C.pinchStrengthMin)
  return Math.min(1, Math.max(0, t))
}

function extendedFingers(lm: Point[]): boolean[] {
  const wrist = lm[WRIST]
  return FINGERS.map(([pip, tip]) => dist(wrist, lm[tip]) > dist(wrist, lm[pip]) * C.fingerExtendedRatio)
}

// Raw per-frame pose, before debouncing. wasPinching gives pinch hysteresis.
export function classify(lm: Point[], wasPinching: boolean): { gesture: Gesture; pinching: boolean } {
  const ratio = pinchRatio(lm)
  const pinching = ratio < (wasPinching ? C.pinchExit : C.pinchEnter)
  if (pinching) return { gesture: 'pinch', pinching }

  const ext = extendedFingers(lm)
  const count = ext.filter(Boolean).length
  if (count === 4) return { gesture: 'open', pinching }
  if (count === 0) return { gesture: 'fist', pinching }
  if (ext[0] && count === 1) return { gesture: 'point', pinching }
  return { gesture: 'none', pinching }
}

// Where a hand is "aiming": the pinch point while pinching, otherwise the index fingertip.
export function cursor(hand: HandState): Point {
  return hand.pinching ? hand.pinchPoint : hand.pointer
}
