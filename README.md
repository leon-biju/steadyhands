# steadyhands
Made for Hacktoberfest '26 at university of Southampton

Start the project with `npx vite`

- Game: http://localhost:5173 (allow camera access)
- Game with the mouse: http://localhost:5173/?input=mouse (left click = pinch, right click = fist, hold Space = second hand)
- Hand tracking + calibration + placeholder test panel: http://localhost:5173/input-debug.html (allow camera access)
- Same page with the mouse: http://localhost:5173/input-debug.html?input=mouse

Our project, SteadyHands, made a game where the goal is to navigate managing a nuclear FUSION reactor’s temperature and pressure to avoid a nuclear meltdown using hand symbols. Our project uses computer vision to track the users hand symbols through their webcam and the current position of them. During this, the user encounters many obstacles and unexpected events. To run it, clone the project from GitHub, run `npm install`, then `npx vite` (or `npm run dev`) and open localhost in a desktop browser.

Built with TypeScript, Vite and MediaPipe Hand Landmarker, with plain DOM/CSS and Canvas 2D for the game. Video stays on your device and is never uploaded.
