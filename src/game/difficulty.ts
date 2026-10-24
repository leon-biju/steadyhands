// Difficulty select screen, shown after calibration. Pinch-hold, click, or press 1 / 2.
import type { InputFrame } from '../shared/types.ts'
import { HoldButton } from '../input/holdButton.ts'
import { DIFFICULTY, POPUP, type Difficulty } from './config.ts'

export class DifficultyPicker {
  readonly el = document.createElement('div')
  private buttons: HoldButton[]
  private picked: Difficulty | null = null

  constructor(parent: HTMLElement = document.body) {
    const keys = Object.keys(DIFFICULTY) as Difficulty[]
    this.el.className = 'picker'
    this.el.innerHTML = `
      <div class="picker-card">
        <span class="picker-code">SELECT SHIFT</span>
        <h1>Choose difficulty</h1>
        <div class="picker-opts">
          ${keys
            .map(
              (k, i) => `
            <button class="picker-btn" data-d="${k}">
              <b>${DIFFICULTY[k].label}</b>
              <span>${DIFFICULTY[k].blurb}</span>
              <kbd>${i + 1}</kbd>
            </button>`,
            )
            .join('')}
        </div>
        <p>Pinch and hold to choose</p>
      </div>`
    parent.appendChild(this.el)

    this.buttons = keys.map((k) => {
      const el = this.el.querySelector<HTMLElement>(`[data-d="${k}"]`)!
      el.addEventListener('click', () => (this.picked = k))
      return new HoldButton(el, { gesture: 'pinch', hands: 1, holdMs: POPUP.pickerHoldMs, onHold: () => (this.picked = k) })
    })
    window.addEventListener('keydown', this.onKey)
  }

  /** dt in ms; returns the choice once made */
  update(frame: InputFrame, dt: number): Difficulty | null {
    for (const b of this.buttons) b.update(frame, dt)
    if (!this.picked) return null
    window.removeEventListener('keydown', this.onKey)
    this.el.remove()
    return this.picked
  }

  private onKey = (e: KeyboardEvent) => {
    const k = (Object.keys(DIFFICULTY) as Difficulty[])[Number(e.key) - 1]
    if (k) this.picked = k
  }
}
