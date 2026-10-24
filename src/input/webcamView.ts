import { INPUT_CONFIG as C } from './config'
import type { HandTracker } from './handTracker'
import { drawCameraSkeleton } from './overlay'

// Small mirrored webcam preview in the top-right corner with the tracked skeleton on top.
// The video is only shown locally, never uploaded or stored.
export class WebcamView {
  readonly el = document.createElement('div')
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private label = document.createElement('div')
  private tracker: HandTracker

  constructor(tracker: HandTracker, parent: HTMLElement = document.body) {
    this.tracker = tracker
    this.el.className = 'webcam-view'
    this.el.style.width = `${C.webcamWidth}px`
    this.el.style.height = `${C.webcamHeight}px`
    this.canvas.width = C.webcamWidth
    this.canvas.height = C.webcamHeight
    this.label.className = 'webcam-label'
    this.el.append(tracker.video, this.canvas, this.label)
    parent.appendChild(this.el)
    // Re-parenting can pause the video in some browsers.
    tracker.video.play().catch(() => {})
  }

  draw() {
    const { left, right } = this.tracker.getFrame()
    this.ctx.clearRect(0, 0, C.webcamWidth, C.webcamHeight)
    drawCameraSkeleton(this.ctx, this.tracker.cameraLandmarks, C.webcamWidth, C.webcamHeight)
    const count = [left, right].filter((h) => h.tracked && h.lostMs === 0).length
    this.label.textContent = `CAM · ${count} hand${count === 1 ? '' : 's'} · ${this.tracker.fps} fps`
  }
}
