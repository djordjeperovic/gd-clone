import type { InputSnapshot } from './types'

export class InputController {
  private readonly target: HTMLElement
  private jumpPressed = false
  private restartPressed = false
  private togglePracticePressed = false
  private pausePressed = false
  private fullscreenPressed = false

  private readonly keyDownListener = (event: KeyboardEvent) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      if (!event.repeat) {
        this.jumpPressed = true
      }
      event.preventDefault()
      return
    }

    if (event.repeat) {
      return
    }

    switch (event.code) {
      case 'KeyR':
        this.restartPressed = true
        break
      case 'KeyP':
        this.togglePracticePressed = true
        break
      case 'Escape':
        this.pausePressed = true
        break
      case 'KeyF':
        this.fullscreenPressed = true
        break
      default:
        break
    }
  }

  private readonly pointerDownListener = (event: PointerEvent) => {
    if (event.button !== 0) {
      return
    }
    this.jumpPressed = true
    event.preventDefault()
  }

  private readonly touchStartListener = (event: TouchEvent) => {
    this.jumpPressed = true
    event.preventDefault()
  }

  constructor(target: HTMLElement) {
    this.target = target
    window.addEventListener('keydown', this.keyDownListener, { passive: false })
    this.target.addEventListener('pointerdown', this.pointerDownListener)
    this.target.addEventListener('touchstart', this.touchStartListener, {
      passive: false,
    })
  }

  consumeSnapshot(): InputSnapshot {
    const snapshot: InputSnapshot = {
      jumpPressed: this.jumpPressed,
      restartPressed: this.restartPressed,
      togglePracticePressed: this.togglePracticePressed,
      pausePressed: this.pausePressed,
      fullscreenPressed: this.fullscreenPressed,
    }

    this.jumpPressed = false
    this.restartPressed = false
    this.togglePracticePressed = false
    this.pausePressed = false
    this.fullscreenPressed = false

    return snapshot
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keyDownListener)
    this.target.removeEventListener('pointerdown', this.pointerDownListener)
    this.target.removeEventListener('touchstart', this.touchStartListener)
  }
}
