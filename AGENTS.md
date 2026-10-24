# Steadyhands
 
Browser game: keep a fusion reactor from exploding using webcam hand tracking, while juggling more and more conflicting goals. Built by two people in a single day.
 
## Stack
TypeScript, Vite, PixiJS (2D), MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`). Desktop browsers only.

## Interface
Currently lives on the debug page (`/input-debug.html`, `src/input/debug.ts`) until it's wired into `main.ts`.
- Full-screen reactor control panel.
- Two floating hands on top of it, left in blue and right in orange, drawn from the tracked skeleton, each with a cursor ring that fills as you pinch.
- Small mirrored webcam window in the top-right corner, with the skeleton drawn on top.
- Flow: calibration screen (show right hand, then left, then pinch with both; Enter = one-handed) → reactor panel.
- Buttons are hold-to-activate: put a hand on it, make the gesture, hold 3s, get a message.
- Mouse mode (`?input=mouse`) skips calibration: left click = pinch, right click = fist, hold Space = second hand.
 
## Structure and ownership
- `src/shared/types.ts`: the `InputFrame` / `HandState` contract. Don't change without asking. Coordinates are 0..1 across the screen (play area), already mirrored.
- `src/main.ts`: game loop and input provider switch (`?input=mouse` or `?input=hands`). Shared; keep edits minimal. To hook up input, copy the flow from `src/input/debug.ts` (start input → calibration → game, draw `HandLayer` and `WebcamView` every frame).
- `src/input/` (branch `handtracking`):
  - `handTracker.ts`: webcam + MediaPipe, smoothing, dropout grace, camera → screen mapping
  - `gestures.ts`: pinch / open / fist / point classification, `cursor()` helper
  - `mouseProvider.ts`: mouse fallback
  - `overlay.ts`: floating hands (`HandLayer`, `drawHands`) and webcam skeleton
  - `webcamView.ts`: top-right webcam window
  - `calibration.ts`: start-of-game calibration, auto-fixes swapped left/right
  - `holdButton.ts`: `HoldButton`, turns any DOM element into a hand hold button
  - `demoPanel.ts/.css`: PLACEHOLDER reactor panel with fake buttons; delete once `src/game` has the real UI
  - `debug.ts` + `/input-debug.html`: the full input flow (calibration → placeholder panel, floating hands, webcam window), H toggles live numbers
  - `config.ts`: all input tuning numbers
- `src/game/`: reactor sim, goals, scenarios, rendering, UI (branch `game`).
- `public/mediapipe/`: bundled WASM and hand model so tracking works offline.
- Only edit files in the folder that matches the current branch.
## Features
- Gestures: pinch to hold, open palm to hover, fist to clamp, two-handed holds
- Fingertip-push virtual buttons, hold-to-confirm, safety covers
- Reactor sim: temperature, plasma stability, meltdown meter
- Conflicting goals as separate meters (power vs safety, cooling vs staying lit, contradictory orders)
- Staged scenarios, random events (coolant leak, coil failure, sensor glitch, etc.)
- Calibration screen, floating hands, webcam window, mouse fallback
- Scoring and fail states (meltdown, fired, blackout)
## Rules
- Game code reads only `InputFrame`, never MediaPipe directly. Use `HoldButton` for hand-pressable buttons.
- Put tuning numbers in `input/config.ts` or `game/config.ts`, not inline.
- Allow tracking dropouts a 0.5s grace period; keep gestures forgiving.
- Video stays on the device; never upload or store frames.
- Favour simple, working code over abstraction. We have a 4-hour deadline.
