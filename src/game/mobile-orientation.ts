export interface ViewportSize {
  width: number
  height: number
}

const MIN_VIEWPORT_EDGE = 1

const sanitizeViewportEdge = (value: number): number => {
  if (!Number.isFinite(value)) {
    return MIN_VIEWPORT_EDGE
  }

  return Math.max(MIN_VIEWPORT_EDGE, Math.round(value))
}

export const getViewportSize = (): ViewportSize => {
  const visualViewport = window.visualViewport
  if (visualViewport) {
    return {
      width: sanitizeViewportEdge(visualViewport.width),
      height: sanitizeViewportEdge(visualViewport.height),
    }
  }

  return {
    width: sanitizeViewportEdge(window.innerWidth),
    height: sanitizeViewportEdge(window.innerHeight),
  }
}

export const isLandscapeViewport = (): boolean => {
  const viewport = getViewportSize()
  return viewport.width >= viewport.height
}

type OrientationLockValue =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary'

interface ScreenOrientationWithLock {
  lock?: (orientation: OrientationLockValue) => Promise<void>
}

export const tryEnterImmersiveLandscape = async (
  canvas: HTMLCanvasElement,
): Promise<boolean> => {
  let enteredFullscreen = false

  if (!document.fullscreenElement && typeof canvas.requestFullscreen === 'function') {
    try {
      await canvas.requestFullscreen()
      enteredFullscreen = true
    } catch {
      // Best effort: continue and try orientation lock if available.
    }
  } else if (document.fullscreenElement === canvas) {
    enteredFullscreen = true
  }

  const orientation = (
    screen as Screen & { orientation?: ScreenOrientationWithLock }
  ).orientation
  if (orientation && typeof orientation.lock === 'function') {
    try {
      await orientation.lock('landscape')
      return true
    } catch {
      // Best effort: swallow unsupported and rejected locks.
    }
  }

  return enteredFullscreen
}
