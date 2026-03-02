import type { LevelDefinition, LevelId } from '../types'
import { classicLevelData } from './classic'
import { floatingLevelData } from './floating'

export const DEFAULT_LEVEL_ID: LevelId = 'classic'

const LEVELS: Record<LevelId, LevelDefinition> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    data: classicLevelData,
  },
  floating: {
    id: 'floating',
    name: 'Floating Platforms',
    data: floatingLevelData,
  },
}

export const getLevelById = (levelId: LevelId): LevelDefinition => LEVELS[levelId]

export const resolveLevel = (value: string | null | undefined): LevelDefinition => {
  if (value === 'classic' || value === 'floating') {
    return LEVELS[value]
  }
  return LEVELS[DEFAULT_LEVEL_ID]
}

export const getNextLevelId = (levelId: LevelId): LevelId | null => {
  if (levelId === 'classic') {
    return 'floating'
  }

  return null
}
