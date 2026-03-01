import { GROUND_Y } from './constants'
import type { LevelData, LevelObject, LevelTrigger } from './types'

const LEVEL_LENGTH = 5200
const GROUND_SEGMENT_WIDTH = 160
const SPIKE_SIZE = 30

const groundBlocks: LevelObject[] = []
for (let x = 0; x < LEVEL_LENGTH; x += GROUND_SEGMENT_WIDTH) {
  groundBlocks.push({
    id: `ground-${x}`,
    type: 'ground',
    x,
    y: GROUND_Y,
    width: GROUND_SEGMENT_WIDTH,
    height: 60,
  })
}

const earlySectionSpikes = [600, 860, 1090, 1124, 1380, 1660]
const midSectionSpikes = [
  1960, 2180, 2214, 2248, 2520, 2790, 2824, 3090, 3124, 3158, 3410,
]
const lateSectionSpikes = [
  3590, 3624, 3860, 4070, 4104, 4138, 4400, 4620, 4654, 4870, 4904,
]

const spikes: LevelObject[] = [
  ...earlySectionSpikes,
  ...midSectionSpikes,
  ...lateSectionSpikes,
].map((x, index) => ({
  id: `spike-${index + 1}`,
  type: 'spike',
  x,
  y: GROUND_Y - SPIKE_SIZE,
  width: SPIKE_SIZE,
  height: SPIKE_SIZE,
}))

const jumpOrbs: LevelObject[] = [
  { id: 'orb-1', type: 'jumpOrb', x: 2274, y: 292, width: 26, height: 26 },
  { id: 'orb-2', type: 'jumpOrb', x: 3068, y: 262, width: 26, height: 26 },
  { id: 'orb-3', type: 'jumpOrb', x: 3728, y: 276, width: 26, height: 26 },
  { id: 'orb-4', type: 'jumpOrb', x: 4518, y: 270, width: 26, height: 26 },
]

const triggers: LevelTrigger[] = [
  {
    id: 'checkpoint-1',
    type: 'checkpoint',
    x: 1330,
    y: 300,
    width: 26,
    height: 90,
  },
  {
    id: 'speed-1',
    type: 'speed',
    x: 1860,
    y: 300,
    width: 30,
    height: 90,
    speedMultiplier: 1.18,
  },
  {
    id: 'checkpoint-2',
    type: 'checkpoint',
    x: 2780,
    y: 300,
    width: 26,
    height: 90,
  },
  {
    id: 'speed-2',
    type: 'speed',
    x: 3520,
    y: 280,
    width: 30,
    height: 110,
    speedMultiplier: 1.35,
  },
  {
    id: 'checkpoint-3',
    type: 'checkpoint',
    x: 4300,
    y: 300,
    width: 26,
    height: 90,
  },
]

export const levelData: LevelData = {
  length: LEVEL_LENGTH,
  objects: [...groundBlocks, ...spikes, ...jumpOrbs],
  triggers,
}
