import { describe, expect, it, vi } from 'vitest'

import { renderFrame } from './renderer'
import type { GameState, LevelData } from './types'

interface FillRectRecord {
  x: number
  y: number
  width: number
  height: number
  fillStyle: CanvasRenderingContext2D['fillStyle']
}

interface MockCanvasContext {
  ctx: CanvasRenderingContext2D
  fillRects: FillRectRecord[]
}

const FAR_LAYER_COLOR = 'rgba(171, 214, 255, 0.08)'
const MID_LAYER_COLOR = 'rgba(122, 189, 255, 0.13)'
const NEAR_LAYER_COLOR = 'rgba(255, 206, 136, 0.16)'

const level: LevelData = {
  length: 4000,
  objects: [],
  triggers: [],
}

const createState = (cameraX: number): GameState => ({
  mode: 'running',
  currentRunMode: 'running',
  attempt: 1,
  runElapsedSeconds: 3.4,
  completedRunSeconds: null,
  bestCompletionSeconds: null,
  crashCount: 0,
  player: {
    x: cameraX + 220,
    y: 250,
    vx: 300,
    vy: 0,
    size: 34,
    rotation: 0,
    grounded: true,
  },
  cameraX,
  progressPercent: 22,
  speedMultiplier: 1,
  gravityDirection: 1,
  deathTimer: 0,
  practiceCheckpoint: null,
  activatedCheckpointTriggers: new Set<string>(),
  activatedSpeedTriggers: new Set<string>(),
  activatedInteractives: new Set<string>(),
  particles: {
    items: [],
    trailTimer: 0,
    rngState: 1,
  },
})

const createMockContext = (): MockCanvasContext => {
  const fillRects: FillRectRecord[] = []
  const gradient = {
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient

  let fillStyle: CanvasRenderingContext2D['fillStyle'] = '#000'
  let strokeStyle: CanvasRenderingContext2D['strokeStyle'] = '#000'

  const ctx = {
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
      fillRects.push({
        x,
        y,
        width,
        height,
        fillStyle,
      })
    }),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    get fillStyle() {
      return fillStyle
    },
    set fillStyle(next: CanvasRenderingContext2D['fillStyle']) {
      fillStyle = next
    },
    get strokeStyle() {
      return strokeStyle
    },
    set strokeStyle(next: CanvasRenderingContext2D['strokeStyle']) {
      strokeStyle = next
    },
  } as unknown as CanvasRenderingContext2D

  return {
    ctx,
    fillRects,
  }
}

const renderAtCameraX = (cameraX: number): FillRectRecord[] => {
  const mock = createMockContext()
  renderFrame({
    ctx: mock.ctx,
    state: createState(cameraX),
    level,
  })
  return mock.fillRects
}

const selectLayerRects = (
  fillRects: readonly FillRectRecord[],
  layerColor: string,
): FillRectRecord[] => {
  return fillRects.filter((record) => record.fillStyle === layerColor)
}

const getAnchorX = (
  fillRects: readonly FillRectRecord[],
  layerColor: string,
  width: number,
  height: number,
): number => {
  const xs = fillRects
    .filter(
      (record) =>
        record.fillStyle === layerColor &&
        record.width === width &&
        record.height === height,
    )
    .map((record) => record.x)
    .sort((a, b) => a - b)

  expect(xs.length).toBeGreaterThan(0)
  return xs[0]
}

const toLayerSignature = (
  fillRects: readonly FillRectRecord[],
  layerColor: string,
): string[] => {
  return selectLayerRects(fillRects, layerColor).map(
    (record) => `${record.x}:${record.y}:${record.width}:${record.height}`,
  )
}

describe('renderer parallax background', () => {
  it('draws far, mid, and near parallax layers', () => {
    const fillRects = renderAtCameraX(0)

    expect(selectLayerRects(fillRects, FAR_LAYER_COLOR).length).toBeGreaterThan(0)
    expect(selectLayerRects(fillRects, MID_LAYER_COLOR).length).toBeGreaterThan(0)
    expect(selectLayerRects(fillRects, NEAR_LAYER_COLOR).length).toBeGreaterThan(0)
  })

  it('moves near layers faster than far layers as camera advances', () => {
    const atStart = renderAtCameraX(0)
    const atCameraShift = renderAtCameraX(200)

    const farDelta = Math.abs(
      getAnchorX(atCameraShift, FAR_LAYER_COLOR, 138, 24) -
        getAnchorX(atStart, FAR_LAYER_COLOR, 138, 24),
    )
    const midDelta = Math.abs(
      getAnchorX(atCameraShift, MID_LAYER_COLOR, 126, 28) -
        getAnchorX(atStart, MID_LAYER_COLOR, 126, 28),
    )
    const nearDelta = Math.abs(
      getAnchorX(atCameraShift, NEAR_LAYER_COLOR, 112, 36) -
        getAnchorX(atStart, NEAR_LAYER_COLOR, 112, 36),
    )

    expect(midDelta).toBeGreaterThan(farDelta)
    expect(nearDelta).toBeGreaterThan(midDelta)
  })

  it('produces stable layer geometry for the same camera position', () => {
    const first = renderAtCameraX(350)
    const second = renderAtCameraX(350)

    expect(toLayerSignature(second, FAR_LAYER_COLOR)).toEqual(
      toLayerSignature(first, FAR_LAYER_COLOR),
    )
    expect(toLayerSignature(second, MID_LAYER_COLOR)).toEqual(
      toLayerSignature(first, MID_LAYER_COLOR),
    )
    expect(toLayerSignature(second, NEAR_LAYER_COLOR)).toEqual(
      toLayerSignature(first, NEAR_LAYER_COLOR),
    )
  })
})
