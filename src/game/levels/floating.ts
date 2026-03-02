import { GROUND_Y } from '../constants'
import type { LevelData, LevelObject, LevelTrigger } from '../types'

const LEVEL_LENGTH = 3600
const GROUND_SEGMENT_WIDTH = 120
const SPIKE_SIZE = 30

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

const spikeXs = [
  520, 740, 960, 1180, 1400, 1620, 1840, 2060, 2280, 2500, 2720, 2940, 3160,
  3380,
]

const spikes: LevelObject[] = spikeXs.map((x, index) => ({
  id: `floating-spike-${index + 1}`,
  type: 'spike',
  x,
  y: GROUND_Y - SPIKE_SIZE,
  width: SPIKE_SIZE,
  height: SPIKE_SIZE,
}))

const floatingPlatforms: LevelObject[] = [
  {
    id: 'floating-platform-1',
    type: 'ground',
    x: 640,
    y: 278,
    width: 120,
    height: 18,
  },
  {
    id: 'floating-platform-2',
    type: 'ground',
    x: 980,
    y: 216,
    width: 110,
    height: 18,
  },
  {
    id: 'floating-platform-3',
    type: 'ground',
    x: 1320,
    y: 186,
    width: 130,
    height: 18,
  },
  {
    id: 'floating-platform-4',
    type: 'ground',
    x: 1760,
    y: 246,
    width: 120,
    height: 18,
  },
  {
    id: 'floating-platform-5',
    type: 'ground',
    x: 2140,
    y: 208,
    width: 130,
    height: 18,
  },
  {
    id: 'floating-platform-6',
    type: 'ground',
    x: 2500,
    y: 180,
    width: 120,
    height: 18,
  },
  {
    id: 'floating-platform-7',
    type: 'ground',
    x: 2860,
    y: 238,
    width: 130,
    height: 18,
  },
  {
    id: 'floating-platform-8',
    type: 'ground',
    x: 3220,
    y: 202,
    width: 140,
    height: 18,
  },
]

const coins: LevelObject[] = [
  { id: 'floating-coin-1', type: 'coin', x: 690, y: 218, width: 24, height: 24 },
  { id: 'floating-coin-2', type: 'coin', x: 1030, y: 184, width: 24, height: 24 },
  { id: 'floating-coin-3', type: 'coin', x: 2190, y: 176, width: 24, height: 24 },
  { id: 'floating-coin-4', type: 'coin', x: 2540, y: 148, width: 24, height: 24 },
  { id: 'floating-coin-5', type: 'coin', x: 3270, y: 170, width: 24, height: 24 },
]

const triggers: LevelTrigger[] = [
  {
    id: 'floating-checkpoint-1',
    type: 'checkpoint',
    x: 1280,
    y: 280,
    width: 26,
    height: 110,
  },
  {
    id: 'floating-speed-1',
    type: 'speed',
    x: 1800,
    y: 280,
    width: 30,
    height: 110,
    speedMultiplier: 1.08,
  },
  {
    id: 'floating-checkpoint-2',
    type: 'checkpoint',
    x: 2360,
    y: 280,
    width: 26,
    height: 110,
  },
  {
    id: 'floating-speed-2',
    type: 'speed',
    x: 2800,
    y: 280,
    width: 30,
    height: 110,
    speedMultiplier: 1.14,
  },
]

export const floatingLevelData: LevelData = {
  length: LEVEL_LENGTH,
  objects: [...groundBlocks, ...spikes, ...floatingPlatforms, ...coins],
  triggers,
}
