// All tuning numbers for the game UI and placeholder sim live here.

export type GaugeKey = 'temperature' | 'pressure' | 'output'

export interface GaugeDef {
  key: GaugeKey
  label: string
  code: string
  unit: string
  max: number
  /** scale label every N units */
  step: number
  decimals: number
  warn?: number
  crit?: number
  /** optional goal band centre */
  target?: number
}

export const GAUGES: Record<GaugeKey, GaugeDef> = {
  temperature: { key: 'temperature', label: 'Temp', code: 'T-01', unit: 'MK', max: 200, step: 50, decimals: 1, warn: 125, crit: 165 },
  pressure: { key: 'pressure', label: 'Press', code: 'P-02', unit: 'bar', max: 400, step: 100, decimals: 0, warn: 250, crit: 330 },
  output: { key: 'output', label: 'Grid', code: 'G-03', unit: 'MW', max: 2400, step: 600, decimals: 0, target: 1500 },
}

// Placeholder reactor sim. The UI only reads ReactorSim.state and writes ReactorSim.controls.
export const SIM = {
  startTemp: 70,
  heatDrift: 3.2, // MK/s the core gains on its own
  ambientLoss: 0.035, // fraction of (T - ambient) lost per second
  ambientTemp: 40,
  coolRate: 32, // MK/s removed at full lever
  pressurePerK: 1.75, // bar per MK at equilibrium
  pressureFollow: 0.9,
  ventRate: 110, // bar/s while venting
  ventCooling: 4, // MK/s side effect of venting
  spikeMin: 6, // seconds between random pressure spikes
  spikeMax: 12,
  spikePressure: 60,
  outputPerK: 10, // MW per MK
  outputPerBar: 2, // MW per bar
  outputStability: 0.2, // fraction of output lost at 0% stability
  outputTarget: 1500,
  meltdownRate: 7, // hidden meter, %/s per critical gauge
  meltdownDecay: 2.5,
}

export const UI = {
  gaugeSmoothing: 8,
  peakHoldSec: 2.5, // peak marker holds this long before falling
  peakFall: 0.25, // fraction of range per second once falling
  targetBand: 0.15, // +/- fraction of target counted as "on target"
  leverSpring: 7, // how fast it returns when let go
  leverKeySpeed: 3.5, // pull rate when using the W key
}

export const REACTOR = {
  bpmMin: 42,
  bpmMax: 150,
  sparks: 60,
}

export type Difficulty = 'easy' | 'hard'

/** normal distribution, clamped to [min, max] */
export interface Dist {
  mean: number
  sd: number
  min: number
  max: number
}

export interface DifficultyDef {
  label: string
  blurb: string
  /** multiplies coolant + vent strength */
  controlMul: number
  wobbleMul: number
  /** multiplies the core's own heat gain */
  heatMul: number
  /** multiplies pressure build-up (pressure per MK) */
  pressureMul: number
  /** random pressure spikes: size multiplier and how much faster they come */
  spikeMul: number
  spikeRateMul: number
  /** seconds between random temp/pressure jumps, null = none */
  jumpEvery: [number, number] | null
  jumpTemp: number // +/- MK
  jumpPressure: number // + bar
  popups: {
    every: Dist // seconds between spawns
    count: Dist // popups per spawn
    maxOnScreen: number
    closeMs: number // pinch hold to close
    onControlsChance: number // chance to spawn right on the lever / vent
    drift: number // px/s
  }
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: {
    label: 'Easy',
    blurb: 'Hot reactor. Unstable core. The odd message.',
    controlMul: 1,
    wobbleMul: 1.5,
    heatMul: 1.5,
    pressureMul: 1.3,
    spikeMul: 1.3,
    spikeRateMul: 1.25,
    jumpEvery: [5, 10],
    jumpTemp: 8,
    jumpPressure: 30,
    popups: {
      every: { mean: 15, sd: 2.5, min: 10, max: 20 },
      count: { mean: 1, sd: 0, min: 1, max: 1 },
      maxOnScreen: 1,
      closeMs: 400,
      onControlsChance: 0.3,
      drift: 0,
    },
  },
  hard: {
    label: 'Hard',
    blurb: 'Weak controls, erratic core, constant interruptions.',
    controlMul: 0.5,
    wobbleMul: 3,
    heatMul: 2.6,
    pressureMul: 1.9,
    spikeMul: 1.9,
    spikeRateMul: 1.8,
    jumpEvery: [2.5, 5],
    jumpTemp: 16,
    jumpPressure: 55,
    popups: {
      every: { mean: 15, sd: 7, min: 0, max: 30 },
      count: { mean: 2.5, sd: 1, min: 1, max: 4 },
      maxOnScreen: 10,
      closeMs: 1200,
      onControlsChance: 0.5,
      drift: 40,
    },
  },
}

export const POPUP = {
  width: 320,
  pickerHoldMs: 1200, // pinch hold to pick a difficulty
  handOnlyChance: 0.3, // chance a popup only closes with one specific hand (random left/right)
  // message text and its font/size/colour live in popupMessages.json
}

// MrBeast narration. Intro is click-through before the shift starts; the rest are short
// one-liners shown while playing.
export const NARRATOR = {
  name: 'MrBeast',
  typeMsPerChar: 22,
  nextHoldMs: 700, // pinch hold on "Next"
  lineGapSec: 7, // min seconds between ambient lines
  lineShowSec: 5.5, // ambient lines also stay up until he's done talking
  voice: {
    rate: 1.15,
    pitch: 1.05,
    // first match wins, falls back to any English voice
    prefer: ['Google US English', 'Microsoft Guy', 'Microsoft Andrew', 'Alex', 'Daniel', 'English (America)'],
  },
  intro: [
    "What's up guys, it's MrBeast! Welcome to the most dangerous challenge I've EVER made!",
    "You're locked inside a real fusion reactor control room, and your job is simple: DON'T. LET. IT. EXPLODE.",
    'Pinch the coolant lever and drag it down to cool the core. Pinch and hold the vent button to dump pressure. Watch those gauges!',
    "If temperature or pressure sits in the red for too long... boom. You're out.",
    "Oh, and my team is going to send you a LOT of annoying popups. Pinch and hold to close them. Yes, they'll land right on your controls. I'm not sorry.",
    'Keep the grid output near the target to rack up points. Survive, and you win $10,000!',
  ],
  introByDifficulty: {
    easy: ["You picked EASY? That's okay, everybody starts somewhere. Ready? GO!"],
    hard: ["You picked HARD?! Your controls are half as strong and the core is going crazy. Respect. You're gonna need it. GO!"],
  },
  warn: ["Temperature's climbing, use the coolant!", 'Things are heating up! Keep it under control!', "Pressure's getting high, hit that vent!"],
  crit: ["IT'S IN THE RED! DO SOMETHING!", "We're about to blow! Pull the lever!!", 'This is NOT good! Cool it down NOW!'],
  milestones: [
    { at: 30, text: '30 seconds in and still alive! Most people are gone by now.' },
    { at: 60, text: "ONE MINUTE! You're doing insane!" },
    { at: 120, text: "TWO MINUTES?! Somebody get this person a trophy. And my $10,000." },
    { at: 180, text: "Three minutes. I'm legitimately running out of money to give away." },
  ],
  melt: ["BOOM. And that's $10,000 you just watched explode. Let's go again!", "The reactor is gone! Don't worry, I've got another one. Try again!"],
}

export const SOUND = {
  steamVolume: 0.6,
  steamFadeIn: 0.05, // seconds
  steamFadeOut: 0.3, // quick fade when the vent is let go
  alarmVolume: 0.5,
  alarmFadeOut: 0.4,
  riserVolume: 0.7,
  dingVolume: 0.7,
}
