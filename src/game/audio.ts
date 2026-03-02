type AudioContextConstructor = new () => AudioContext

type AudioGlobal = typeof globalThis & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

interface ToneSpec {
  frequency: number
  toFrequency?: number
  durationSeconds: number
  startOffsetSeconds?: number
  attackSeconds?: number
  releaseSeconds?: number
  volume: number
  type: OscillatorType
}

export interface AudioSystemOptions {
  masterVolume?: number
}

const MIN_GAIN = 0.0001
const MIN_FREQUENCY_HZ = 40
const START_TIME_FUDGE_SECONDS = 0.001
const STOP_TAIL_SECONDS = 0.01

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

const getAudioContextConstructor = (): AudioContextConstructor | null => {
  const audioGlobal = globalThis as AudioGlobal
  return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext ?? null
}

export class AudioSystem {
  private readonly context: AudioContext | null
  private readonly masterGain: GainNode | null

  constructor(options: AudioSystemOptions = {}) {
    let context: AudioContext | null = null
    let masterGain: GainNode | null = null
    const AudioContextCtor = getAudioContextConstructor()

    if (AudioContextCtor) {
      try {
        context = new AudioContextCtor()
        masterGain = context.createGain()
        const masterVolume = clamp(options.masterVolume ?? 0.18, 0.01, 1)
        masterGain.gain.setValueAtTime(masterVolume, context.currentTime)
        masterGain.connect(context.destination)
      } catch {
        context = null
        masterGain = null
      }
    }

    this.context = context
    this.masterGain = masterGain
  }

  async resumeIfNeeded(): Promise<void> {
    const context = this.context
    if (!context || context.state === 'running' || context.state === 'closed') {
      return
    }

    try {
      await context.resume()
    } catch {
      // Keep gameplay deterministic by treating resume failure as muted audio.
    }
  }

  dispose(): void {
    const context = this.context
    if (!context || context.state === 'closed') {
      return
    }

    void context.close().catch(() => undefined)
  }

  playJump(): void {
    this.playSequence([
      {
        frequency: 520,
        toFrequency: 790,
        durationSeconds: 0.08,
        volume: 0.13,
        type: 'square',
      },
    ])
  }

  playOrbJump(): void {
    this.playSequence([
      {
        frequency: 600,
        toFrequency: 980,
        durationSeconds: 0.1,
        volume: 0.13,
        type: 'triangle',
      },
      {
        frequency: 860,
        toFrequency: 1320,
        durationSeconds: 0.07,
        startOffsetSeconds: 0.03,
        volume: 0.1,
        type: 'sine',
      },
    ])
  }

  playJumpPad(): void {
    this.playSequence([
      {
        frequency: 500,
        toFrequency: 760,
        durationSeconds: 0.11,
        volume: 0.12,
        type: 'square',
      },
    ])
  }

  playDashOrb(): void {
    this.playSequence([
      {
        frequency: 710,
        toFrequency: 1180,
        durationSeconds: 0.08,
        volume: 0.11,
        type: 'sawtooth',
      },
      {
        frequency: 950,
        toFrequency: 1410,
        durationSeconds: 0.06,
        startOffsetSeconds: 0.04,
        volume: 0.09,
        type: 'triangle',
      },
    ])
  }

  playGravityFlip(): void {
    this.playSequence([
      {
        frequency: 420,
        toFrequency: 240,
        durationSeconds: 0.07,
        volume: 0.08,
        type: 'sine',
      },
      {
        frequency: 240,
        toFrequency: 620,
        durationSeconds: 0.1,
        startOffsetSeconds: 0.05,
        volume: 0.11,
        type: 'triangle',
      },
    ])
  }

  playCrash(): void {
    this.playSequence([
      {
        frequency: 210,
        toFrequency: 70,
        durationSeconds: 0.15,
        attackSeconds: 0.001,
        releaseSeconds: 0.13,
        volume: 0.18,
        type: 'sawtooth',
      },
      {
        frequency: 140,
        toFrequency: 56,
        durationSeconds: 0.16,
        startOffsetSeconds: 0.02,
        attackSeconds: 0.001,
        releaseSeconds: 0.14,
        volume: 0.1,
        type: 'square',
      },
    ])
  }

  playCheckpoint(): void {
    this.playSequence([
      {
        frequency: 660,
        toFrequency: 760,
        durationSeconds: 0.08,
        volume: 0.1,
        type: 'triangle',
      },
      {
        frequency: 880,
        toFrequency: 1080,
        durationSeconds: 0.09,
        startOffsetSeconds: 0.07,
        volume: 0.11,
        type: 'triangle',
      },
    ])
  }

  playCoinCollect(): void {
    this.playSequence([
      {
        frequency: 880,
        toFrequency: 1260,
        durationSeconds: 0.07,
        volume: 0.1,
        type: 'triangle',
      },
    ])
  }

  playSpeedChange(multiplier: number): void {
    const normalizedMultiplier = Number.isFinite(multiplier)
      ? clamp(multiplier, 0.4, 2.5)
      : 1
    const rises = normalizedMultiplier >= 1
    const baseFrequency = 320 + normalizedMultiplier * 150
    const firstEndFrequency = baseFrequency * (rises ? 1.16 : 0.86)
    const secondFrequency = baseFrequency * (rises ? 1.1 : 0.9)
    const secondEndFrequency = secondFrequency * (rises ? 1.12 : 0.84)

    this.playSequence([
      {
        frequency: baseFrequency,
        toFrequency: firstEndFrequency,
        durationSeconds: 0.08,
        volume: 0.11,
        type: 'sine',
      },
      {
        frequency: secondFrequency,
        toFrequency: secondEndFrequency,
        durationSeconds: 0.07,
        startOffsetSeconds: 0.055,
        volume: 0.1,
        type: 'triangle',
      },
    ])
  }

  playComplete(): void {
    this.playSequence([
      {
        frequency: 523.25,
        durationSeconds: 0.1,
        volume: 0.09,
        type: 'triangle',
      },
      {
        frequency: 659.25,
        durationSeconds: 0.1,
        startOffsetSeconds: 0.09,
        volume: 0.09,
        type: 'triangle',
      },
      {
        frequency: 783.99,
        durationSeconds: 0.11,
        startOffsetSeconds: 0.18,
        volume: 0.1,
        type: 'triangle',
      },
      {
        frequency: 1046.5,
        durationSeconds: 0.14,
        startOffsetSeconds: 0.28,
        volume: 0.12,
        type: 'sine',
      },
    ])
  }

  private playSequence(tones: ToneSpec[]): void {
    const context = this.context
    const masterGain = this.masterGain
    if (!context || !masterGain || context.state === 'closed') {
      return
    }

    const baseTime = context.currentTime + START_TIME_FUDGE_SECONDS
    for (const tone of tones) {
      const startTime = baseTime + (tone.startOffsetSeconds ?? 0)
      this.playTone(tone, startTime)
    }
  }

  private playTone(tone: ToneSpec, scheduledStartTime: number): void {
    const context = this.context
    const masterGain = this.masterGain
    if (!context || !masterGain || context.state === 'closed') {
      return
    }

    try {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()

      const durationSeconds = Math.max(0.01, tone.durationSeconds)
      const startTime = Math.max(context.currentTime, scheduledStartTime)
      const endTime = startTime + durationSeconds
      const attackSeconds = clamp(tone.attackSeconds ?? 0.003, 0.001, durationSeconds * 0.5)
      const releaseSeconds = clamp(
        tone.releaseSeconds ?? durationSeconds * 0.75,
        0.004,
        durationSeconds,
      )
      const releaseStartTime = Math.max(startTime + attackSeconds, endTime - releaseSeconds)
      const peakGain = clamp(tone.volume, MIN_GAIN, 1)
      const startFrequency = Math.max(MIN_FREQUENCY_HZ, tone.frequency)

      oscillator.type = tone.type
      oscillator.frequency.setValueAtTime(startFrequency, startTime)
      if (typeof tone.toFrequency === 'number') {
        const endFrequency = Math.max(MIN_FREQUENCY_HZ, tone.toFrequency)
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime)
      }

      envelope.gain.cancelScheduledValues(startTime)
      envelope.gain.setValueAtTime(MIN_GAIN, startTime)
      envelope.gain.linearRampToValueAtTime(peakGain, startTime + attackSeconds)
      envelope.gain.setValueAtTime(peakGain, releaseStartTime)
      envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, endTime)

      oscillator.connect(envelope)
      envelope.connect(masterGain)

      oscillator.start(startTime)
      oscillator.stop(endTime + STOP_TAIL_SECONDS)
      oscillator.onended = () => {
        try {
          oscillator.disconnect()
          envelope.disconnect()
        } catch {
          // Disconnect can throw in some mock/test environments. Ignore safely.
        }
      }
    } catch {
      // Fail silently so unavailable audio does not break gameplay.
    }
  }
}
