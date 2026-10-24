# Steadyhands
 
Browser game: keep a fusion reactor from exploding using webcam hand tracking, while juggling more and more conflicting goals. Built by two people in a single day.
 
## Stack
TypeScript, Vite, MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`). No UI or rendering framework: the game is plain DOM + CSS, with Canvas 2D for the reactor core and the minigames (`requestAnimationFrame` loops). Audio is HTML `Audio` plus the browser's speech synthesis. Desktop browsers only.

## Interface
The real game runs from `index.html` / `src/main.ts`. `/input-debug.html` (`src/input/debug.ts`) is still around as a standalone input test page with a placeholder panel.
- Full-screen reactor control panel (`src/game/ui.ts`): gauges on the side rails, reactor core canvas in the middle, coolant lever and guarded vent button.
- Two floating hands on top of it, left in blue and right in orange, drawn from the tracked skeleton, each with a cursor ring that fills as you pinch.
- Small mirrored webcam window in the top-right corner, with the skeleton drawn on top.
- Flow: calibration screen (show right hand, then left, then pinch with both; Enter = one-handed) → difficulty picker (Easy / Hard) → MrBeast narrator intro → 2 minute shift → win / meltdown screen with restart. Mouse mode skips calibration.
- Pause / Reset / Restart, the narrator's Next button and popup close buttons are hold-to-activate (`HoldButton`): put a hand on it, pinch, hold. The coolant lever is pinched and dragged; the vent button is held open while pinched.
- Mouse mode (`?input=mouse`) skips calibration: left click = pinch, right click = fist, hold Space = second hand.
 
## Structure and ownership
- `src/shared/types.ts`: the `InputFrame` / `HandState` contract. Don't change without asking. Coordinates are 0..1 across the screen (play area), already mirrored.
- `src/main.ts`: starts the game, picks the input provider (`?input=mouse` or `?input=hands`) and runs the input loop: calibration → difficulty picker → narrator intro → game. Wires hand controls to the game UI (lever, vent, hold buttons) and draws `HandLayer` and `WebcamView` every frame. Shared; keep edits minimal.
- `src/input/` (branch `handtracking`):
  - `handTracker.ts`: webcam + MediaPipe, smoothing, dropout grace, camera → screen mapping
  - `gestures.ts`: pinch / open / fist / point classification, `cursor()` helper
  - `mouseProvider.ts`: mouse fallback
  - `overlay.ts`: floating hands (`HandLayer`, `drawHands`) and webcam skeleton
  - `webcamView.ts`: top-right webcam window
  - `calibration.ts`: start-of-game calibration, auto-fixes swapped left/right
  - `holdButton.ts`: `HoldButton`, turns any DOM element into a hand hold button
  - `demoPanel.ts/.css`: PLACEHOLDER reactor panel with fake buttons, only used by the debug page. The real UI is in `src/game`, so this can be deleted
  - `debug.ts` + `/input-debug.html`: the input flow on its own (calibration → placeholder panel, floating hands, webcam window), H toggles live numbers
  - `index.ts` / `input.css`: exports, `createInputProvider()`, `showInputError()`, styles
  - `config.ts`: all input tuning numbers
- `src/game/` (branch `game`):
  - `index.ts`: `startGame()`, the game loop; returns `sim`, `ui`, `popups`, `narrator`, `minigames`, `begin(difficulty)`
  - `sim.ts`: reactor sim (temperature, pressure, output, stability, hidden meltdown meter, score, win/melt)
  - `reactor.ts`: Canvas 2D reactor core renderer
  - `ui.ts` / `ui.css`: control panel, gauges, coolant lever, vent, end screen
  - `difficulty.ts`: Easy / Hard picker
  - `narrator.ts`: MrBeast intro and in-play one-liners (speech synthesis)
  - `popups.ts` + `popupMessages.json`: intrusive messages that block controls until closed with a pinch hold
  - `minigames.ts`: schedules the minigames; `lightsOut.ts` (dark screen, palm flashlight, fist on the breaker, freeze when something appears) and `homer.ts` (drag a donut to Homer)
  - `sounds.ts`: steam, alarm, calibration riser/ding, end music
  - `config.ts`: all game tuning numbers (sim, shift, difficulty, popups, narrator, sound, minigames)
- `src/assets/`: images, sounds and music. `src/counter.ts` and some template assets (`hero.png`, `typescript.svg`, `vite.svg`) are unused Vite leftovers.
- `public/mediapipe/`: bundled WASM and hand model so tracking works offline.
- Only edit files in the folder that matches the current branch.
## Features
Built:
- Gestures: pinch to hold, open palm to hover/flashlight, fist to clamp, point; two-handed holds
- Hold-to-confirm buttons, draggable coolant lever, hold-open vent button
- Reactor sim: temperature, pressure, grid output, stability, hidden meltdown meter, random pressure spikes and temperature jumps
- Two difficulties (Easy / Hard) that scale heat, instability, control strength and popup frequency
- 120 second shift with win (survive), meltdown (fail), and a score for staying near the power target
- Popups that block the controls until closed with a pinch hold
- Minigames, one each per shift: Lights Out and Homer
- MrBeast narrator with speech synthesis
- Calibration screen, floating hands, webcam window, mouse fallback
- Sound effects and end music

Not built (original ideas, see `mvp.md`): fingertip-push virtual buttons, safety covers, conflicting goal meters, staged scenarios and named random events (coolant leak, coil failure, sensor glitch), "fired" and "blackout" fail states, the unhelpful local model.

## Rules
- Game code reads only `InputFrame`, never MediaPipe directly. Use `HoldButton` for hand-pressable buttons.
- Put tuning numbers in `input/config.ts` or `game/config.ts`, not inline.
- Allow tracking dropouts a 0.5s grace period; keep gestures forgiving.
- Video stays on the device; never upload or store frames.
- Favour simple, working code over abstraction. We have a 4-hour deadline.
