import type { LevelObject, LevelTrigger, PlayerState, Rect } from './types'

export const intersects = (a: Rect, b: Rect): boolean => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export const getPlayerRect = (player: PlayerState): Rect => ({
  x: player.x,
  y: player.y,
  width: player.size,
  height: player.size,
})

const inflateRect = (rect: Rect, amount: number): Rect => ({
  x: rect.x - amount,
  y: rect.y - amount,
  width: rect.width + amount * 2,
  height: rect.height + amount * 2,
})

export const resolveGroundCollision = (
  player: PlayerState,
  solids: readonly LevelObject[],
  previousY: number,
): boolean => {
  const playerRect = getPlayerRect(player)
  const previousTop = previousY
  const previousBottom = previousY + player.size
  const currentTop = player.y
  const currentBottom = player.y + player.size

  let landingTop = Number.POSITIVE_INFINITY
  let ceilingBottom = Number.NEGATIVE_INFINITY

  for (const solid of solids) {
    const overlapsX =
      playerRect.x < solid.x + solid.width &&
      playerRect.x + playerRect.width > solid.x
    if (!overlapsX) {
      continue
    }

    const top = solid.y
    const bottom = solid.y + solid.height

    if (previousBottom <= top && currentBottom >= top && top < landingTop) {
      landingTop = top
    }

    if (previousTop >= bottom && currentTop <= bottom && bottom > ceilingBottom) {
      ceilingBottom = bottom
    }
  }

  if (landingTop !== Number.POSITIVE_INFINITY) {
    player.y = landingTop - player.size
    player.vy = 0
    return true
  }

  if (ceilingBottom !== Number.NEGATIVE_INFINITY) {
    player.y = ceilingBottom
    if (player.vy < 0) {
      player.vy = 0
    }
  }

  return false
}

export const hasSpikeCollision = (
  player: PlayerState,
  spikes: readonly LevelObject[],
): boolean => {
  const playerRect = getPlayerRect(player)
  return spikes.some((spike) => intersects(playerRect, spike))
}

export const findActivatableOrb = (
  player: PlayerState,
  orbs: readonly LevelObject[],
): LevelObject | null => {
  const probeRect = inflateRect(getPlayerRect(player), 8)
  for (const orb of orbs) {
    if (intersects(probeRect, orb)) {
      return orb
    }
  }
  return null
}

export const getOverlappingTriggers = (
  player: PlayerState,
  triggers: readonly LevelTrigger[],
): LevelTrigger[] => {
  const playerRect = getPlayerRect(player)
  return triggers.filter((trigger) => intersects(playerRect, trigger))
}

export const getGroundTopAtX = (
  x: number,
  solids: readonly LevelObject[],
  fallbackTop: number,
): number => {
  let top = Number.POSITIVE_INFINITY
  for (const solid of solids) {
    if (x >= solid.x && x <= solid.x + solid.width && solid.y < top) {
      top = solid.y
    }
  }

  return top === Number.POSITIVE_INFINITY ? fallbackTop : top
}

export const isVisibleInCamera = (
  x: number,
  width: number,
  cameraX: number,
  viewportWidth: number,
): boolean => {
  return x + width >= cameraX && x <= cameraX + viewportWidth
}
