import type { LevelId } from './types'
import type { StorageAdapter } from './persistent-stats'

export const PERSISTED_PROGRESS_KEY = 'gdclone.progress.v1'

export interface PersistentProgress {
  currentLevelId: LevelId
}

const DEFAULT_PERSISTENT_PROGRESS: PersistentProgress = {
  currentLevelId: 'classic',
}

const sanitizeLevelId = (value: unknown): LevelId => {
  if (value === 'floating') {
    return 'floating'
  }

  return 'classic'
}

const sanitizeProgress = (value: unknown): PersistentProgress => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PERSISTENT_PROGRESS }
  }

  const candidate = value as Partial<Record<keyof PersistentProgress, unknown>>
  return {
    currentLevelId: sanitizeLevelId(candidate.currentLevelId),
  }
}

export const readPersistentProgress = (
  storage: StorageAdapter | null,
): PersistentProgress => {
  if (!storage) {
    return { ...DEFAULT_PERSISTENT_PROGRESS }
  }

  try {
    const raw = storage.getItem(PERSISTED_PROGRESS_KEY)
    if (raw === null) {
      return { ...DEFAULT_PERSISTENT_PROGRESS }
    }

    return sanitizeProgress(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_PERSISTENT_PROGRESS }
  }
}

export const writePersistentProgress = (
  storage: StorageAdapter | null,
  progress: PersistentProgress,
): void => {
  if (!storage) {
    return
  }

  const sanitized = sanitizeProgress(progress)
  try {
    storage.setItem(PERSISTED_PROGRESS_KEY, JSON.stringify(sanitized))
  } catch {
    // Best effort only; gameplay must keep running if persistence is blocked.
  }
}
