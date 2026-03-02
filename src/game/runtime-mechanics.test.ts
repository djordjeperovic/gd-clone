import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GameRuntime } from './runtime'
import type { LevelData } from './types'

interface RuntimeTextState {
  mode: string
  gravityDirection: 'down' | 'up'
  coinCount: number
  totalCoins: number
  player: {
    x: number
    y: number
    vx: number
    vy: number
    grounded: boolean
  }
}

const createCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')

  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({} as CanvasRenderingContext2D)),
  })

  return canvas
}

const readRuntimeState = (runtime: GameRuntime): RuntimeTextState => {
  return JSON.parse(runtime.renderGameToText()) as RuntimeTextState
}

const pressSpace = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
}

const startRun = (runtime: GameRuntime): void => {
  pressSpace()
  runtime.advanceTime(17)
  runtime.advanceTime(17)
}

const createRuntimeForLevel = async (level: LevelData): Promise<GameRuntime> => {
  vi.resetModules()
  vi.doMock('./renderer', () => ({
    renderFrame: vi.fn(),
  }))

  const { createGameRuntime } = await import('./runtime')
  return createGameRuntime({
    canvas: createCanvas(),
    level,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('runtime interactive mechanics', () => {
  it('toggles gravity portal once and keeps orientation stable while still overlapping', async () => {
    const runtime = await createRuntimeForLevel({
      length: 1200,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 1200, height: 20 },
        {
          id: 'gravity-1',
          type: 'gravityPortal',
          x: 80,
          y: -600,
          width: 500,
          height: 1600,
        },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      const first = readRuntimeState(runtime)

      expect(first.mode).toBe('running')
      expect(first.gravityDirection).toBe('up')

      for (let index = 0; index < 4; index += 1) {
        runtime.advanceTime(17)
        const stable = readRuntimeState(runtime)
        expect(stable.gravityDirection).toBe('up')
      }
    } finally {
      runtime.dispose()
    }
  })

  it('auto-triggers jump pads on overlap without requiring jump input', async () => {
    const runtime = await createRuntimeForLevel({
      length: 800,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 800, height: 20 },
        { id: 'jump-pad-1', type: 'jumpPad', x: 124, y: 88, width: 24, height: 12 },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      const state = readRuntimeState(runtime)

      expect(state.gravityDirection).toBe('down')
      expect(state.player.grounded).toBe(false)
      expect(state.player.vy).toBeLessThan(-700)
    } finally {
      runtime.dispose()
    }
  })

  it('requires jump input for dash orbs and only triggers each orb once per attempt', async () => {
    const runtime = await createRuntimeForLevel({
      length: 1200,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 1200, height: 20 },
        { id: 'dash-orb-1', type: 'dashOrb', x: 130, y: 72, width: 28, height: 28 },
        { id: 'dash-orb-2', type: 'dashOrb', x: 210, y: 72, width: 40, height: 28 },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      const noInputState = readRuntimeState(runtime)
      expect(noInputState.player.vx).toBe(300)
      expect(noInputState.player.vy).toBe(0)

      runtime.advanceTime(280)
      pressSpace()
      runtime.advanceTime(17)
      const dashed = readRuntimeState(runtime)

      expect(dashed.player.vx).toBeGreaterThan(1000)
      expect(dashed.player.vy).toBeLessThan(-250)

      pressSpace()
      runtime.advanceTime(17)
      const afterSecondPress = readRuntimeState(runtime)
      expect(afterSecondPress.player.vx).toBeLessThan(400)
    } finally {
      runtime.dispose()
    }
  })

  it('collects coins once per attempt and resets coin count on restart', async () => {
    const runtime = await createRuntimeForLevel({
      length: 900,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 900, height: 20 },
        { id: 'coin-1', type: 'coin', x: 260, y: 68, width: 34, height: 34 },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      runtime.advanceTime(520)
      const collected = readRuntimeState(runtime)

      expect(collected.totalCoins).toBe(1)
      expect(collected.coinCount).toBe(1)

      runtime.advanceTime(220)
      const stillOne = readRuntimeState(runtime)
      expect(stillOne.coinCount).toBe(1)

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
      runtime.advanceTime(17)
      const restarted = readRuntimeState(runtime)
      expect(restarted.mode).toBe('running')
      expect(restarted.coinCount).toBe(0)

      runtime.advanceTime(520)
      const recollected = readRuntimeState(runtime)
      expect(recollected.coinCount).toBe(1)
    } finally {
      runtime.dispose()
    }
  })
})
