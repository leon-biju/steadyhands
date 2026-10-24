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
  outputPerK: 16,
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
    blurb: 'Standard reactor. The odd message.',
    controlMul: 1,
    wobbleMul: 1,
    jumpEvery: null,
    jumpTemp: 0,
    jumpPressure: 0,
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
    wobbleMul: 2.2,
    jumpEvery: [3, 7],
    jumpTemp: 14,
    jumpPressure: 45,
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
  text: [
    'PLACEHOLDER MESSAGE: this will say something important.',
    'Placeholder: management would like a word.',
    'Placeholder: please acknowledge this notice.',
    'Placeholder: scheduled maintenance reminder.',
    'Placeholder: your shift report is overdue.',
  ],
}
