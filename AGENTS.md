# Steadyhands
 
Browser game: keep a fusion reactor from exploding using webcam hand tracking, while juggling more and more conflicting goals. Built by two people in a single day.
 
## Stack
TypeScript, Vite, PixiJS (2D), MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`). Desktop browsers only.
 
## Structure and ownership
- `src/shared/types.ts`: the `InputFrame` / `HandState` contract. Don't change without asking.
- `src/main.ts`: game loop and input provider switch (`?input=mouse` or `?input=hands`). Shared; keep edits minimal.
- `src/input/`: hand tracking, gestures, virtual buttons, calibration (branch `handtracking`).
- `src/game/`: reactor sim, goals, scenarios, rendering, UI (branch `game`).
- Only edit files in the folder that matches the current branch.
## Features
- Gestures: pinch to hold, open palm to hover, fist to clamp, two-handed holds
- Fingertip-push virtual buttons, hold-to-confirm, safety covers
- Reactor sim: temperature, plasma stability, meltdown meter
- Conflicting goals as separate meters (power vs safety, cooling vs staying lit, contradictory orders)
- Staged scenarios, random events (coolant leak, coil failure, sensor glitch, etc.)
- Calibration screen, hand skeleton overlay, mouse fallback
- Scoring and fail states (meltdown, fired, blackout)
## Rules
- Game code reads only `InputFrame`, never MediaPipe directly.
- Put tuning numbers in `input/config.ts` or `game/config.ts`, not inline.
- Allow tracking dropouts a 0.5s grace period; keep gestures forgiving.
- Video stays on the device; never upload or store frames.
- Favour simple, working code over abstraction. We have a 4-hour deadline.
