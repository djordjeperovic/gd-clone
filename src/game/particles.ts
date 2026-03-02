import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './constants'
import type {
  LevelObject,
  ParticleState,
  ParticleSystemState,
  PlayerState,
} from './types'

const DEFAULT_PARTICLE_SEED = 0x5f3759df
const MAX_PARTICLES = 220
const TRAIL_INTERVAL_SECONDS = 0.045
const PARTICLE_GRAVITY = 1100

const TRAIL_COLOR = '#8fd4ff'
const DUST_COLOR = '#d5ebff'
const PAD_DUST_COLOR = '#ffe3c2'
const JUMP_ORB_SPARK_COLOR = '#ffe881'
const DASH_ORB_SPARK_COLOR = '#8cebff'
const SHARD_COLORS = ['#e7f0ff', '#66c8ff', '#1b3c66', '#9ad7ff'] as const

type OrbSparkKind = 'jump' | 'dash'
export type JumpDustSource = 'jump' | 'pad' | 'landing'

const nextRandom = (system: ParticleSystemState): number => {
  system.rngState = (system.rngState * 1664525 + 1013904223) >>> 0
  return system.rngState / 0x1_0000_0000
}

const randomRange = (
  system: ParticleSystemState,
  min: number,
  max: number,
): number => {
  return min + (max - min) * nextRandom(system)
}

const pickColor = (
  system: ParticleSystemState,
  palette: readonly string[],
): string => {
  const index = Math.floor(nextRandom(system) * palette.length)
  return palette[Math.min(index, palette.length - 1)]
}

const pushParticle = (
  system: ParticleSystemState,
  particle: ParticleState,
): void => {
  if (system.items.length >= MAX_PARTICLES) {
    const overflow = system.items.length - MAX_PARTICLES + 1
    system.items.splice(0, overflow)
  }
  system.items.push(particle)
}

export const createParticleSystem = (
  seed = DEFAULT_PARTICLE_SEED,
): ParticleSystemState => ({
  items: [],
  trailTimer: 0,
  rngState: seed >>> 0,
})

export const resetParticleSystem = (
  system: ParticleSystemState,
  seed = DEFAULT_PARTICLE_SEED,
): void => {
  system.items.length = 0
  system.trailTimer = 0
  system.rngState = seed >>> 0
}

const emitTrailParticle = (
  system: ParticleSystemState,
  player: PlayerState,
): void => {
  const offset = player.size * 0.38
  const centerX = player.x + player.size / 2 - Math.cos(player.rotation) * offset
  const centerY = player.y + player.size / 2 - Math.sin(player.rotation) * offset

  pushParticle(system, {
    kind: 'trail',
    shape: 'square',
    x: centerX + randomRange(system, -2, 2),
    y: centerY + randomRange(system, -2, 2),
    vx: -player.vx * 0.16 + randomRange(system, -25, 25),
    vy: player.vy * 0.08 + randomRange(system, -20, 20),
    size: randomRange(system, 4, 7),
    age: 0,
    lifetime: randomRange(system, 0.16, 0.3),
    opacity: 0.7,
    color: TRAIL_COLOR,
    rotation: randomRange(system, -0.4, 0.4),
    spin: randomRange(system, -4, 4),
    drag: 3.8,
    gravityScale: 0.15,
  })
}

export const tickTrailEmitter = (
  system: ParticleSystemState,
  dt: number,
  player: PlayerState,
): void => {
  if (Math.abs(player.vx) < 1) {
    return
  }

  system.trailTimer += dt
  while (system.trailTimer >= TRAIL_INTERVAL_SECONDS) {
    system.trailTimer -= TRAIL_INTERVAL_SECONDS
    emitTrailParticle(system, player)
  }
}

export const emitJumpDust = (
  system: ParticleSystemState,
  player: PlayerState,
  gravityDirection: 1 | -1,
  source: JumpDustSource,
): void => {
  const centerX = player.x + player.size / 2
  const contactY = gravityDirection === 1 ? player.y + player.size - 1 : player.y + 1
  const count = source === 'pad' ? 12 : source === 'landing' ? 8 : 10
  const speedMin = source === 'landing' ? 70 : source === 'pad' ? 100 : 90
  const speedMax = source === 'landing' ? 210 : source === 'pad' ? 260 : 220
  const opacity = source === 'landing' ? 0.52 : 0.65
  const color = source === 'pad' ? PAD_DUST_COLOR : DUST_COLOR

  for (let index = 0; index < count; index += 1) {
    pushParticle(system, {
      kind: 'dust',
      shape: 'circle',
      x: centerX + randomRange(system, -player.size * 0.46, player.size * 0.46),
      y: contactY + randomRange(system, -2, 2),
      vx: randomRange(system, -180, 180),
      vy: gravityDirection * randomRange(system, speedMin, speedMax),
      size: randomRange(system, 2.5, source === 'pad' ? 6.4 : 5.7),
      age: 0,
      lifetime: randomRange(system, 0.2, 0.42),
      opacity,
      color,
      rotation: 0,
      spin: 0,
      drag: 2.4,
      gravityScale: 0.95,
    })
  }
}

const resolveOrbSparkKind = (orb: LevelObject): OrbSparkKind => {
  return orb.type === 'dashOrb' ? 'dash' : 'jump'
}

export const emitOrbSparks = (
  system: ParticleSystemState,
  orb: LevelObject,
): void => {
  const kind = resolveOrbSparkKind(orb)
  const centerX = orb.x + orb.width / 2
  const centerY = orb.y + orb.height / 2
  const count = kind === 'dash' ? 16 : 12
  const color = kind === 'dash' ? DASH_ORB_SPARK_COLOR : JUMP_ORB_SPARK_COLOR
  const speedMax = kind === 'dash' ? 320 : 280

  for (let index = 0; index < count; index += 1) {
    const angle = randomRange(system, 0, Math.PI * 2)
    const speed = randomRange(system, 110, speedMax)
    pushParticle(system, {
      kind: 'spark',
      shape: nextRandom(system) > 0.3 ? 'square' : 'circle',
      x: centerX + Math.cos(angle) * randomRange(system, 0, 4),
      y: centerY + Math.sin(angle) * randomRange(system, 0, 4),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: randomRange(system, 2, 4.8),
      age: 0,
      lifetime: randomRange(system, 0.2, 0.38),
      opacity: 0.84,
      color,
      rotation: randomRange(system, -0.7, 0.7),
      spin: randomRange(system, -10, 10),
      drag: 1.8,
      gravityScale: 0.25,
    })
  }
}

export const emitCrashShatter = (
  system: ParticleSystemState,
  player: PlayerState,
): void => {
  const centerX = player.x + player.size / 2
  const centerY = player.y + player.size / 2

  for (let index = 0; index < 30; index += 1) {
    const angle = randomRange(system, 0, Math.PI * 2)
    const speed = randomRange(system, 150, 430)
    pushParticle(system, {
      kind: 'shard',
      shape: 'square',
      x: centerX + randomRange(system, -3, 3),
      y: centerY + randomRange(system, -3, 3),
      vx: Math.cos(angle) * speed + randomRange(system, -40, 40),
      vy: Math.sin(angle) * speed + randomRange(system, -40, 40),
      size: randomRange(system, 3.2, 8.2),
      age: 0,
      lifetime: randomRange(system, 0.28, 0.56),
      opacity: 0.95,
      color: pickColor(system, SHARD_COLORS),
      rotation: randomRange(system, -0.7, 0.7),
      spin: randomRange(system, -14, 14),
      drag: 1.1,
      gravityScale: 0.58,
    })
  }
}

export const updateParticles = (
  system: ParticleSystemState,
  dt: number,
  gravityDirection: 1 | -1,
  cameraX: number,
): void => {
  const visibleLeft = cameraX - 220
  const visibleRight = cameraX + INTERNAL_WIDTH + 220
  let writeIndex = 0

  for (let index = 0; index < system.items.length; index += 1) {
    const particle = system.items[index]
    particle.age += dt
    if (particle.age >= particle.lifetime) {
      continue
    }

    const dragFactor = Math.max(0, 1 - particle.drag * dt)
    particle.vx *= dragFactor
    particle.vy *= dragFactor
    particle.vy += PARTICLE_GRAVITY * particle.gravityScale * dt * gravityDirection
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.rotation += particle.spin * dt

    const offscreen =
      particle.x < visibleLeft ||
      particle.x > visibleRight ||
      particle.y < -240 ||
      particle.y > INTERNAL_HEIGHT + 240
    if (offscreen) {
      continue
    }

    system.items[writeIndex] = particle
    writeIndex += 1
  }

  system.items.length = writeIndex
}
