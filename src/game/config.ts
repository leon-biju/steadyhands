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
