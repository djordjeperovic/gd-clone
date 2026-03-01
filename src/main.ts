import './style.css'
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './game/constants'
import {
  getViewportSize,
  isLandscapeViewport,
  tryEnterImmersiveLandscape,
} from './game/mobile-orientation'
import { createGameRuntime } from './game/runtime'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Expected #app root to exist.')
}

app.innerHTML = `
  <div class="game-shell">
    <div class="game-frame">
      <canvas
        id="game-canvas"
        width="${INTERNAL_WIDTH}"
        height="${INTERNAL_HEIGHT}"
        aria-label="Geometry Dash-like game canvas"
      ></canvas>
    </div>
    <section
      id="orientation-overlay"
      class="orientation-overlay"
      aria-live="polite"
      aria-hidden="true"
      hidden
    >
      <div class="orientation-overlay__panel">
        <h2>Rotate to Landscape</h2>
        <p>This game runs in landscape on phones.</p>
        <button id="orientation-overlay-button" type="button">
          Enter Fullscreen
        </button>
      </div>
    </section>
  </div>
`

const canvas = app.querySelector<HTMLCanvasElement>('#game-canvas')
if (!canvas) {
  throw new Error('Expected #game-canvas to exist.')
}

const orientationOverlay = app.querySelector<HTMLElement>('#orientation-overlay')
if (!orientationOverlay) {
  throw new Error('Expected #orientation-overlay to exist.')
}

const orientationOverlayButton = app.querySelector<HTMLButtonElement>(
  '#orientation-overlay-button',
)
if (!orientationOverlayButton) {
  throw new Error('Expected #orientation-overlay-button to exist.')
}

const runtime = createGameRuntime({
  canvas,
  onToggleFullscreen: async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await canvas.requestFullscreen()
    } catch {
      // Best effort: some browsers require explicit gesture or deny fullscreen.
    } finally {
      syncLayoutAndOrientation()
    }
  },
})

const MOBILE_UA_PATTERN =
  /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

const isLikelyPhoneViewport = (): boolean => {
  const { width, height } = getViewportSize()
  const shortEdge = Math.min(width, height)
  const longEdge = Math.max(width, height)
  const smallScreen = shortEdge <= 600 && longEdge <= 1100
  const coarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false

  const mobileHint = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData?.mobile
  if (mobileHint === true) {
    return true
  }

  return MOBILE_UA_PATTERN.test(navigator.userAgent) || (coarsePointer && smallScreen)
}

const updateRootViewportVariables = () => {
  const viewport = getViewportSize()
  document.documentElement.style.setProperty('--viewport-width', `${viewport.width}px`)
  document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`)
}

const resizeCanvasDisplay = () => {
  const viewport = getViewportSize()
  const margin = 24
  const availableWidth = Math.max(280, viewport.width - margin)
  const availableHeight = Math.max(180, viewport.height - margin)
  const scale = Math.min(
    availableWidth / INTERNAL_WIDTH,
    availableHeight / INTERNAL_HEIGHT,
  )

  canvas.style.width = `${Math.floor(INTERNAL_WIDTH * scale)}px`
  canvas.style.height = `${Math.floor(INTERNAL_HEIGHT * scale)}px`
}

const shouldBlockForPortraitPhone = (): boolean => {
  return isLikelyPhoneViewport() && !isLandscapeViewport()
}

const updateOrientationOverlayState = () => {
  const blocked = shouldBlockForPortraitPhone()
  runtime.setOrientationBlocked(blocked)
  orientationOverlay.hidden = !blocked
  orientationOverlay.setAttribute('aria-hidden', String(!blocked))
}

const syncLayoutAndOrientation = () => {
  updateRootViewportVariables()
  resizeCanvasDisplay()
  updateOrientationOverlayState()
}

let immersiveRequestInFlight = false
const attemptImmersiveLandscape = () => {
  if (immersiveRequestInFlight || !isLikelyPhoneViewport()) {
    return
  }

  immersiveRequestInFlight = true
  void tryEnterImmersiveLandscape(canvas).finally(() => {
    immersiveRequestInFlight = false
    syncLayoutAndOrientation()
  })
}

orientationOverlayButton.addEventListener('click', () => {
  attemptImmersiveLandscape()
})

window.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) {
    return
  }

  if (!isLikelyPhoneViewport()) {
    return
  }

  attemptImmersiveLandscape()
})

window.addEventListener('click', () => {
  if (!isLikelyPhoneViewport()) {
    return
  }

  attemptImmersiveLandscape()
})

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) {
    return
  }

  if (!isLikelyPhoneViewport()) {
    return
  }

  attemptImmersiveLandscape()
})

window.addEventListener('resize', syncLayoutAndOrientation)
window.addEventListener('orientationchange', syncLayoutAndOrientation)
document.addEventListener('fullscreenchange', syncLayoutAndOrientation)

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncLayoutAndOrientation)
  window.visualViewport.addEventListener('scroll', syncLayoutAndOrientation)
}

syncLayoutAndOrientation()
window.render_game_to_text = () => runtime.renderGameToText()
window.advanceTime = (ms: number) => runtime.advanceTime(ms)
runtime.start()
