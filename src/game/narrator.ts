// MrBeast narrator. Intro: big blocking dialogue with a Next button (pinch-hold, click or Enter),
// run between the difficulty picker and the start of the shift. In play: short auto-hiding
// one-liners in the middle of the screen, driven by the sim state. Lines are read out with the
// browser's speech synthesis, and the portrait bobs while he talks.
import mrbeast from '../assets/mrbeast.png'
import type { InputFrame } from '../shared/types.ts'
import { HoldButton } from '../input/holdButton.ts'
import { NARRATOR } from './config.ts'
import { levelOf, type Level, type ReactorSim } from './sim.ts'
import type { Difficulty } from './config.ts'

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export class Narrator {
  private el = document.createElement('div')
  private textEl: HTMLElement
  private next: HTMLElement
  private nextBtn: HoldButton
  private lines: string[] = []
  private shown = 0 // chars typed
  private line = ''
  private onDone: (() => void) | null = null
  private hideIn = 0
  private cooldown = 0
  private lastTime = 0
  private lastLevel: Level = 'ok'
  private milestone = 0
  private sim: ReactorSim
  private speaking = false

  constructor(sim: ReactorSim, parent: HTMLElement = document.body) {
    this.sim = sim
    this.el.className = 'narrator'
    this.el.hidden = true
    this.el.innerHTML = `
      <img class="nar-pic" src="${mrbeast}" alt="${NARRATOR.name}" />
      <div class="nar-box">
        <span class="nar-name">${NARRATOR.name}</span>
        <p class="nar-text"></p>
        <button class="nar-next">Next <kbd>Enter</kbd></button>
      </div>`
    parent.appendChild(this.el)
    this.textEl = this.el.querySelector('.nar-text')!
    this.next = this.el.querySelector('.nar-next')!
    this.next.addEventListener('click', this.advance)
    this.nextBtn = new HoldButton(this.next, { gesture: 'pinch', hands: 1, holdMs: NARRATOR.nextHoldMs, onHold: this.advance })
  }

  /** click-through intro, calls done after the last line */
  intro(difficulty: Difficulty, done: () => void) {
    this.lines = [...NARRATOR.intro, ...NARRATOR.introByDifficulty[difficulty]]
    this.onDone = done
    this.el.className = 'narrator intro'
    this.el.hidden = false
    window.addEventListener('keydown', this.onKey)
    this.start(this.lines.shift()!)
  }

  /** dt in ms */
  update(frame: InputFrame, dt: number) {
    if (this.el.hidden) return this.watch(dt)
    if (this.shown < this.line.length) {
      this.shown = Math.min(this.line.length, this.shown + dt / NARRATOR.typeMsPerChar)
      this.textEl.textContent = this.line.slice(0, Math.floor(this.shown))
    }
    this.el.classList.toggle('talking', this.speaking || this.shown < this.line.length)
    if (this.onDone) {
      this.nextBtn.update(frame, dt)
    } else if ((this.hideIn -= dt / 1000) <= 0 && !this.speaking) {
      this.el.hidden = true
    }
    if (!this.onDone) this.watch(dt)
  }

  private start(text: string) {
    this.line = text
    this.shown = 0
    this.textEl.textContent = ''
    this.speak(text)
    this.next.innerHTML = this.lines.length ? 'Next <kbd>Enter</kbd>' : "Let's go! <kbd>Enter</kbd>"
  }

  private advance = () => {
    // first press finishes the typing, the next moves on
    if (this.shown < this.line.length) {
      this.shown = this.line.length
      this.textEl.textContent = this.line
      return
    }
    if (this.lines.length) return this.start(this.lines.shift()!)
    window.removeEventListener('keydown', this.onKey)
    this.el.hidden = true
    this.el.className = 'narrator'
    const done = this.onDone
    this.onDone = null
    this.cooldown = NARRATOR.lineGapSec
    done?.()
  }

  private speak(text: string) {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voices = speechSynthesis.getVoices()
    u.voice =
      NARRATOR.voice.prefer.map((n) => voices.find((v) => v.name.includes(n))).find((v) => v) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      null
    u.rate = NARRATOR.voice.rate
    u.pitch = NARRATOR.voice.pitch
    // only counts as talking once audio actually starts (no voices / blocked autoplay = silent)
    u.onstart = () => (this.speaking = this.line === text)
    u.onend = u.onerror = () => {
      if (this.line === text) this.speaking = false
    }
    this.speaking = false
    speechSynthesis.speak(u)
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') this.advance()
  }

  private say(text: string) {
    this.el.hidden = false
    this.hideIn = NARRATOR.lineShowSec
    this.cooldown = NARRATOR.lineGapSec
    this.start(text)
    this.next.innerHTML = ''
  }

  /** in-game reactions */
  private watch(dt: number) {
    const s = this.sim.state
    if (!this.sim.started || this.onDone) return
    // a restart rewinds the clock
    if (s.time < this.lastTime) {
      this.milestone = 0
      this.lastLevel = 'ok'
      this.cooldown = 0
    }
    this.lastTime = s.time
    this.cooldown -= dt / 1000

    if (s.melted) {
      if (this.milestone >= 0) this.say(pick(NARRATOR.melt))
      this.milestone = -1
      return
    }
    if (this.milestone < 0) return

    const worst = (['temperature', 'pressure'] as const).map((k) => levelOf(k, s[k])).reduce<Level>((a, l) => (l === 'crit' || (l === 'warn' && a === 'ok') ? l : a), 'ok')
    // hold the level change until the cooldown is over so it still gets announced
    if (this.cooldown > 0) return
    const prev = this.lastLevel
    this.lastLevel = worst

    const m = NARRATOR.milestones[this.milestone]
    if (worst === 'crit' && prev !== 'crit') this.say(pick(NARRATOR.crit))
    else if (worst === 'warn' && prev === 'ok') this.say(pick(NARRATOR.warn))
    else if (m && s.time >= m.at) {
      this.milestone++
      this.say(m.text)
    }
  }
}
