import { describe, expect, it } from 'vitest'

import {
  PERSISTED_STATS_KEY,
  readPersistentStats,
  updatePersistentStatsOnCompletion,
  writePersistentStats,
  type StorageAdapter,
} from './persistent-stats'

interface MemoryStorage extends StorageAdapter {
  data: Map<string, string>
}

const createMemoryStorage = (seed?: string): MemoryStorage => {
  const data = new Map<string, string>()
  if (typeof seed === 'string') {
    data.set(PERSISTED_STATS_KEY, seed)
  }

  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('persistent stats storage', () => {
  it('returns defaults when storage is unavailable or empty', () => {
    expect(readPersistentStats(null)).toEqual({
      bestCompletionSeconds: null,
      bestCrashCount: null,
      bestCoinCount: null,
    })

    expect(readPersistentStats(createMemoryStorage())).toEqual({
      bestCompletionSeconds: null,
      bestCrashCount: null,
      bestCoinCount: null,
    })
  })

  it('reads saved stats from storage', () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        bestCompletionSeconds: 14.77,
        bestCrashCount: 2,
        bestCoinCount: 4,
      }),
    )

    expect(readPersistentStats(storage)).toEqual({
      bestCompletionSeconds: 14.77,
      bestCrashCount: 2,
      bestCoinCount: 4,
    })
  })

  it('falls back to defaults when stored json is malformed', () => {
    const storage = createMemoryStorage('{')
    expect(readPersistentStats(storage)).toEqual({
      bestCompletionSeconds: null,
      bestCrashCount: null,
      bestCoinCount: null,
    })
  })

  it('sanitizes invalid persisted values', () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        bestCompletionSeconds: '14.77',
        bestCrashCount: -1,
        bestCoinCount: 3.6,
      }),
    )

    expect(readPersistentStats(storage)).toEqual({
      bestCompletionSeconds: null,
      bestCrashCount: null,
      bestCoinCount: 3,
    })
  })

  it('writes sanitized values to storage', () => {
    const storage = createMemoryStorage()
    writePersistentStats(storage, {
      bestCompletionSeconds: Number.POSITIVE_INFINITY,
      bestCrashCount: 2.9,
      bestCoinCount: Number.NEGATIVE_INFINITY,
    })

    expect(storage.data.get(PERSISTED_STATS_KEY)).toBe(
      JSON.stringify({
        bestCompletionSeconds: null,
        bestCrashCount: 2,
        bestCoinCount: null,
      }),
    )
  })

  it('swallows storage write errors', () => {
    const storage: StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(() =>
      writePersistentStats(storage, {
        bestCompletionSeconds: 12.4,
        bestCrashCount: 1,
        bestCoinCount: 2,
      }),
    ).not.toThrow()
  })
})

describe('persistent stats updates', () => {
  it('updates records when completion is faster, lower crash, or higher coin count', () => {
    const { stats, didChange } = updatePersistentStatsOnCompletion(
      {
        bestCompletionSeconds: 16.2,
        bestCrashCount: 4,
        bestCoinCount: 2,
      },
      15.3,
      2,
      4,
    )

    expect(didChange).toBe(true)
    expect(stats).toEqual({
      bestCompletionSeconds: 15.3,
      bestCrashCount: 2,
      bestCoinCount: 4,
    })
  })

  it('does not change records when completion is worse and coin count is lower', () => {
    const { stats, didChange } = updatePersistentStatsOnCompletion(
      {
        bestCompletionSeconds: 14.2,
        bestCrashCount: 1,
        bestCoinCount: 5,
      },
      14.9,
      3,
      4,
    )

    expect(didChange).toBe(false)
    expect(stats).toEqual({
      bestCompletionSeconds: 14.2,
      bestCrashCount: 1,
      bestCoinCount: 5,
    })
  })

  it('does not update bestCoinCount when coin tracking is unavailable', () => {
    const { stats, didChange } = updatePersistentStatsOnCompletion(
      {
        bestCompletionSeconds: 14.2,
        bestCrashCount: 1,
        bestCoinCount: 5,
      },
      14.2,
      1,
      null,
    )

    expect(didChange).toBe(false)
    expect(stats).toEqual({
      bestCompletionSeconds: 14.2,
      bestCrashCount: 1,
      bestCoinCount: 5,
    })
  })
})
