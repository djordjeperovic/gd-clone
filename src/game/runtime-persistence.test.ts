import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PERSISTED_STATS_KEY,
  type StorageAdapter,
} from './persistent-stats'
import type { GameRuntime } from './runtime'
import type { LevelData } from './types'

interface RuntimeTextState {
  mode: string
  bestCompletionSeconds: number | null
  bestCrashCount: number | null
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

const pressSpace = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
}

const startRun = (runtime: GameRuntime): void => {
  pressSpace()
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

const createRuntimeForLevel = async (
  level: LevelData,
  storage?: StorageAdapter,
): Promise<GameRuntime> => {
  vi.resetModules()
  vi.doMock('./renderer', () => ({
    renderFrame: vi.fn(),
  }))
  vi.doMock('./levelData', () => ({
    levelData: level,
  }))

  const { createGameRuntime } = await import('./runtime')
  return createGameRuntime({
    canvas: createCanvas(),
    storage,
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
      }),
    )
    const runtime = await createRuntimeForLevel(baseLevel, storage)

    try {
      const state = readRuntimeState(runtime)
      expect(state.bestCompletionSeconds).toBe(12.34)
      expect(state.bestCrashCount).toBe(1)
    } finally {
      runtime.dispose()
    }
  })

  it('persists improved records on completion', async () => {
    const storage = createCountingStorage(
      JSON.stringify({
        bestCompletionSeconds: 60,
        bestCrashCount: 4,
      }),
    )
    const runtime = await createRuntimeForLevel(baseLevel, storage)

    try {
      startRun(runtime)
      runtime.advanceTime(250)
      const state = readRuntimeState(runtime)

      expect(state.mode).toBe('complete')
      expect(state.bestCompletionSeconds).not.toBeNull()
      expect(state.bestCompletionSeconds).toBeLessThan(60)
      expect(state.bestCrashCount).toBe(0)
      expect(storage.setCalls).toBeGreaterThan(0)

      const finalPayload = storage.payloads[storage.payloads.length - 1]
      const persisted = JSON.parse(finalPayload) as {
        bestCompletionSeconds: number
        bestCrashCount: number
      }
      expect(persisted.bestCrashCount).toBe(0)
      expect(persisted.bestCompletionSeconds).toBeLessThan(60)
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
    } finally {
      runtime.dispose()
    }
  })
})
