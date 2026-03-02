import {
  BASE_SCROLL_SPEED,
  DASH_ORB_SPEED_BOOST,
  DASH_ORB_VERTICAL_IMPULSE,
  DEATH_RESTART_SECONDS,
  FIXED_STEP_SECONDS,
  GRAVITY,
  GROUND_Y,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  JUMP_PAD_IMPULSE,
  JUMP_IMPULSE,
  MAX_FRAME_SECONDS,
  ORB_JUMP_IMPULSE,
  PLAYER_SCREEN_X,
  PLAYER_SIZE,
  START_X,
} from './constants'
import {
  findActivatableOrb,
  findOverlappingObject,
  getGroundTopAtX,
  getOverlappingTriggers,
  hasSpikeCollision,
  isVisibleInCamera,
  resolveGroundCollision,
} from './collision'
import { AudioSystem } from './audio'
import { InputController } from './input'
import { levelData } from './levelData'
import {
  createParticleSystem,
  emitCrashShatter,
  emitJumpDust,
  emitOrbSparks,
  resetParticleSystem,
  tickTrailEmitter,
  updateParticles,
} from './particles'
import {
  readPersistentStats,
  type StorageAdapter,
  updatePersistentStatsOnCompletion,
  writePersistentStats,
} from './persistent-stats'
import { renderFrame } from './renderer'
import type { GameState, InputSnapshot, LevelObject, RunMode } from './types'

interface RuntimeOptions {
  canvas: HTMLCanvasElement
  onToggleFullscreen?: () => void | Promise<void>
  storage?: StorageAdapter
}

export interface GameRuntime {
  start: () => void
  stop: () => void
  render: () => void
  advanceTime: (ms: number) => void
  setOrientationBlocked: (blocked: boolean) => void
  renderGameToText: () => string
  dispose: () => void
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

const snapQuarterRotation = (rotationRadians: number): number => {
  const quarterTurn = Math.PI / 2
  return Math.round(rotationRadians / quarterTurn) * quarterTurn
}

const typedObjects = {
  solids: levelData.objects.filter((object) => object.type === 'ground'),
  spikes: levelData.objects.filter((object) => object.type === 'spike'),
  jumpOrbs: levelData.objects.filter((object) => object.type === 'jumpOrb'),
  dashOrbs: levelData.objects.filter((object) => object.type === 'dashOrb'),
  jumpPads: levelData.objects.filter((object) => object.type === 'jumpPad'),
  gravityPortals: levelData.objects.filter(
    (object) => object.type === 'gravityPortal',
  ),
}

type JumpResult =
  | { kind: 'none' }
  | { kind: 'jump' }
  | { kind: 'orb'; orb: LevelObject }
  | { kind: 'dash'; orb: LevelObject }

const initialPlayerY = getGroundTopAtX(START_X, typedObjects.solids, GROUND_Y) - PLAYER_SIZE

const createInitialState = (
  persistedStats: ReturnType<typeof readPersistentStats>,
): GameState => ({
  mode: 'menu',
  currentRunMode: 'running',
  attempt: 0,
  runElapsedSeconds: 0,
  completedRunSeconds: null,
  bestCompletionSeconds: persistedStats.bestCompletionSeconds,
  bestCrashCount: persistedStats.bestCrashCount,
  crashCount: 0,
  player: {
    x: START_X,
    y: initialPlayerY,
    vx: BASE_SCROLL_SPEED,
    vy: 0,
    size: PLAYER_SIZE,
    rotation: 0,
    grounded: true,
  },
  cameraX: 0,
  progressPercent: 0,
  speedMultiplier: 1,
  gravityDirection: 1,
  deathTimer: 0,
  practiceCheckpoint: null,
  activatedCheckpointTriggers: new Set<string>(),
  activatedSpeedTriggers: new Set<string>(),
  activatedInteractives: new Set<string>(),
  particles: createParticleSystem(),
})

const resolveStorage = (
  providedStorage?: StorageAdapter,
): StorageAdapter | null => {
  if (providedStorage) {
    return providedStorage
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const createGameRuntime = ({
  canvas,
  onToggleFullscreen,
  storage: providedStorage,
}: RuntimeOptions): GameRuntime => {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas context not available.')
  }

  const storage = resolveStorage(providedStorage)
  const state = createInitialState(readPersistentStats(storage))
  const input = new InputController(canvas)
  const audio = new AudioSystem()

  let running = false
  let frameHandle = 0
  let lastTimestamp = 0
  let accumulator = 0
  let orientationBlocked = false

  const syncCameraAndProgress = () => {
    state.cameraX = clamp(
      state.player.x - PLAYER_SCREEN_X,
      0,
      Math.max(levelData.length - INTERNAL_WIDTH, 0),
    )
    const travelled = Math.max(0, state.player.x - START_X)
    const totalDistance = Math.max(1, levelData.length - START_X)
    state.progressPercent = clamp((travelled / totalDistance) * 100, 0, 100)
  }

  const spawnAt = (x: number, y: number, speedMultiplier: number) => {
    state.player.x = x
    state.player.y = y
    state.player.vx = BASE_SCROLL_SPEED * speedMultiplier
    state.player.vy = 0
    state.player.rotation = 0
    state.player.grounded = true
    state.speedMultiplier = speedMultiplier
    state.gravityDirection = 1
    state.deathTimer = 0
    state.activatedCheckpointTriggers.clear()
    state.activatedSpeedTriggers.clear()
    state.activatedInteractives.clear()
    resetParticleSystem(state.particles)
    syncCameraAndProgress()
  }

  const resetRunResults = () => {
    state.runElapsedSeconds = 0
    state.completedRunSeconds = null
  }

  const spawnAtStart = () => {
    const groundTop = getGroundTopAtX(START_X, typedObjects.solids, GROUND_Y)
    spawnAt(START_X, groundTop - state.player.size, 1)
  }

  const spawnAtCheckpoint = () => {
    if (state.currentRunMode !== 'practice' || !state.practiceCheckpoint) {
      spawnAtStart()
      return
    }

    const checkpoint = state.practiceCheckpoint
    spawnAt(checkpoint.x, checkpoint.y, checkpoint.speedMultiplier)
  }

  const startFreshRun = () => {
    if (state.currentRunMode === 'practice') {
      state.practiceCheckpoint = null
    }

    state.mode = state.currentRunMode
    state.attempt += 1
    resetRunResults()
    spawnAtStart()
  }

  const restartCurrentRun = () => {
    state.mode = state.currentRunMode
    state.attempt += 1
    resetRunResults()
    if (state.currentRunMode === 'practice' && state.practiceCheckpoint) {
      spawnAtCheckpoint()
      return
    }

    spawnAtStart()
  }

  const enterDeadState = () => {
    state.mode = 'dead'
    state.deathTimer = 0
    state.crashCount += 1
    audio.playCrash()
    emitCrashShatter(state.particles, state.player)
    state.player.vx = 0
    state.player.vy = 0
  }

  const activateInteractive = (id: string): boolean => {
    if (state.activatedInteractives.has(id)) {
      return false
    }
    state.activatedInteractives.add(id)
    return true
  }

  const tryJump = (): JumpResult => {
    const dashOrb = findActivatableOrb(state.player, typedObjects.dashOrbs)
    if (dashOrb && activateInteractive(dashOrb.id)) {
      state.player.vy = DASH_ORB_VERTICAL_IMPULSE * state.gravityDirection
      state.player.grounded = false
      return { kind: 'dash', orb: dashOrb }
    }

    const jumpOrb = findActivatableOrb(state.player, typedObjects.jumpOrbs)
    if (jumpOrb && activateInteractive(jumpOrb.id)) {
      state.player.vy = ORB_JUMP_IMPULSE * state.gravityDirection
      state.player.grounded = false
      return { kind: 'orb', orb: jumpOrb }
    }

    if (state.player.grounded) {
      state.player.vy = JUMP_IMPULSE * state.gravityDirection
      state.player.grounded = false
      return { kind: 'jump' }
    }

    return { kind: 'none' }
  }

  const applyAutomaticInteractions = () => {
    const portal = findOverlappingObject(state.player, typedObjects.gravityPortals)
    if (portal && activateInteractive(portal.id)) {
      state.gravityDirection = state.gravityDirection === 1 ? -1 : 1
      state.player.grounded = false
      audio.playGravityFlip()
    }

    const jumpPad = findOverlappingObject(state.player, typedObjects.jumpPads)
    if (jumpPad && activateInteractive(jumpPad.id)) {
      state.player.vy = JUMP_PAD_IMPULSE * state.gravityDirection
      state.player.grounded = false
      audio.playJumpPad()
      emitJumpDust(state.particles, state.player, state.gravityDirection, 'pad')
    }
  }

  const applyTriggers = () => {
    const overlappingTriggers = getOverlappingTriggers(state.player, levelData.triggers)
    for (const trigger of overlappingTriggers) {
      if (
        trigger.type === 'checkpoint' &&
        state.currentRunMode === 'practice' &&
        !state.activatedCheckpointTriggers.has(trigger.id)
      ) {
        state.activatedCheckpointTriggers.add(trigger.id)
        const checkpointGroundTop = getGroundTopAtX(
          state.player.x + state.player.size * 0.5,
          typedObjects.solids,
          GROUND_Y,
        )
        state.practiceCheckpoint = {
          x: Math.max(START_X, state.player.x),
          y: checkpointGroundTop - state.player.size,
          speedMultiplier: state.speedMultiplier,
        }
        audio.playCheckpoint()
      }

      if (trigger.type === 'speed' && !state.activatedSpeedTriggers.has(trigger.id)) {
        state.activatedSpeedTriggers.add(trigger.id)
        if (typeof trigger.speedMultiplier === 'number') {
          state.speedMultiplier = trigger.speedMultiplier
          audio.playSpeedChange(trigger.speedMultiplier)
        }
      }
    }
  }

  const updateGameplay = (dt: number, controls: InputSnapshot) => {
    if (controls.restartPressed) {
      restartCurrentRun()
      return
    }

    state.runElapsedSeconds += dt

    let jumpResult: JumpResult = { kind: 'none' }
    if (controls.jumpPressed) {
      jumpResult = tryJump()
      if (jumpResult.kind === 'jump') {
        audio.playJump()
        emitJumpDust(state.particles, state.player, state.gravityDirection, 'jump')
      } else if (jumpResult.kind === 'orb') {
        audio.playOrbJump()
        emitOrbSparks(state.particles, jumpResult.orb)
      } else if (jumpResult.kind === 'dash') {
        audio.playDashOrb()
        emitOrbSparks(state.particles, jumpResult.orb)
      }
    }

    const wasGrounded = state.player.grounded
    const previousY = state.player.y

    const dashBoost = jumpResult.kind === 'dash' ? DASH_ORB_SPEED_BOOST : 0
    state.player.vx = BASE_SCROLL_SPEED * state.speedMultiplier + dashBoost
    state.player.x += state.player.vx * dt
    state.player.vy += GRAVITY * state.gravityDirection * dt
    state.player.y += state.player.vy * dt

    state.player.grounded = resolveGroundCollision(
      state.player,
      typedObjects.solids,
      previousY,
      state.gravityDirection,
    )

    applyAutomaticInteractions()

    if (state.player.grounded) {
      if (!wasGrounded) {
        state.player.rotation = snapQuarterRotation(state.player.rotation)
        emitJumpDust(state.particles, state.player, state.gravityDirection, 'landing')
      }
      state.player.rotation = snapQuarterRotation(state.player.rotation)
    } else {
      state.player.rotation += state.player.vx * dt * 0.035 * state.gravityDirection
    }

    tickTrailEmitter(state.particles, dt, state.player)

    applyTriggers()

    const fellBelowBounds = state.player.y > INTERNAL_HEIGHT + state.player.size
    const fellAboveBounds = state.player.y + state.player.size < -state.player.size
    if (
      hasSpikeCollision(state.player, typedObjects.spikes) ||
      fellBelowBounds ||
      fellAboveBounds
    ) {
      enterDeadState()
      return
    }

    if (state.player.x >= levelData.length - state.player.size) {
      state.mode = 'complete'
      state.player.vx = 0
      state.player.vy = 0
      const completionSeconds = state.runElapsedSeconds
      state.completedRunSeconds = completionSeconds
      audio.playComplete()

      const updatedStats = updatePersistentStatsOnCompletion(
        {
          bestCompletionSeconds: state.bestCompletionSeconds,
          bestCrashCount: state.bestCrashCount,
        },
        completionSeconds,
        state.crashCount,
      )

      state.bestCompletionSeconds = updatedStats.stats.bestCompletionSeconds
      state.bestCrashCount = updatedStats.stats.bestCrashCount

      if (updatedStats.didChange) {
        writePersistentStats(storage, updatedStats.stats)
      }
    }
  }

  const togglePracticeMode = () => {
    const nextRunMode: RunMode =
      state.currentRunMode === 'running' ? 'practice' : 'running'
    state.currentRunMode = nextRunMode

    if (nextRunMode === 'running') {
      state.practiceCheckpoint = null
    }

    if (state.mode === 'running' || state.mode === 'practice') {
      state.mode = nextRunMode
    }
  }

  const handleFullscreenToggle = () => {
    if (!onToggleFullscreen) {
      return
    }

    void Promise.resolve(onToggleFullscreen()).catch(() => undefined)
  }

  const step = (dt: number) => {
    const controls = input.consumeSnapshot()

    if (
      controls.jumpPressed ||
      controls.restartPressed ||
      controls.togglePracticePressed
    ) {
      void audio.resumeIfNeeded()
    }

    if (controls.fullscreenPressed) {
      handleFullscreenToggle()
    }

    if (controls.togglePracticePressed) {
      togglePracticeMode()
    }

    if (controls.pausePressed) {
      if (state.mode === 'running' || state.mode === 'practice') {
        state.mode = 'paused'
      } else if (state.mode === 'paused') {
        state.mode = state.currentRunMode
      }
    }

    switch (state.mode) {
      case 'menu':
        if (controls.restartPressed || controls.jumpPressed) {
          startFreshRun()
        }
        break
      case 'running':
      case 'practice':
        if (!orientationBlocked) {
          updateGameplay(dt, controls)
          updateParticles(
            state.particles,
            dt,
            state.gravityDirection,
            state.cameraX,
          )
        }
        break
      case 'paused':
        if (controls.restartPressed) {
          restartCurrentRun()
        }
        break
      case 'dead':
        state.deathTimer += dt
        updateParticles(state.particles, dt, state.gravityDirection, state.cameraX)
        if (controls.restartPressed || state.deathTimer >= DEATH_RESTART_SECONDS) {
          restartCurrentRun()
        }
        break
      case 'complete':
        updateParticles(state.particles, dt, state.gravityDirection, state.cameraX)
        if (controls.restartPressed) {
          restartCurrentRun()
          break
        }
        if (controls.jumpPressed) {
          state.mode = 'menu'
        }
        break
      default:
        break
    }

    syncCameraAndProgress()
  }

  const render = () => {
    renderFrame({ ctx, state, level: levelData })
  }

  const frame = (timestamp: number) => {
    if (!running) {
      return
    }

    const deltaSeconds = clamp((timestamp - lastTimestamp) / 1000, 0, MAX_FRAME_SECONDS)
    lastTimestamp = timestamp
    accumulator += deltaSeconds

    while (accumulator >= FIXED_STEP_SECONDS) {
      step(FIXED_STEP_SECONDS)
      accumulator -= FIXED_STEP_SECONDS
    }

    render()
    frameHandle = requestAnimationFrame(frame)
  }

  const start = () => {
    if (running) {
      return
    }

    running = true
    lastTimestamp = performance.now()
    render()
    frameHandle = requestAnimationFrame(frame)
  }

  const stop = () => {
    if (!running) {
      return
    }
    running = false
    cancelAnimationFrame(frameHandle)
  }

  const advanceTime = (ms: number) => {
    const safeMs = Math.max(0, ms)
    accumulator += safeMs / 1000

    while (accumulator >= FIXED_STEP_SECONDS) {
      step(FIXED_STEP_SECONDS)
      accumulator -= FIXED_STEP_SECONDS
    }

    render()
    lastTimestamp = performance.now()
  }

  const formatVisibleObject = (object: LevelObject) => ({
    id: object.id,
    type: object.type,
    x: Number(object.x.toFixed(2)),
    y: Number(object.y.toFixed(2)),
    width: Number(object.width.toFixed(2)),
    height: Number(object.height.toFixed(2)),
  })

  const renderGameToText = () => {
    const visibleObjects = levelData.objects
      .filter((object) =>
        isVisibleInCamera(object.x, object.width, state.cameraX, INTERNAL_WIDTH),
      )
      .slice(0, 24)
      .map(formatVisibleObject)

    const visibleHazards = typedObjects.spikes
      .filter((spike) =>
        isVisibleInCamera(spike.x, spike.width, state.cameraX, INTERNAL_WIDTH),
      )
      .slice(0, 12)
      .map(formatVisibleObject)

    const payload = {
      coordinateSystem:
        'Origin is top-left, +x right, +y down. Values are world units in an 800x450 camera window.',
      mode: state.mode,
      runMode: state.currentRunMode,
      attempt: state.attempt,
      runElapsedSeconds: Number(state.runElapsedSeconds.toFixed(2)),
      completedRunSeconds:
        state.completedRunSeconds === null
          ? null
          : Number(state.completedRunSeconds.toFixed(2)),
      bestCompletionSeconds:
        state.bestCompletionSeconds === null
          ? null
          : Number(state.bestCompletionSeconds.toFixed(2)),
      bestCrashCount: state.bestCrashCount,
      crashCount: state.crashCount,
      progressPercent: Number(state.progressPercent.toFixed(2)),
      orientationBlocked,
      speed: Number((BASE_SCROLL_SPEED * state.speedMultiplier).toFixed(2)),
      gravityDirection: state.gravityDirection === 1 ? 'down' : 'up',
      player: {
        x: Number(state.player.x.toFixed(2)),
        y: Number(state.player.y.toFixed(2)),
        vx: Number(state.player.vx.toFixed(2)),
        vy: Number(state.player.vy.toFixed(2)),
        grounded: state.player.grounded,
        rotation: Number(state.player.rotation.toFixed(2)),
      },
      visibleObjects,
      visibleHazards,
      practiceCheckpoint: state.practiceCheckpoint
        ? {
            x: Number(state.practiceCheckpoint.x.toFixed(2)),
            y: Number(state.practiceCheckpoint.y.toFixed(2)),
            speedMultiplier: Number(state.practiceCheckpoint.speedMultiplier.toFixed(2)),
          }
        : null,
    }

    return JSON.stringify(payload)
  }

  const dispose = () => {
    stop()
    input.dispose()
    audio.dispose()
  }

  const setOrientationBlocked = (blocked: boolean) => {
    orientationBlocked = blocked
  }

  return {
    start,
    stop,
    render,
    advanceTime,
    setOrientationBlocked,
    renderGameToText,
    dispose,
  }
}
