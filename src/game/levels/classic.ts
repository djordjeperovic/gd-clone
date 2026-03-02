import { GROUND_Y } from '../constants'
import type { LevelData, LevelObject, LevelTrigger } from '../types'

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
const lateSectionSpikes = [3608, 3650, 3892, 4114, 4156, 4438, 4676, 4922]

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
  { id: 'orb-1', type: 'jumpOrb', x: 2258, y: 314, width: 26, height: 26 },
  { id: 'orb-2', type: 'jumpOrb', x: 3102, y: 300, width: 26, height: 26 },
  { id: 'orb-3', type: 'jumpOrb', x: 3898, y: 304, width: 26, height: 26 },
  { id: 'orb-4', type: 'jumpOrb', x: 4668, y: 300, width: 26, height: 26 },
]

const coins: LevelObject[] = [
  { id: 'coin-1', type: 'coin', x: 872, y: 330, width: 24, height: 24 },
  { id: 'coin-2', type: 'coin', x: 1970, y: 330, width: 24, height: 24 },
  { id: 'coin-3', type: 'coin', x: 2828, y: 330, width: 24, height: 24 },
  { id: 'coin-4', type: 'coin', x: 4148, y: 330, width: 24, height: 24 },
  { id: 'coin-5', type: 'coin', x: 4928, y: 330, width: 24, height: 24 },
]

const mechanicsShowcaseObjects: LevelObject[] = [
  {
    id: 'ground-ceiling-1',
    type: 'ground',
    x: 1550,
    y: 52,
    width: 220,
    height: 18,
  },
  {
    id: 'jump-pad-1',
    type: 'jumpPad',
    x: 1460,
    y: 320,
    width: 30,
    height: 12,
  },
  {
    id: 'gravity-portal-1',
    type: 'gravityPortal',
    x: 1515,
    y: 170,
    width: 30,
    height: 70,
  },
  {
    id: 'dash-orb-1',
    type: 'dashOrb',
    x: 1640,
    y: 84,
    width: 26,
    height: 26,
  },
  {
    id: 'gravity-portal-2',
    type: 'gravityPortal',
    x: 1730,
    y: 64,
    width: 30,
    height: 76,
  },
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
    speedMultiplier: 1.28,
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

export const classicLevelData: LevelData = {
  length: LEVEL_LENGTH,
  objects: [
    ...groundBlocks,
    ...spikes,
    ...jumpOrbs,
    ...coins,
    ...mechanicsShowcaseObjects,
  ],
  triggers,
}
