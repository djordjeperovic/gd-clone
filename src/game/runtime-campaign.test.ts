import { afterEach, describe, expect, it, vi } from 'vitest'

import { PERSISTED_PROGRESS_KEY } from './persistent-progress'
import type { StorageAdapter } from './persistent-stats'
import type { GameRuntime } from './runtime'

interface RuntimeTextState {
  mode: string
  runElapsedSeconds: number
  attempt: number
  coinCount: number
  levelId: string
}

interface MemoryStorage extends StorageAdapter {
  data: Map<string, string>
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

const createMemoryStorage = (seedProgress?: { currentLevelId: 'classic' | 'floating' }) => {
  const data = new Map<string, string>()
  if (seedProgress) {
    data.set(PERSISTED_PROGRESS_KEY, JSON.stringify(seedProgress))
  }

  const storage: MemoryStorage = {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }

  return storage
}

const createRuntimeWithCampaignLevels = async (
  storage?: StorageAdapter,
): Promise<GameRuntime> => {
  vi.resetModules()
  vi.doMock('./renderer', () => ({
    renderFrame: vi.fn(),
  }))
  vi.doMock('./levels', () => {
    const classic = {
      id: 'classic',
      name: 'Classic',
      data: {
        length: 260,
        objects: [
          { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 260, height: 20 },
          { id: 'coin-1', type: 'coin', x: 136, y: 70, width: 30, height: 30 },
        ],
        triggers: [],
      },
    }

    const floating = {
      id: 'floating',
      name: 'Floating',
      data: {
        length: 260,
        objects: [
          { id: 'ground-2', type: 'ground', x: 0, y: 100, width: 260, height: 20 },
          { id: 'floating-block', type: 'ground', x: 136, y: 58, width: 80, height: 18 },
        ],
        triggers: [],
      },
    }

    return {
      getLevelById: (levelId: 'classic' | 'floating') =>
        levelId === 'floating' ? floating : classic,
      getNextLevelId: (levelId: 'classic' | 'floating') =>
        levelId === 'classic' ? 'floating' : null,
      resolveLevel: (value: string | null | undefined) =>
        value === 'floating' ? floating : classic,
    }
  })

  const { createGameRuntime } = await import('./runtime')
  return createGameRuntime({
    canvas: createCanvas(),
    storage,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('runtime campaign progression', () => {
  it('auto-transitions from classic to floating and resets run context', async () => {
    const storage = createMemoryStorage()
    const runtime = await createRuntimeWithCampaignLevels(storage)

    try {
      startRun(runtime)

      let previous = readRuntimeState(runtime)
      expect(previous.levelId).toBe('classic')

      for (let index = 0; index < 30; index += 1) {
        runtime.advanceTime(17)
        const current = readRuntimeState(runtime)
        if (current.levelId === 'floating') {
          expect(current.mode).toBe('running')
          expect(current.attempt).toBe(2)
          expect(current.coinCount).toBe(0)
          expect(current.runElapsedSeconds).toBeLessThan(previous.runElapsedSeconds)
          expect(storage.data.get(PERSISTED_PROGRESS_KEY)).toBe(
            JSON.stringify({ currentLevelId: 'floating' }),
          )
          return
        }
        previous = current
      }

      throw new Error('Expected runtime to transition to floating level.')
    } finally {
      runtime.dispose()
    }
  })

  it('starts on floating when saved progress points to level 2', async () => {
    const storage = createMemoryStorage({ currentLevelId: 'floating' })
    const runtime = await createRuntimeWithCampaignLevels(storage)

    try {
      const beforeStart = readRuntimeState(runtime)
      expect(beforeStart.levelId).toBe('floating')
      expect(beforeStart.mode).toBe('menu')

      startRun(runtime)
      const running = readRuntimeState(runtime)
      expect(running.levelId).toBe('floating')
      expect(running.mode).toBe('running')
    } finally {
      runtime.dispose()
    }
  })
})
