import { describe, expect, it } from 'vitest'

import {
  PERSISTED_PROGRESS_KEY,
  readPersistentProgress,
  writePersistentProgress,
} from './persistent-progress'
import type { StorageAdapter } from './persistent-stats'

interface MemoryStorage extends StorageAdapter {
  data: Map<string, string>
}

const createMemoryStorage = (seed?: string): MemoryStorage => {
  const data = new Map<string, string>()
  if (typeof seed === 'string') {
    data.set(PERSISTED_PROGRESS_KEY, seed)
  }

  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('persistent progress storage', () => {
  it('returns classic when storage is unavailable or empty', () => {
    expect(readPersistentProgress(null)).toEqual({
      currentLevelId: 'classic',
    })

    expect(readPersistentProgress(createMemoryStorage())).toEqual({
      currentLevelId: 'classic',
    })
  })

  it('reads floating level id from storage', () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        currentLevelId: 'floating',
      }),
    )

    expect(readPersistentProgress(storage)).toEqual({
      currentLevelId: 'floating',
    })
  })

  it('falls back to classic for malformed JSON or unknown level ids', () => {
    const malformed = createMemoryStorage('{')
    expect(readPersistentProgress(malformed)).toEqual({
      currentLevelId: 'classic',
    })

    const unknownLevel = createMemoryStorage(
      JSON.stringify({
        currentLevelId: 'unknown',
      }),
    )
    expect(readPersistentProgress(unknownLevel)).toEqual({
      currentLevelId: 'classic',
    })
  })

  it('writes sanitized progress', () => {
    const storage = createMemoryStorage()
    writePersistentProgress(storage, {
      currentLevelId: 'floating',
    })

    expect(storage.data.get(PERSISTED_PROGRESS_KEY)).toBe(
      JSON.stringify({
        currentLevelId: 'floating',
      }),
    )
  })

  it('swallows storage write errors', () => {
    const blockedStorage: StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(() =>
      writePersistentProgress(blockedStorage, {
        currentLevelId: 'classic',
      }),
    ).not.toThrow()
  })
})
