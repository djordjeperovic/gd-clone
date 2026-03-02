import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GameRuntime } from './runtime'
import type { GameMode, LevelData, ParticleKind } from './types'

interface RenderSnapshot {
  mode: GameMode
  particleCount: number
  particleKinds: ParticleKind[]
}

interface MockRenderArgs {
  state: {
    mode: GameMode
    particles: {
      items: Array<{
        kind: ParticleKind
      }>
    }
  }
}

let latestRenderSnapshot: RenderSnapshot | null = null

const createCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')

  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({} as CanvasRenderingContext2D)),
  })

  return canvas
}

const pressKey = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }))
}

const startRun = (runtime: GameRuntime): void => {
  pressKey('Space')
  runtime.advanceTime(17)
  runtime.advanceTime(17)
}

const readRenderSnapshot = (runtime: GameRuntime): RenderSnapshot => {
  runtime.render()
  if (!latestRenderSnapshot) {
    throw new Error('Expected mocked renderer to capture state.')
  }

  return {
    mode: latestRenderSnapshot.mode,
    particleCount: latestRenderSnapshot.particleCount,
    particleKinds: [...latestRenderSnapshot.particleKinds],
  }
}

const createRuntimeForLevel = async (level: LevelData): Promise<GameRuntime> => {
  vi.resetModules()
  latestRenderSnapshot = null

  vi.doMock('./renderer', () => ({
    renderFrame: vi.fn((args: MockRenderArgs) => {
      latestRenderSnapshot = {
        mode: args.state.mode,
        particleCount: args.state.particles.items.length,
        particleKinds: args.state.particles.items.map((particle) => particle.kind),
      }
    }),
  }))

  const { createGameRuntime } = await import('./runtime')
  return createGameRuntime({
    canvas: createCanvas(),
    level,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  latestRenderSnapshot = null
})

describe('runtime particle effects', () => {
  it('emits trail particles while running and clears them on restart', async () => {
    const runtime = await createRuntimeForLevel({
      length: 1200,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 1200, height: 20 },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      runtime.advanceTime(260)
      const running = readRenderSnapshot(runtime)
      expect(running.particleCount).toBeGreaterThan(0)
      expect(running.particleKinds).toContain('trail')

      pressKey('KeyR')
      runtime.advanceTime(17)
      const restarted = readRenderSnapshot(runtime)
      expect(restarted.mode).toBe('running')
      expect(restarted.particleCount).toBe(0)
    } finally {
      runtime.dispose()
    }
  })

  it('spawns orb spark particles only when an orb is activated by jump input', async () => {
    const runtime = await createRuntimeForLevel({
      length: 1000,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 1000, height: 20 },
        { id: 'orb-1', type: 'jumpOrb', x: 128, y: 60, width: 80, height: 52 },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      runtime.advanceTime(34)
      const withoutActivation = readRenderSnapshot(runtime)
      expect(withoutActivation.particleKinds).not.toContain('spark')

      pressKey('Space')
      runtime.advanceTime(17)
      const activated = readRenderSnapshot(runtime)
      expect(activated.particleKinds).toContain('spark')
    } finally {
      runtime.dispose()
    }
  })

  it('creates crash shards on death and keeps simulating particles while dead', async () => {
    const runtime = await createRuntimeForLevel({
      length: 900,
      objects: [
        { id: 'ground-1', type: 'ground', x: 0, y: 100, width: 900, height: 20 },
        { id: 'spike-1', type: 'spike', x: 170, y: 70, width: 30, height: 30 },
      ],
      triggers: [],
    })

    try {
      startRun(runtime)
      runtime.advanceTime(220)
      const crashed = readRenderSnapshot(runtime)
      expect(crashed.mode).toBe('dead')
      expect(crashed.particleKinds).toContain('shard')

      runtime.advanceTime(120)
      const deadStep = readRenderSnapshot(runtime)
      expect(deadStep.mode).toBe('dead')
      expect(deadStep.particleCount).toBeGreaterThan(0)
      expect(deadStep.particleCount).toBeLessThanOrEqual(crashed.particleCount)
    } finally {
      runtime.dispose()
    }
  })
})
