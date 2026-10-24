// PLACEHOLDER reactor sim, just enough to make the UI move.
// The UI reads `state` and `score`, writes `controls`, and calls reset().
import { DIFFICULTY, GAUGES, SIM, type Difficulty, type GaugeKey } from './config.ts'

export type Level = 'ok' | 'warn' | 'crit'

export interface ReactorState {
  temperature: number
  pressure: number
  output: number
  /** internal, drives how wobbly the core looks */
  stability: number
  /** hidden fail meter */
  meltdown: number
  time: number
  melted: boolean
}

export interface Controls {
  /** coolant lever, 0 (off) .. 1 (fully pulled) */
  coolant: number
  /** pressure vent button held */
  vent: boolean
}

export interface ReactorVisuals {
  heat: number // 0..1
  instability: number // 0..1
  coolant: number // 0..1
  venting: boolean
  melted: boolean
}

export function levelOf(key: GaugeKey, v: number): Level {
  const d = GAUGES[key]
  if (d.warn === undefined || d.crit === undefined) return 'ok'
  return v >= d.crit ? 'crit' : v >= d.warn ? 'warn' : 'ok'
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function fresh(): ReactorState {
  return {
    temperature: SIM.startTemp,
    pressure: SIM.startTemp * SIM.pressurePerK,
    output: SIM.startTemp * SIM.outputPerK,
    stability: 80,
    meltdown: 0,
    time: 0,
    melted: false,
  }
}

export class ReactorSim {
  state: ReactorState = fresh()
  controls: Controls = { coolant: 0, vent: false }
  score = 0
  difficulty: Difficulty = 'easy'
  /** held until a difficulty is picked */
  started = false

  private wobble = 0
  private nextSpike = SIM.spikeMax
  private nextJump = 0

  reset() {
    this.state = fresh()
    this.controls.coolant = 0
    this.controls.vent = false
    this.score = 0
    this.nextSpike = SIM.spikeMax
    this.nextJump = this.rollJump()
  }

  private rollJump() {
    const j = DIFFICULTY[this.difficulty].jumpEvery
    return j ? j[0] + Math.random() * (j[1] - j[0]) : Infinity
  }

  visuals(): ReactorVisuals {
    const s = this.state
    return {
      heat: s.temperature / GAUGES.temperature.max,
      instability: 1 - s.stability / 100,
      coolant: this.controls.coolant,
      venting: this.controls.vent && !s.melted,
      melted: s.melted,
    }
  }

  update(dt: number) {
    const s = this.state
    if (s.melted || !this.started) return
    const c = this.controls
    const d = DIFFICULTY[this.difficulty]
    s.time += dt

    this.wobble = (this.wobble + (Math.random() - 0.5) * dt * 6) * 0.985
    const wobble = this.wobble * d.wobbleMul

    let dT = SIM.heatDrift * d.heatMul + wobble * 4 - SIM.ambientLoss * (s.temperature - SIM.ambientTemp)
    dT -= SIM.coolRate * c.coolant * d.controlMul
    if (c.vent) dT -= SIM.ventCooling * d.controlMul
    s.temperature = clamp(s.temperature + dT * dt, 0, GAUGES.temperature.max)

    const pTarget = s.temperature * SIM.pressurePerK * d.pressureMul + wobble * 30
    s.pressure += (pTarget - s.pressure) * SIM.pressureFollow * dt
    if (c.vent) s.pressure -= SIM.ventRate * d.controlMul * dt

    // erratic jumps
    this.nextJump -= dt
    if (this.nextJump <= 0) {
      s.temperature = clamp(s.temperature + (Math.random() * 2 - 1) * d.jumpTemp, 0, GAUGES.temperature.max)
      s.pressure += d.jumpPressure * (0.5 + Math.random() * 0.5)
      this.nextJump = this.rollJump()
    }
    this.nextSpike -= dt
    if (this.nextSpike <= 0) {
      s.pressure += SIM.spikePressure * d.spikeMul
      this.nextSpike = (SIM.spikeMin + Math.random() * (SIM.spikeMax - SIM.spikeMin)) / d.spikeRateMul
    }
    s.pressure = clamp(s.pressure, 0, GAUGES.pressure.max)

    const target = 100 - Math.max(0, s.pressure - 200) / 2 - Math.abs(s.temperature - 100) * 0.4
    s.stability = clamp(s.stability + (target - s.stability) * dt, 0, 100)
    const raw = s.temperature * SIM.outputPerK + s.pressure * SIM.outputPerBar
    s.output = clamp(raw * (1 - SIM.outputStability * (1 - s.stability / 100)), 0, GAUGES.output.max)

    const crits = (['temperature', 'pressure'] as const).filter((k) => levelOf(k, s[k]) === 'crit').length
    s.meltdown = clamp(s.meltdown + (crits ? crits * SIM.meltdownRate : -SIM.meltdownDecay) * dt, 0, 100)
    if (s.meltdown >= 100) {
      s.melted = true
      return
    }

    const onTarget = Math.abs(s.output - SIM.outputTarget) < SIM.outputTarget * 0.15
    this.score += dt * (onTarget ? 12 : 3)
  }
}
