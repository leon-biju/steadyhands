// Tuning numbers for hand tracking and gestures.

export const INPUT_CONFIG = {
  // Camera
  cameraWidth: 640,
  cameraHeight: 480,

  // MediaPipe (files live in public/mediapipe so it works offline)
  wasmPath: '/mediapipe/wasm',
  modelPath: '/mediapipe/hand_landmarker.task',
  numHands: 2,
  minDetectionConfidence: 0.5,
  minPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,

  // MediaPipe labels handedness as if the image were mirrored. Our webcam frames
  // aren't, so labels come out swapped. Flip this if left/right look backwards.
  swapHandedness: true,

  // Keep a lost hand "tracked" for this long so gestures survive dropouts.
  dropoutGraceMs: 500,

  // Smoothing: 0..1, higher = snappier but jitterier.
  smoothing: 0.5,

  // Pinch, as thumb-index distance divided by hand size. Hysteresis keeps it from flickering.
  pinchEnter: 0.35,
  pinchExit: 0.5,
  // pinchStrength maps this distance range onto 1..0.
  pinchStrengthMin: 0.25,
  pinchStrengthMax: 1.0,

  // A finger counts as extended when wrist->tip is this many times wrist->pip.
  fingerExtendedRatio: 1.15,

  // A new pose has to hold this long before the gesture switches.
  gestureStableMs: 80,
}
