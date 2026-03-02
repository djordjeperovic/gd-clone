import { GROUND_Y } from '../constants'
import type { LevelData, LevelObject, LevelTrigger } from '../types'

const LEVEL_LENGTH = 720
const GROUND_SEGMENT_WIDTH = 120

const groundBlocks: LevelObject[] = []
for (let x = 0; x < LEVEL_LENGTH; x += GROUND_SEGMENT_WIDTH) {
  groundBlocks.push({
    id: `floating-ground-${x}`,
    type: 'ground',
    x,
    y: GROUND_Y,
    width: GROUND_SEGMENT_WIDTH,
    height: 60,
  })
}

const floatingPlatforms: LevelObject[] = [
  {
    id: 'floating-platform-1',
    type: 'ground',
    x: 180,
    y: 318,
    width: 120,
    height: 18,
  },
  {
    id: 'floating-platform-2',
    type: 'ground',
    x: 328,
    y: 270,
    width: 110,
    height: 18,
  },
  {
    id: 'floating-platform-3',
    type: 'ground',
    x: 468,
    y: 226,
    width: 120,
    height: 18,
  },
]

const coins: LevelObject[] = [
  { id: 'floating-coin-1', type: 'coin', x: 226, y: 286, width: 24, height: 24 },
  { id: 'floating-coin-2', type: 'coin', x: 370, y: 238, width: 24, height: 24 },
  { id: 'floating-coin-3', type: 'coin', x: 512, y: 194, width: 24, height: 24 },
]

const triggers: LevelTrigger[] = [
  {
    id: 'floating-checkpoint-1',
    type: 'checkpoint',
    x: 404,
    y: 246,
    width: 26,
    height: 90,
  },
]

export const floatingLevelData: LevelData = {
  length: LEVEL_LENGTH,
  objects: [...groundBlocks, ...floatingPlatforms, ...coins],
  triggers,
}
