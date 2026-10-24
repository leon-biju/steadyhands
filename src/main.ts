import { startGame } from './game/index.ts'
import { DifficultyPicker } from './game/difficulty.ts'
import { ChargeSound } from './game/sounds.ts'
import type { InputFrame } from './shared/types.ts'
import { Calibration, HandLayer, HandTracker, HoldButton, WebcamView, createInputProvider, showInputError } from './input/index.ts'
import { cursor } from './input/gestures.ts'
import { INPUT_CONFIG as C } from './input/config.ts'

const root = document.querySelector<HTMLDivElement>('#app')!
const game = startGame(root)

// dev only: poke the game from the browser console, e.g. game.sim.state.temperature = 180
if (import.meta.env.DEV) Object.assign(window, { game })

const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!

// Hand controls for the game UI: pinch the coolant handle and drag it, pinch the vent button
// to hold it open, hold a pinch on the Pause / Reset / Restart buttons.
function setupHandControls() {
  const leverBody = $('.lever-body')
  const slot = $('.lever-slot')
  const ventBtn = $('.vent-btn')

  const inside = (el: HTMLElement, p: { x: number; y: number }) => {
    const r = el.getBoundingClientRect()
    const pad = C.buttonPaddingPx
    const x = p.x * window.innerWidth
    const y = p.y * window.innerHeight
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
  }

  const holdButtons = ['pause', 'reset', 'restart'].map(
    (act) => new HoldButton($(`[data-act="${act}"]`), { gesture: 'pinch', hands: 1, onHold: () => $(`[data-act="${act}"]`).click() }),
  )

  let leverHand: 'left' | 'right' | null = null

  return (frame: InputFrame, dt: number) => {
    // popups block whatever is under them
    const hands = [frame.left, frame.right].filter((h) => !game.popups.covers(h.pinchPoint))

    // lever: grabbed by a pinch on the handle, follows that hand until it lets go
    if (leverHand && !(frame[leverHand].tracked && frame[leverHand].pinching && hands.includes(frame[leverHand]))) leverHand = null
    if (!leverHand) {
      const grab = hands.find((h) => h.tracked && h.pinching && inside(leverBody, h.pinchPoint))
      if (grab) leverHand = grab.side
    }
    if (leverHand) {
      const r = slot.getBoundingClientRect()
      game.ui.setLever((frame[leverHand].pinchPoint.y * window.innerHeight - r.top) / r.height)
    } else {
      game.ui.setLever(null)
    }
    leverBody.classList.toggle('is-hover', hands.some((h) => h.tracked && inside(leverBody, cursor(h))))

    // vent: open while a hand pinches the button
    const venting = hands.some((h) => h.tracked && h.pinching && inside(ventBtn, h.pinchPoint))
    if (venting) game.ui.press('vent')
    else game.ui.release('vent')
    ventBtn.classList.toggle('is-hover', hands.some((h) => h.tracked && inside(ventBtn, cursor(h))))

    for (const b of holdButtons) {
      if (b.el.offsetParent !== null) b.update(frame, dt)
    }
  }
}

async function startInput() {
  const input = createInputProvider()
  try {
    await input.start()
  } catch (e) {
    showInputError((e as Error).message)
    return
  }

  const hands = new HandLayer()
  const webcam = input instanceof HandTracker ? new WebcamView(input) : null
  let calibration = input instanceof HandTracker ? new Calibration(input) : null
  let picker: DifficultyPicker | null = calibration ? null : new DifficultyPicker()
  let controls: ReturnType<typeof setupHandControls> | null = null
  const calibSounds = new ChargeSound()
  let last = performance.now()

  const tick = (now: number) => {
    requestAnimationFrame(tick)
    const dt = now - last
    last = now
    const frame = input.getFrame()

    if (calibration && calibration.update(frame)) {
      calibration = null
      calibSounds.stop()
      picker = new DifficultyPicker()
    }
    if (calibration) calibSounds.update(calibration.charge, calibration.charging, calibration.stepsDone, C.calibStepMs)
    const level = picker?.update(frame, dt)
    if (level) {
      picker = null
      game.begin(level)
      controls = setupHandControls()
    }
    // keyboard still works as a fallback, so only take over the lever once the game starts
    controls?.(frame, dt)
    if (controls) game.popups.update(frame, dt)
    hands.draw(frame)
    webcam?.draw()
  }
  requestAnimationFrame(tick)
}

startInput()
