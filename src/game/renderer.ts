import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './constants'
import { isVisibleInCamera } from './collision'
import type {
  GameMode,
  GameState,
  LevelData,
  ParticleState,
  RunMode,
} from './types'

interface RenderArgs {
  ctx: CanvasRenderingContext2D
  state: GameState
  level: LevelData
}

const modeLabel = (mode: GameMode): string => {
  switch (mode) {
    case 'menu':
      return 'Menu'
    case 'running':
      return 'Running'
    case 'practice':
      return 'Practice'
    case 'paused':
      return 'Paused'
    case 'dead':
      return 'Dead'
    case 'complete':
      return 'Complete'
    default:
      return mode
  }
}

const runModeLabel = (runMode: RunMode): string =>
  runMode === 'practice' ? 'ON' : 'OFF'

const formatRunSeconds = (seconds: number | null): string => {
  if (seconds === null) {
    return '--'
  }
  return `${seconds.toFixed(2)}s`
}

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  cameraX: number,
): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, INTERNAL_HEIGHT)
  gradient.addColorStop(0, '#12356e')
  gradient.addColorStop(0.55, '#0b1f48')
  gradient.addColorStop(1, '#08142f')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT)

  const stripeOffset = (cameraX * 0.2) % 120
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  for (let x = -120 - stripeOffset; x < INTERNAL_WIDTH + 120; x += 120) {
    ctx.fillRect(x, 70, 56, 6)
  }

  ctx.fillStyle = 'rgba(255, 208, 120, 0.13)'
  ctx.fillRect(0, INTERNAL_HEIGHT - 92, INTERNAL_WIDTH, 92)
}

const drawGroundAndObjects = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  level: LevelData,
): void => {
  for (const object of level.objects) {
    if (
      !isVisibleInCamera(
        object.x,
        object.width,
        state.cameraX,
        INTERNAL_WIDTH,
      )
    ) {
      continue
    }

    const screenX = object.x - state.cameraX

    if (object.type === 'ground') {
      ctx.fillStyle = '#1f3e6f'
      ctx.fillRect(screenX, object.y, object.width, object.height)
      ctx.fillStyle = '#54c3ff'
      ctx.fillRect(screenX, object.y, object.width, 5)
      continue
    }

    if (object.type === 'spike') {
      ctx.beginPath()
      ctx.moveTo(screenX, object.y + object.height)
      ctx.lineTo(screenX + object.width / 2, object.y)
      ctx.lineTo(screenX + object.width, object.y + object.height)
      ctx.closePath()
      ctx.fillStyle = '#ff6c59'
      ctx.fill()
      ctx.strokeStyle = '#ffd0c7'
      ctx.lineWidth = 2
      ctx.stroke()
      continue
    }

    if (object.type === 'jumpOrb') {
      const centerX = screenX + object.width / 2
      const centerY = object.y + object.height / 2
      const radius = object.width / 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#f8da43'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#fff2ad'
      ctx.stroke()
      continue
    }

    if (object.type === 'dashOrb') {
      const centerX = screenX + object.width / 2
      const centerY = object.y + object.height / 2
      const radius = object.width / 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#49d7f5'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#c9f5ff'
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(centerX - radius * 0.4, centerY)
      ctx.lineTo(centerX + radius * 0.22, centerY)
      ctx.lineTo(centerX + radius * 0.05, centerY - radius * 0.22)
      ctx.moveTo(centerX + radius * 0.22, centerY)
      ctx.lineTo(centerX + radius * 0.05, centerY + radius * 0.22)
      ctx.strokeStyle = '#08395d'
      ctx.lineWidth = 2
      ctx.stroke()
      continue
    }

    if (object.type === 'jumpPad') {
      ctx.fillStyle = '#f5a23f'
      ctx.fillRect(screenX, object.y, object.width, object.height)
      ctx.strokeStyle = '#ffe1a7'
      ctx.lineWidth = 2
      ctx.strokeRect(screenX, object.y, object.width, object.height)

      const midY = object.y + object.height / 2
      ctx.beginPath()
      ctx.moveTo(screenX + 6, midY + 2)
      ctx.lineTo(screenX + object.width / 2, object.y + 2)
      ctx.lineTo(screenX + object.width - 6, midY + 2)
      ctx.strokeStyle = '#fff0cf'
      ctx.lineWidth = 2
      ctx.stroke()
      continue
    }

    if (object.type === 'gravityPortal') {
      const centerX = screenX + object.width / 2
      const centerY = object.y + object.height / 2
      const radius = Math.min(object.width, object.height) * 0.45

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(96, 132, 255, 0.2)'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#a9baff'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 0.56, 0, Math.PI * 2)
      ctx.strokeStyle = '#7ff4d8'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(centerX, centerY - radius * 0.5)
      ctx.lineTo(centerX, centerY + radius * 0.5)
      ctx.moveTo(centerX - radius * 0.22, centerY - radius * 0.28)
      ctx.lineTo(centerX, centerY - radius * 0.5)
      ctx.lineTo(centerX + radius * 0.22, centerY - radius * 0.28)
      ctx.moveTo(centerX - radius * 0.22, centerY + radius * 0.28)
      ctx.lineTo(centerX, centerY + radius * 0.5)
      ctx.lineTo(centerX + radius * 0.22, centerY + radius * 0.28)
      ctx.strokeStyle = '#d7e1ff'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

const drawTriggers = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  level: LevelData,
): void => {
  for (const trigger of level.triggers) {
    if (
      !isVisibleInCamera(
        trigger.x,
        trigger.width,
        state.cameraX,
        INTERNAL_WIDTH,
      )
    ) {
      continue
    }

    const screenX = trigger.x - state.cameraX

    if (trigger.type === 'checkpoint') {
      ctx.fillStyle = 'rgba(120, 255, 180, 0.34)'
      ctx.fillRect(screenX, trigger.y, trigger.width, trigger.height)
      ctx.fillStyle = '#7bffd2'
      ctx.fillRect(screenX + 6, trigger.y + 8, 3, trigger.height - 16)
      ctx.beginPath()
      ctx.moveTo(screenX + 9, trigger.y + 11)
      ctx.lineTo(screenX + trigger.width - 3, trigger.y + 18)
      ctx.lineTo(screenX + 9, trigger.y + 26)
      ctx.closePath()
      ctx.fillStyle = '#a6ffd6'
      ctx.fill()
      continue
    }

    if (trigger.type === 'speed') {
      ctx.fillStyle = 'rgba(255, 170, 79, 0.35)'
      ctx.fillRect(screenX, trigger.y, trigger.width, trigger.height)
      ctx.strokeStyle = '#ffd08f'
      ctx.lineWidth = 2
      ctx.strokeRect(screenX, trigger.y, trigger.width, trigger.height)

      const midY = trigger.y + trigger.height / 2
      ctx.beginPath()
      ctx.moveTo(screenX + 6, midY - 10)
      ctx.lineTo(screenX + trigger.width - 6, midY)
      ctx.lineTo(screenX + 6, midY + 10)
      ctx.strokeStyle = '#ffe1b1'
      ctx.stroke()
    }
  }
}

type ParticleLayer = 'back' | 'front'

const getParticleAlpha = (particle: ParticleState): number => {
  const lifeProgress = particle.age / particle.lifetime
  const remainingLife = Math.max(0, 1 - lifeProgress)
  return particle.opacity * remainingLife * remainingLife
}

const drawParticles = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layer: ParticleLayer,
): void => {
  for (const particle of state.particles.items) {
    const isTrailLayer = particle.kind === 'trail'
    if (layer === 'back' && !isTrailLayer) {
      continue
    }
    if (layer === 'front' && isTrailLayer) {
      continue
    }

    const screenX = particle.x - state.cameraX
    if (
      screenX < -40 ||
      screenX > INTERNAL_WIDTH + 40 ||
      particle.y < -40 ||
      particle.y > INTERNAL_HEIGHT + 40
    ) {
      continue
    }

    const alpha = getParticleAlpha(particle)
    if (alpha <= 0.01) {
      continue
    }

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = particle.color

    if (particle.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(screenX, particle.y, particle.size * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      continue
    }

    ctx.translate(screenX, particle.y)
    ctx.rotate(particle.rotation)
    ctx.fillRect(
      -particle.size * 0.5,
      -particle.size * 0.5,
      particle.size,
      particle.size,
    )
    ctx.restore()
  }
}

const drawPlayer = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  const player = state.player
  const centerX = player.x - state.cameraX + player.size / 2
  const centerY = player.y + player.size / 2

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(player.rotation)
  ctx.fillStyle = '#e7f0ff'
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size)
  ctx.strokeStyle = '#66c8ff'
  ctx.lineWidth = 3
  ctx.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size)
  ctx.fillStyle = '#1b3c66'
  ctx.fillRect(-player.size / 4, -player.size / 4, player.size / 2, player.size / 2)
  ctx.restore()
}

const drawHud = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(10, 10, 282, 128)
  ctx.strokeStyle = 'rgba(147, 208, 255, 0.65)'
  ctx.lineWidth = 1
  ctx.strokeRect(10, 10, 282, 128)

  ctx.fillStyle = '#eef7ff'
  ctx.font = '16px "Trebuchet MS", sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(`Mode: ${modeLabel(state.mode)}`, 20, 18)
  ctx.fillText(`Attempt: ${state.attempt}`, 20, 40)
  ctx.fillText(`Progress: ${state.progressPercent.toFixed(1)}%`, 20, 62)
  ctx.fillText(`Speed: ${(state.speedMultiplier * 100).toFixed(0)}%`, 20, 84)
  ctx.fillText(`Gravity: ${state.gravityDirection === 1 ? 'Down' : 'Up'}`, 20, 106)

  ctx.fillStyle =
    state.currentRunMode === 'practice' ? 'rgba(112, 255, 176, 0.85)' : 'rgba(255, 215, 120, 0.85)'
  ctx.fillRect(INTERNAL_WIDTH - 194, 14, 180, 36)
  ctx.fillStyle = '#09192f'
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif'
  ctx.fillText(`Practice: ${runModeLabel(state.currentRunMode)}`, INTERNAL_WIDTH - 184, 24)
}

const drawOverlayPanel = (
  ctx: CanvasRenderingContext2D,
  title: string,
  details: readonly string[],
): void => {
  const panelWidth = 560
  const panelHeight = 150 + details.length * 22
  const panelX = (INTERNAL_WIDTH - panelWidth) / 2
  const panelY = (INTERNAL_HEIGHT - panelHeight) / 2

  ctx.fillStyle = 'rgba(0, 7, 20, 0.7)'
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight)
  ctx.strokeStyle = 'rgba(142, 212, 255, 0.95)'
  ctx.lineWidth = 2
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight)

  ctx.fillStyle = '#f4fbff'
  ctx.font = 'bold 34px "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, INTERNAL_WIDTH / 2, panelY + 50)

  ctx.font = '18px "Trebuchet MS", sans-serif'
  details.forEach((line, index) => {
    ctx.fillText(line, INTERNAL_WIDTH / 2, panelY + 86 + index * 22)
  })
  ctx.textAlign = 'left'
}

const drawModeOverlay = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  if (state.mode === 'menu') {
    drawOverlayPanel(ctx, 'GD Clone MVP', [
      'Space / ArrowUp / Touch: jump and start',
      'R: restart   P: toggle practice   Esc: pause   F: fullscreen',
      'Jump pads auto-launch. Dash orbs trigger on jump input.',
      'Reach the end of the authored level without hitting spikes.',
    ])
    return
  }

  if (state.mode === 'paused') {
    drawOverlayPanel(ctx, 'Paused', [
      'Press Escape to resume.',
      'Press R to restart this attempt.',
    ])
    return
  }

  if (state.mode === 'dead') {
    drawOverlayPanel(ctx, 'Crash!', [
      'Game over. Quick retry incoming...',
      'Press R to restart immediately.',
    ])
    return
  }

  if (state.mode === 'complete') {
    const completionTime = formatRunSeconds(state.completedRunSeconds)
    const bestTime = formatRunSeconds(state.bestCompletionSeconds)
    drawOverlayPanel(ctx, 'Level Complete!', [
      `Completion Time: ${completionTime}`,
      `Best Time: ${bestTime}`,
      `Attempts This Session: ${state.attempt}`,
      `Crashes This Session: ${state.crashCount}`,
      'Press R to restart this run.',
      'Press Space to return to menu.',
    ])
  }
}

export const renderFrame = ({ ctx, state, level }: RenderArgs): void => {
  drawBackground(ctx, state.cameraX)
  drawGroundAndObjects(ctx, state, level)
  drawTriggers(ctx, state, level)
  drawParticles(ctx, state, 'back')
  if (state.mode !== 'dead') {
    drawPlayer(ctx, state)
  }
  drawParticles(ctx, state, 'front')
  drawHud(ctx, state)
  drawModeOverlay(ctx, state)
}
