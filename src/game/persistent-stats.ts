export const PERSISTED_STATS_KEY = 'gdclone.stats.v1'

export interface PersistentStats {
  bestCompletionSeconds: number | null
  bestCrashCount: number | null
  bestCoinCount: number | null
}

export interface StorageAdapter {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface UpdatePersistentStatsResult {
  stats: PersistentStats
  didChange: boolean
}

const DEFAULT_PERSISTENT_STATS: PersistentStats = {
  bestCompletionSeconds: null,
  bestCrashCount: null,
  bestCoinCount: null,
}

const isFiniteNonNegativeNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const sanitizeBestTime = (value: unknown): number | null => {
  return isFiniteNonNegativeNumber(value) ? value : null
}

const sanitizeCrashCount = (value: unknown): number | null => {
  return isFiniteNonNegativeNumber(value) ? Math.trunc(value) : null
}

const sanitizeCoinCount = (value: unknown): number | null => {
  return isFiniteNonNegativeNumber(value) ? Math.trunc(value) : null
}

const sanitizeStats = (value: unknown): PersistentStats => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PERSISTENT_STATS }
  }

  const candidate = value as Partial<Record<keyof PersistentStats, unknown>>
  return {
    bestCompletionSeconds: sanitizeBestTime(candidate.bestCompletionSeconds),
    bestCrashCount: sanitizeCrashCount(candidate.bestCrashCount),
    bestCoinCount: sanitizeCoinCount(candidate.bestCoinCount),
  }
}

export const readPersistentStats = (
  storage: StorageAdapter | null,
): PersistentStats => {
  if (!storage) {
    return { ...DEFAULT_PERSISTENT_STATS }
  }

  try {
    const raw = storage.getItem(PERSISTED_STATS_KEY)
    if (raw === null) {
      return { ...DEFAULT_PERSISTENT_STATS }
    }

    return sanitizeStats(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_PERSISTENT_STATS }
  }
}

export const writePersistentStats = (
  storage: StorageAdapter | null,
  stats: PersistentStats,
): void => {
  if (!storage) {
    return
  }

  const sanitized = sanitizeStats(stats)
  try {
    storage.setItem(PERSISTED_STATS_KEY, JSON.stringify(sanitized))
  } catch {
    // Best effort only; gameplay must keep running if persistence is blocked.
  }
}

export const updatePersistentStatsOnCompletion = (
  currentStats: PersistentStats,
  completionSeconds: number,
  crashCount: number,
  coinCount: number | null,
): UpdatePersistentStatsResult => {
  const nextStats = sanitizeStats(currentStats)
  let didChange = false

  const safeCompletion = sanitizeBestTime(completionSeconds)
  if (
    safeCompletion !== null &&
    (nextStats.bestCompletionSeconds === null ||
      safeCompletion < nextStats.bestCompletionSeconds)
  ) {
    nextStats.bestCompletionSeconds = safeCompletion
    didChange = true
  }

  const safeCrashCount = sanitizeCrashCount(crashCount)
  if (
    safeCrashCount !== null &&
    (nextStats.bestCrashCount === null || safeCrashCount < nextStats.bestCrashCount)
  ) {
    nextStats.bestCrashCount = safeCrashCount
    didChange = true
  }

  const safeCoinCount = sanitizeCoinCount(coinCount)
  if (
    safeCoinCount !== null &&
    (nextStats.bestCoinCount === null || safeCoinCount > nextStats.bestCoinCount)
  ) {
    nextStats.bestCoinCount = safeCoinCount
    didChange = true
  }

  return {
    stats: nextStats,
    didChange,
  }
}
