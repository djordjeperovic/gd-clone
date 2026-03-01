import { describe, expect, it, vi } from 'vitest'

vi.mock('./renderer', () => ({
  renderFrame: vi.fn(),
}))

import { createGameRuntime } from './runtime'

interface RuntimeTextState {
  mode: string
  runElapsedSeconds: number
  progressPercent: number
  orientationBlocked: boolean
}

const createCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')

  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({} as CanvasRenderingContext2D)),
  })

  return canvas
}

const readRuntimeState = (runtime: ReturnType<typeof createGameRuntime>): RuntimeTextState => {
  return JSON.parse(runtime.renderGameToText()) as RuntimeTextState
}

const pressSpace = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
}

describe('runtime orientation blocking', () => {
  it('freezes running simulation time/progress while blocked and resumes after unblocking', () => {
    const runtime = createGameRuntime({
      canvas: createCanvas(),
    })

    try {
      pressSpace()
      runtime.advanceTime(250)
      const started = readRuntimeState(runtime)

      expect(started.mode).toBe('running')
      expect(started.runElapsedSeconds).toBeGreaterThan(0)
      expect(started.progressPercent).toBeGreaterThan(0)

      runtime.setOrientationBlocked(true)
      runtime.advanceTime(1200)
      const blocked = readRuntimeState(runtime)

      expect(blocked.orientationBlocked).toBe(true)
      expect(blocked.mode).toBe('running')
      expect(blocked.runElapsedSeconds).toBe(started.runElapsedSeconds)
      expect(blocked.progressPercent).toBe(started.progressPercent)

      runtime.setOrientationBlocked(false)
      runtime.advanceTime(250)
      const resumed = readRuntimeState(runtime)

      expect(resumed.orientationBlocked).toBe(false)
      expect(resumed.runElapsedSeconds).toBeGreaterThan(blocked.runElapsedSeconds)
      expect(resumed.progressPercent).toBeGreaterThan(blocked.progressPercent)
    } finally {
      runtime.dispose()
    }
  })
})
