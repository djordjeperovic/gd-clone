import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioSystem } from './audio'

type AudioContextConstructor = new () => AudioContext

type AudioGlobal = typeof globalThis & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

interface ParamEvent {
  type: 'set' | 'linear' | 'exp' | 'cancel'
  value?: number
  time: number
}

class FakeAudioParam {
  readonly events: ParamEvent[] = []

  setValueAtTime(value: number, time: number): void {
    this.events.push({ type: 'set', value, time })
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.events.push({ type: 'linear', value, time })
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.events.push({ type: 'exp', value, time })
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ type: 'cancel', time })
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam()

  connect(target: unknown): unknown {
    return target
  }

  disconnect(): void {}
}

class FakeOscillatorNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam()
  readonly detune = new FakeAudioParam()
  readonly starts: number[] = []
  readonly stops: number[] = []
  onended: ((this: OscillatorNode, ev: Event) => unknown) | null = null

  connect(target: unknown): unknown {
    return target
  }

  disconnect(): void {}

  start(when = 0): void {
    this.starts.push(when)
  }

  stop(when = 0): void {
    this.stops.push(when)
    if (this.onended) {
      this.onended.call(this as unknown as OscillatorNode, new Event('ended'))
    }
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: AudioContextState = 'running'
  currentTime = 10
  readonly destination = {} as AudioDestinationNode
  readonly oscillators: FakeOscillatorNode[] = []
  readonly gains: FakeGainNode[] = []

  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillatorNode()
    this.oscillators.push(oscillator)
    return oscillator as unknown as OscillatorNode
  }

  createGain(): GainNode {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }
}

const audioGlobal = globalThis as AudioGlobal
let originalAudioContext: AudioContextConstructor | undefined
let originalWebkitAudioContext: AudioContextConstructor | undefined

const restoreAudioGlobals = (): void => {
  if (originalAudioContext) {
    audioGlobal.AudioContext = originalAudioContext
  } else {
    Reflect.deleteProperty(audioGlobal, 'AudioContext')
  }

  if (originalWebkitAudioContext) {
    audioGlobal.webkitAudioContext = originalWebkitAudioContext
  } else {
    Reflect.deleteProperty(audioGlobal, 'webkitAudioContext')
  }
}

const getSweepValues = (oscillator: FakeOscillatorNode): [number, number] => {
  const start = oscillator.frequency.events.find((event) => event.type === 'set')
  const end = oscillator.frequency.events.find((event) => event.type === 'exp')
  expect(start?.value).toBeTypeOf('number')
  expect(end?.value).toBeTypeOf('number')
  return [start?.value ?? 0, end?.value ?? 0]
}

beforeEach(() => {
  FakeAudioContext.instances = []
  originalAudioContext = audioGlobal.AudioContext
  originalWebkitAudioContext = audioGlobal.webkitAudioContext
  Reflect.deleteProperty(audioGlobal, 'AudioContext')
  Reflect.deleteProperty(audioGlobal, 'webkitAudioContext')
})

afterEach(() => {
  restoreAudioGlobals()
})

describe('AudioSystem', () => {
  it('acts as a no-op when AudioContext is unavailable', async () => {
    const audio = new AudioSystem()

    await expect(audio.resumeIfNeeded()).resolves.toBeUndefined()
    expect(() => {
      audio.playJump()
      audio.playOrbJump()
      audio.playJumpPad()
      audio.playDashOrb()
      audio.playGravityFlip()
      audio.playCrash()
      audio.playCheckpoint()
      audio.playSpeedChange(1.25)
      audio.playComplete()
    }).not.toThrow()
  })

  it('resumes a suspended context when requested', async () => {
    class SuspendedAudioContext extends FakeAudioContext {
      override state: AudioContextState = 'suspended'
    }

    audioGlobal.AudioContext =
      SuspendedAudioContext as unknown as AudioContextConstructor

    const audio = new AudioSystem()
    await audio.resumeIfNeeded()

    const context = FakeAudioContext.instances[0]
    expect(context).toBeDefined()
    expect(context.resume).toHaveBeenCalledTimes(1)
  })

  it('schedules one-shot oscillator tones for each event call', () => {
    audioGlobal.AudioContext = FakeAudioContext as unknown as AudioContextConstructor

    const audio = new AudioSystem({ masterVolume: 0.2 })
    audio.playJump()
    audio.playOrbJump()
    audio.playJumpPad()
    audio.playDashOrb()
    audio.playGravityFlip()
    audio.playCrash()
    audio.playCheckpoint()
    audio.playSpeedChange(1.4)
    audio.playComplete()

    const context = FakeAudioContext.instances[0]
    expect(context).toBeDefined()
    expect(context.oscillators).toHaveLength(18)
    expect(context.gains).toHaveLength(19)

    for (const oscillator of context.oscillators) {
      expect(oscillator.starts).toHaveLength(1)
      expect(oscillator.stops).toHaveLength(1)
      expect(oscillator.stops[0]).toBeGreaterThan(oscillator.starts[0])
    }
  })

  it('uses rising sweeps for speed-up and falling sweeps for slow-down', () => {
    audioGlobal.AudioContext = FakeAudioContext as unknown as AudioContextConstructor

    const audio = new AudioSystem()
    audio.playSpeedChange(1.5)
    audio.playSpeedChange(0.7)

    const context = FakeAudioContext.instances[0]
    expect(context).toBeDefined()
    expect(context.oscillators).toHaveLength(4)

    const [upA, upB, downA, downB] = context.oscillators
    const [upAStart, upAEnd] = getSweepValues(upA)
    const [upBStart, upBEnd] = getSweepValues(upB)
    const [downAStart, downAEnd] = getSweepValues(downA)
    const [downBStart, downBEnd] = getSweepValues(downB)

    expect(upAEnd).toBeGreaterThan(upAStart)
    expect(upBEnd).toBeGreaterThan(upBStart)
    expect(downAEnd).toBeLessThan(downAStart)
    expect(downBEnd).toBeLessThan(downBStart)
  })
})
