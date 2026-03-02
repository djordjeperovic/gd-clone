import { describe, expect, it } from 'vitest'

import {
  getOverlappingTriggers,
  intersects,
  isVisibleInCamera,
  resolveGroundCollision,
} from './collision'
import type { LevelObject, LevelTrigger, PlayerState, Rect } from './types'

const createPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  size: 20,
  rotation: 0,
  grounded: false,
  ...overrides,
})

describe('intersects', () => {
  it('returns true only when rectangles overlap by area', () => {
    const base: Rect = { x: 0, y: 0, width: 10, height: 10 }

    expect(intersects(base, { x: 9, y: 9, width: 4, height: 4 })).toBe(true)
    expect(intersects(base, { x: 10, y: 0, width: 4, height: 4 })).toBe(false)
    expect(intersects(base, { x: -6, y: 0, width: 5, height: 4 })).toBe(false)
  })
})

describe('resolveGroundCollision', () => {
  const solids: LevelObject[] = [
    { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 120, height: 20 },
  ]

  it('lands the player on top of a solid when falling through it', () => {
    const player = createPlayer({ x: 10, y: 90, vy: 240 })

    const grounded = resolveGroundCollision(player, solids, 40, 1)

    expect(grounded).toBe(true)
    expect(player.y).toBe(80)
    expect(player.vy).toBe(0)
  })

  it('resolves upward ceiling hits without marking grounded', () => {
    const player = createPlayer({ x: 10, y: 110, vy: -180 })

    const grounded = resolveGroundCollision(player, solids, 140, 1)

    expect(grounded).toBe(false)
    expect(player.y).toBe(120)
    expect(player.vy).toBe(0)
  })

  it('lands on the underside of a solid when gravity is inverted', () => {
    const player = createPlayer({ x: 10, y: 94, vy: -240 })

    const grounded = resolveGroundCollision(player, solids, 130, -1)

    expect(grounded).toBe(true)
    expect(player.y).toBe(120)
    expect(player.vy).toBe(0)
  })

  it('resolves downward top-surface hits while inverted without grounding', () => {
    const player = createPlayer({ x: 10, y: 88, vy: 180 })

    const grounded = resolveGroundCollision(player, solids, 72, -1)

    expect(grounded).toBe(false)
    expect(player.y).toBe(80)
    expect(player.vy).toBe(0)
  })
})

describe('trigger and visibility helpers', () => {
  it('returns overlapping checkpoint and speed triggers in order', () => {
    const player = createPlayer({ x: 10, y: 10, size: 20 })
    const triggers: LevelTrigger[] = [
      { id: 'checkpoint-1', type: 'checkpoint', x: 20, y: 0, width: 12, height: 36 },
      {
        id: 'speed-1',
        type: 'speed',
        x: 0,
        y: 20,
        width: 16,
        height: 12,
        speedMultiplier: 1.4,
      },
      { id: 'checkpoint-far', type: 'checkpoint', x: 160, y: 0, width: 20, height: 20 },
    ]

    const overlapping = getOverlappingTriggers(player, triggers)

    expect(overlapping.map((trigger) => trigger.id)).toEqual(['checkpoint-1', 'speed-1'])
  })

  it('treats camera edge contact as visible and outside bounds as hidden', () => {
    const cameraX = 100
    const viewportWidth = 800

    expect(isVisibleInCamera(50, 50, cameraX, viewportWidth)).toBe(true)
    expect(isVisibleInCamera(900, 10, cameraX, viewportWidth)).toBe(true)
    expect(isVisibleInCamera(911, 10, cameraX, viewportWidth)).toBe(false)
  })
})
