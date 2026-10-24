// Sound effects: steam while venting, alarm while critical, riser + ding during calibration.
// Browsers block audio until the first click/key, so play() failures are ignored and retried.
import steamUrl from '../assets/sounds/dragon-studio-steam-hissing-2-386162.mp3'
import alarmUrl from '../assets/sounds/freesound_community-nuclear-alarm-104598.mp3'
import riserUrl from '../assets/sounds/youssefmizani-sharp-riser-407120.mp3'
import dingUrl from '../assets/sounds/freesound_community-ding-101492.mp3'
import endMusicUrl from '../assets/music/end_music.mp3'
import { SOUND } from './config.ts'

function audio(url: string, volume: number, loop = false) {
  const a = new Audio(url)
  a.preload = 'auto'
  a.volume = volume
  a.loop = loop
  return a
}

const play = (a: HTMLAudioElement) => a.play().catch(() => {})
const stop = (a: HTMLAudioElement) => {
  a.pause()
  a.currentTime = 0
}

// Looping sound that fades towards on/off instead of cutting.
class Loop {
  private a: HTMLAudioElement
  private max: number
  private fadeIn: number
  private fadeOut: number
  private vol = 0

  constructor(url: string, max: number, fadeIn: number, fadeOut: number) {
    this.a = audio(url, 0, true)
    this.max = max
    this.fadeIn = fadeIn
    this.fadeOut = fadeOut
  }

  /** dt in seconds */
  update(on: boolean, dt: number) {
    if (on) {
      this.vol = Math.min(this.max, this.vol + (this.max * dt) / this.fadeIn)
      if (this.a.paused) play(this.a)
    } else if (this.vol > 0) {
      this.vol = Math.max(0, this.vol - (this.max * dt) / this.fadeOut)
      if (this.vol === 0) stop(this.a)
    }
    this.a.volume = this.vol
  }
}

export class GameSounds {
  private steam = new Loop(steamUrl, SOUND.steamVolume, SOUND.steamFadeIn, SOUND.steamFadeOut)
  private alarm = new Loop(alarmUrl, SOUND.alarmVolume, 0.05, SOUND.alarmFadeOut)
  private endMusic = audio(endMusicUrl, SOUND.endMusicVolume)
  private won = false

  /** won: shift survived, plays the end music once; going back to false (restart) stops it */
  update(dt: number, venting: boolean, critical: boolean, won: boolean) {
    this.steam.update(venting, dt)
    this.alarm.update(critical, dt)
    if (won !== this.won) {
      this.won = won
      if (won) play(this.endMusic)
      else stop(this.endMusic)
    }
  }
}

// Riser while something charges up (calibration step, popup close), ding when it completes.
export class ChargeSound {
  private riser = audio(riserUrl, SOUND.riserVolume)
  private ding = audio(dingUrl, SOUND.dingVolume)
  private done = 0

  /** call every frame: fill 0..1, whether it's filling now, a count of completed fills, ms to fill */
  update(charge: number, charging: boolean, done: number, fillMs: number) {
    if (done !== this.done) {
      this.done = done
      stop(this.riser)
      this.ding.currentTime = 0
      play(this.ding)
      return
    }
    if (charging && this.riser.paused) {
      // line the riser up so its end lands exactly when the bar fills
      const d = this.riser.duration
      if (Number.isFinite(d)) this.riser.currentTime = Math.max(0, d - (1 - charge) * (fillMs / 1000))
      play(this.riser)
    } else if (!charging && !this.riser.paused) {
      this.riser.pause()
    }
    if (charge === 0 && !charging && this.riser.currentTime > 0) stop(this.riser)
  }

  stop() {
    stop(this.riser)
  }
}
