import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PERSISTED_STATS_KEY,
  type StorageAdapter,
} from './persistent-stats'
import type { GameRuntime } from './runtime'
import type { LevelData } from './types'

interface RuntimeTextState {
  mode: string
  runMode: string
  bestCompletionSeconds: number | null
  bestCrashCount: number | null
  bestCoinCount: number | null
  coinCount: number
}

interface CountingStorage extends StorageAdapter {
  setCalls: number
  payloads: string[]
}

const createCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')

  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({} as CanvasRenderingContext2D)),
  })

  return canvas
}

const pressKey = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }))
}

const startRun = (
  runtime: GameRuntime,
  options: { practice?: boolean } = {},
): void => {
  if (options.practice) {
    pressKey('KeyP')
    runtime.advanceTime(17)
  }

  pressKey('Space')
  runtime.advanceTime(17)
  runtime.advanceTime(17)
}

const readRuntimeState = (runtime: GameRuntime): RuntimeTextState => {
  return JSON.parse(runtime.renderGameToText()) as RuntimeTextState
}

const baseLevel: LevelData = {
  length: 220,
  objects: [
    { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 220, height: 20 },
  ],
  triggers: [],
}

const coinLevel: LevelData = {
  length: 240,
  objects: [
    { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 240, height: 20 },
    { id: 'coin-1', type: 'coin', x: 128, y: 70, width: 30, height: 30 },
  ],
  triggers: [],
}

const createRuntimeForLevel = async (
  level: LevelData,
  storage?: StorageAdapter,
): Promise<GameRuntime> => {
  vi.resetModules()
  vi.doMock('./renderer', () => ({
    renderFrame: vi.fn(),
  }))

  const { createGameRuntime } = await import('./runtime')
  return createGameRuntime({
    canvas: createCanvas(),
    storage,
    level,
  })
}

const createCountingStorage = (seed?: string): CountingStorage => {
  const data = new Map<string, string>()
  if (typeof seed === 'string') {
    data.set(PERSISTED_STATS_KEY, seed)
  }

  const storage: CountingStorage = {
    setCalls: 0,
    payloads: [],
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.setCalls += 1
      storage.payloads.push(value)
      data.set(key, value)
    },
  }

  return storage
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('runtime persistent stats', () => {
  it('loads saved stats during runtime creation', async () => {
    const storage = createCountingStorage(
      JSON.stringify({
        bestCompletionSeconds: 12.34,
        bestCrashCount: 1,
        bestCoinCount: 3,
      }),
    )
    const runtime = await createRuntimeForLevel(baseLevel, storage)

    try {
      const state = readRuntimeState(runtime)
      expect(state.bestCompletionSeconds).toBe(12.34)
      expect(state.bestCrashCount).toBe(1)
      expect(state.bestCoinCount).toBe(3)
    } finally {
      runtime.dispose()
    }
  })

  it('persists improved records on completion', async () => {
    const storage = createCountingStorage(
      JSON.stringify({
        bestCompletionSeconds: 60,
        bestCrashCount: 4,
        bestCoinCount: 0,
      }),
    )
    const runtime = await createRuntimeForLevel(coinLevel, storage)

    try {
      startRun(runtime)
      runtime.advanceTime(600)
      const state = readRuntimeState(runtime)

      expect(state.mode).toBe('complete')
      expect(state.bestCompletionSeconds).not.toBeNull()
      expect(state.bestCompletionSeconds).toBeLessThan(60)
      expect(state.bestCrashCount).toBe(0)
      expect(state.coinCount).toBe(1)
      expect(state.bestCoinCount).toBe(1)
      expect(storage.setCalls).toBeGreaterThan(0)

      const finalPayload = storage.payloads[storage.payloads.length - 1]
      const persisted = JSON.parse(finalPayload) as {
        bestCompletionSeconds: number
        bestCrashCount: number
        bestCoinCount: number
      }
      expect(persisted.bestCrashCount).toBe(0)
      expect(persisted.bestCompletionSeconds).toBeLessThan(60)
      expect(persisted.bestCoinCount).toBe(1)
      expect(persisted.bestCompletionSeconds).toBeCloseTo(
        state.bestCompletionSeconds ?? 0,
        2,
      )
    } finally {
      runtime.dispose()
    }
  })

  it('does not overwrite saved records with worse completion results', async () => {
    const storage = createCountingStorage(
      JSON.stringify({
        bestCompletionSeconds: 0.01,
        bestCrashCount: 0,
        bestCoinCount: 3,
      }),
    )
    const runtime = await createRuntimeForLevel(baseLevel, storage)

    try {
      startRun(runtime)
      runtime.advanceTime(250)
      const state = readRuntimeState(runtime)

      expect(state.mode).toBe('complete')
      expect(state.bestCompletionSeconds).toBe(0.01)
      expect(state.bestCrashCount).toBe(0)
      expect(state.bestCoinCount).toBe(3)
      expect(storage.setCalls).toBe(0)
    } finally {
      runtime.dispose()
    }
  })

  it('continues gameplay when storage access throws', async () => {
    const storage: StorageAdapter = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const runtime = await createRuntimeForLevel(baseLevel, storage)

    try {
      startRun(runtime)
      runtime.advanceTime(250)
      const state = readRuntimeState(runtime)

      expect(state.mode).toBe('complete')
      expect(state.bestCompletionSeconds).not.toBeNull()
      expect(state.bestCrashCount).toBe(0)
      expect(state.bestCoinCount).toBeNull()
    } finally {
      runtime.dispose()
    }
  })

  it('tracks practice coins but never writes saved records from practice runs', async () => {
    const storage = createCountingStorage(
      JSON.stringify({
        bestCompletionSeconds: 0.01,
        bestCrashCount: 0,
        bestCoinCount: 5,
      }),
    )
    const runtime = await createRuntimeForLevel(coinLevel, storage)

    try {
      startRun(runtime, { practice: true })
      runtime.advanceTime(600)
      const state = readRuntimeState(runtime)

      expect(state.mode).toBe('complete')
      expect(state.runMode).toBe('practice')
      expect(state.coinCount).toBe(1)
      expect(state.bestCoinCount).toBe(5)
      expect(storage.setCalls).toBe(0)
    } finally {
      runtime.dispose()
    }
  })
})
