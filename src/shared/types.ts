// Shared contract between src/input and src/game.
// Don't change without asking both people.

// Normalized coordinates: 0..1 across the camera view, origin top-left,
// already mirrored so moving your hand right moves x right on screen.
export interface Point {
  x: number
  y: number
}

export type HandSide = 'left' | 'right'

// 'none' = tracked but no clear pose; 'point' = index finger out, others curled.
export type Gesture = 'none' | 'open' | 'pinch' | 'fist' | 'point'

export interface HandState {
  side: HandSide
  // True while the hand is visible, and for a short grace period after a dropout.
  tracked: boolean
  // Ms since we last actually saw the hand (0 while visible).
  lostMs: number
  // Smoothed index fingertip, the main "cursor" for this hand.
  pointer: Point
  // Midpoint between thumb and index tips, where a pinch grabs.
  pinchPoint: Point
  gesture: Gesture
  // How long the current gesture has been held, in ms.
  gestureMs: number
  pinching: boolean
  // 0 = fingers apart, 1 = fully pinched.
  pinchStrength: number
  // Wrist-to-middle-knuckle distance in normalized units. Grows as the hand
  // moves toward the camera, useful for push detection.
  size: number
  // 21 MediaPipe landmarks (normalized, mirrored), empty when not tracked.
  landmarks: Point[]
}

export interface InputFrame {
  // performance.now() at the time of the frame.
  time: number
  source: 'hands' | 'mouse'
  left: HandState
  right: HandState
}

export interface InputProvider {
  start(): Promise<void>
  // Cheap to call every game tick; returns the latest state.
  getFrame(): InputFrame
  stop(): void
}
