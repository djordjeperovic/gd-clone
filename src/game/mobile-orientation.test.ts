import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getViewportSize,
  isLandscapeViewport,
  tryEnterImmersiveLandscape,
} from './mobile-orientation'

const originalInnerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')
const originalInnerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight')
const originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'visualViewport',
)
const originalFullscreenElementDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'fullscreenElement',
)
const originalScreenOrientationDescriptor = Object.getOwnPropertyDescriptor(
  screen,
  'orientation',
)

const restoreDescriptor = <T extends object>(
  target: T,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (!descriptor) {
    Reflect.deleteProperty(target, key)
    return
  }

  Object.defineProperty(target, key, descriptor)
}

const setInnerSize = (width: number, height: number): void => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  })
}

const setVisualViewport = (viewport: VisualViewport | undefined): void => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    writable: true,
    value: viewport,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  restoreDescriptor(window, 'innerWidth', originalInnerWidthDescriptor)
  restoreDescriptor(window, 'innerHeight', originalInnerHeightDescriptor)
  restoreDescriptor(window, 'visualViewport', originalVisualViewportDescriptor)
  restoreDescriptor(document, 'fullscreenElement', originalFullscreenElementDescriptor)
  restoreDescriptor(screen, 'orientation', originalScreenOrientationDescriptor)
})

describe('getViewportSize', () => {
  it('prefers visualViewport dimensions when available', () => {
    setInnerSize(1200, 800)
    setVisualViewport({
      width: 333.4,
      height: 220.6,
    } as VisualViewport)

    expect(getViewportSize()).toEqual({
      width: 333,
      height: 221,
    })
  })

  it('falls back to window inner dimensions when visualViewport is unavailable', () => {
    setInnerSize(901.2, 507.4)
    setVisualViewport(undefined)

    expect(getViewportSize()).toEqual({
      width: 901,
      height: 507,
    })
  })
})

describe('isLandscapeViewport', () => {
  it('returns true when width is greater than or equal to height', () => {
    setVisualViewport({ width: 900, height: 500 } as VisualViewport)
    expect(isLandscapeViewport()).toBe(true)

    setVisualViewport({ width: 640, height: 640 } as VisualViewport)
    expect(isLandscapeViewport()).toBe(true)
  })

  it('returns false when viewport is portrait', () => {
    setVisualViewport({ width: 390, height: 844 } as VisualViewport)
    expect(isLandscapeViewport()).toBe(false)
  })
})

describe('tryEnterImmersiveLandscape', () => {
  it('requests fullscreen and orientation lock when available', async () => {
    const canvas = document.createElement('canvas')
    let fullscreenElement: Element | null = null

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    })

    const requestFullscreen = vi.fn(async () => {
      fullscreenElement = canvas
    })
    Object.defineProperty(canvas, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })

    const lock = vi.fn(async () => undefined)
    Object.defineProperty(screen, 'orientation', {
      configurable: true,
      value: { lock },
    })

    await expect(tryEnterImmersiveLandscape(canvas)).resolves.toBe(true)
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(lock).toHaveBeenCalledWith('landscape')
  })

  it('returns false without throwing when fullscreen and lock reject', async () => {
    const canvas = document.createElement('canvas')

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })

    const requestFullscreen = vi.fn(async () => {
      throw new Error('fullscreen denied')
    })
    Object.defineProperty(canvas, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })

    const lock = vi.fn(async () => {
      throw new Error('lock denied')
    })
    Object.defineProperty(screen, 'orientation', {
      configurable: true,
      value: { lock },
    })

    await expect(tryEnterImmersiveLandscape(canvas)).resolves.toBe(false)
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(lock).toHaveBeenCalledWith('landscape')
  })
})
