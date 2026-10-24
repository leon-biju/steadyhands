import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { Gesture, HandSide, HandState, InputFrame, InputProvider, Point } from '../shared/types'
import { INPUT_CONFIG as C } from './config'
import { INDEX_TIP, THUMB_TIP, classify, handSize, pinchRatio, pinchStrength } from './gestures'

export function emptyHand(side: HandSide): HandState {
  return {
    side,
    tracked: false,
    lostMs: 0,
    pointer: { x: 0.5, y: 0.5 },
    pinchPoint: { x: 0.5, y: 0.5 },
    gesture: 'none',
    gestureMs: 0,
    pinching: false,
    pinchStrength: 0,
    size: 0,
    landmarks: [],
  }
}

interface Track {
  state: HandState
  lastSeen: number
  gestureSince: number
  pendingGesture: Gesture
  pendingSince: number
  rawPinching: boolean
}

function newTrack(side: HandSide): Track {
  return { state: emptyHand(side), lastSeen: 0, gestureSince: 0, pendingGesture: 'none', pendingSince: 0, rawPinching: false }
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// Camera coords -> play-area coords, stretching the inner reach box to the full screen.
function toPlayArea(p: Point): Point {
  return {
    x: (p.x - C.reachMarginX) / (1 - 2 * C.reachMarginX),
    y: (p.y - C.reachMarginY) / (1 - 2 * C.reachMarginY),
  }
}

// Webcam hand tracking via MediaPipe. Video frames are processed locally and never stored.
export class HandTracker implements InputProvider {
  readonly video = document.createElement('video')
  // Detections per second, for the debug view.
  fps = 0
  // Latest raw landmarks in camera coords (mirrored), for the webcam window.
  cameraLandmarks: Record<HandSide, Point[]> = { left: [], right: [] }
  swapHandedness = C.swapHandedness

  private landmarker: HandLandmarker | null = null
  private stream: MediaStream | null = null
  private rafId = 0
  private lastVideoTime = -1
  private fpsCount = 0
  private fpsWindowStart = 0
  private tracks = { left: newTrack('left'), right: newTrack('right') }
  private frame: InputFrame = { time: 0, source: 'hands', left: emptyHand('left'), right: emptyHand('right') }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not available. Use a desktop browser over http://localhost or https.')
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: C.cameraWidth, height: C.cameraHeight, facingMode: 'user' },
        audio: false,
      })
    } catch (e) {
      const name = (e as DOMException).name
      if (name === 'NotAllowedError') throw new Error('Camera permission denied. Allow camera access or use ?input=mouse.')
      if (name === 'NotFoundError') throw new Error('No camera found. Plug one in or use ?input=mouse.')
      throw new Error(`Could not open camera (${name}). Is another app using it?`)
    }

    this.video.srcObject = this.stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()

    const base = import.meta.env.BASE_URL
    const vision = await FilesetResolver.forVisionTasks(base + C.wasmPath.replace(/^\//, ''))
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: base + C.modelPath.replace(/^\//, ''), delegate },
      runningMode: 'VIDEO' as const,
      numHands: C.numHands,
      minHandDetectionConfidence: C.minDetectionConfidence,
      minHandPresenceConfidence: C.minPresenceConfidence,
      minTrackingConfidence: C.minTrackingConfidence,
    })
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, options('GPU'))
    } catch (e) {
      console.warn('GPU delegate failed, falling back to CPU', e)
      this.landmarker = await HandLandmarker.createFromOptions(vision, options('CPU'))
    }

    this.fpsWindowStart = performance.now()
    this.loop()
  }

  stop(): void {
    cancelAnimationFrame(this.rafId)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.landmarker?.close()
    this.landmarker = null
  }

  getFrame(): InputFrame {
    return this.frame
  }

  // Called by calibration when the user's hands come out labelled backwards.
  flipHandedness() {
    this.swapHandedness = !this.swapHandedness
    this.tracks = { left: newTrack('left'), right: newTrack('right') }
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop)
    const now = performance.now()
    if (this.landmarker && this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime
      this.detect(now)
    } else {
      // No new camera frame: still age out lost hands.
      this.updateTrack(this.tracks.left, null, now)
      this.updateTrack(this.tracks.right, null, now)
    }
    this.frame = { time: now, source: 'hands', left: { ...this.tracks.left.state }, right: { ...this.tracks.right.state } }

    this.fpsCount++
    if (now - this.fpsWindowStart >= 1000) {
      this.fps = this.fpsCount
      this.fpsCount = 0
      this.fpsWindowStart = now
    }
  }

  private detect(now: number) {
    const result = this.landmarker!.detectForVideo(this.video, now)
    const found: { side: HandSide; cam: Point[] }[] = result.landmarks.map((raw, i) => {
      const label = result.handedness[i]?.[0]?.categoryName ?? 'Right'
      const isLeftLabel = label === 'Left'
      const side: HandSide = isLeftLabel !== this.swapHandedness ? 'left' : 'right'
      return { side, cam: raw.map((p) => ({ x: 1 - p.x, y: p.y })) }
    })

    // Handedness sometimes flips so both hands get the same label: fall back to screen position.
    if (found.length === 2 && found[0].side === found[1].side) {
      found.sort((a, b) => a.cam[0].x - b.cam[0].x)
      found[0].side = 'left'
      found[1].side = 'right'
    }

    for (const side of ['left', 'right'] as const) {
      const cam = found.find((h) => h.side === side)?.cam ?? null
      this.cameraLandmarks[side] = cam ?? []
      this.updateTrack(this.tracks[side], cam && cam.map(toPlayArea), now)
    }
  }

  private updateTrack(t: Track, lm: Point[] | null, now: number) {
    const s = t.state
    if (!lm) {
      if (!s.tracked) return
      s.lostMs = now - t.lastSeen
      if (s.lostMs > C.dropoutGraceMs) {
        t.state = emptyHand(s.side)
        t.rawPinching = false
        t.pendingGesture = 'none'
      } else {
        // Keep holding the last gesture through the dropout.
        s.gestureMs = now - t.gestureSince
      }
      return
    }

    const wasTracked = s.tracked
    s.landmarks = wasTracked && s.landmarks.length === lm.length ? lm.map((p, i) => lerp(s.landmarks[i], p, C.smoothing)) : lm
    s.tracked = true
    s.lostMs = 0
    t.lastSeen = now

    const sm = s.landmarks
    s.pointer = sm[INDEX_TIP]
    s.pinchPoint = lerp(sm[THUMB_TIP], sm[INDEX_TIP], 0.5)
    s.size = handSize(sm)
    s.pinchStrength = pinchStrength(pinchRatio(sm))

    const raw = classify(sm, t.rawPinching)
    t.rawPinching = raw.pinching
    if (!wasTracked) {
      s.gesture = raw.gesture
      t.gestureSince = now
      t.pendingGesture = raw.gesture
    } else if (raw.gesture === s.gesture) {
      t.pendingGesture = raw.gesture
    } else if (raw.gesture !== t.pendingGesture) {
      t.pendingGesture = raw.gesture
      t.pendingSince = now
    } else if (now - t.pendingSince >= C.gestureStableMs) {
      s.gesture = raw.gesture
      t.gestureSince = now
    }
    s.pinching = s.gesture === 'pinch'
    s.gestureMs = now - t.gestureSince
  }
}
