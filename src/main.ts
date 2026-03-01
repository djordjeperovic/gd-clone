import './style.css'
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './game/constants'
import { createGameRuntime } from './game/runtime'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Expected #app root to exist.')
}

app.innerHTML = `
  <div class="game-shell">
    <canvas
      id="game-canvas"
      width="${INTERNAL_WIDTH}"
      height="${INTERNAL_HEIGHT}"
      aria-label="Geometry Dash-like game canvas"
    ></canvas>
  </div>
`

const canvas = app.querySelector<HTMLCanvasElement>('#game-canvas')
if (!canvas) {
  throw new Error('Expected #game-canvas to exist.')
}

const runtime = createGameRuntime({
  canvas,
  onToggleFullscreen: async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await canvas.requestFullscreen()
  },
})

const resizeCanvasDisplay = () => {
  const margin = 24
  const availableWidth = Math.max(320, window.innerWidth - margin)
  const availableHeight = Math.max(240, window.innerHeight - margin)
  const scale = Math.min(
    availableWidth / INTERNAL_WIDTH,
    availableHeight / INTERNAL_HEIGHT,
  )

  canvas.style.width = `${Math.floor(INTERNAL_WIDTH * scale)}px`
  canvas.style.height = `${Math.floor(INTERNAL_HEIGHT * scale)}px`
}

window.addEventListener('resize', resizeCanvasDisplay)
document.addEventListener('fullscreenchange', resizeCanvasDisplay)

resizeCanvasDisplay()
window.render_game_to_text = () => runtime.renderGameToText()
window.advanceTime = (ms: number) => runtime.advanceTime(ms)
runtime.start()
