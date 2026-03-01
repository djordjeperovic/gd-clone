import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const FRAME_MS = 1000 / 60

const BUTTON_TO_KEY = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  enter: 'Enter',
  space: 'Space',
  a: 'KeyA',
  b: 'KeyB',
}

const parseArgs = (argv) => {
  const options = {
    url: null,
    iterations: 1,
    pauseMs: 50,
    headless: true,
    screenshotDir: path.join('output', 'e2e-complete'),
    actionsFile: null,
    actionsJson: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--url' && next) {
      options.url = next
      index += 1
      continue
    }

    if (arg === '--iterations' && next) {
      options.iterations = Number.parseInt(next, 10)
      index += 1
      continue
    }

    if (arg === '--pause-ms' && next) {
      options.pauseMs = Number.parseInt(next, 10)
      index += 1
      continue
    }

    if (arg === '--headless' && next) {
      options.headless = next !== '0' && next !== 'false'
      index += 1
      continue
    }

    if (arg === '--screenshot-dir' && next) {
      options.screenshotDir = next
      index += 1
      continue
    }

    if (arg === '--actions-file' && next) {
      options.actionsFile = next
      index += 1
      continue
    }

    if (arg === '--actions-json' && next) {
      options.actionsJson = next
      index += 1
      continue
    }
  }

  if (!options.url) {
    throw new Error('Missing required argument: --url')
  }

  if (!Number.isFinite(options.iterations) || options.iterations <= 0) {
    throw new Error(`Invalid --iterations value: ${String(options.iterations)}`)
  }

  if (!Number.isFinite(options.pauseMs) || options.pauseMs < 0) {
    throw new Error(`Invalid --pause-ms value: ${String(options.pauseMs)}`)
  }

  return options
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getLargestCanvas = async (page) => {
  const handle = await page.evaluateHandle(() => {
    let selected = null
    let selectedArea = 0

    for (const canvas of document.querySelectorAll('canvas')) {
      const width = canvas.width || canvas.clientWidth || 0
      const height = canvas.height || canvas.clientHeight || 0
      const area = width * height
      if (area > selectedArea) {
        selectedArea = area
        selected = canvas
      }
    }

    return selected
  })

  return handle.asElement()
}

const readActions = async (options) => {
  let parsed = null
  if (options.actionsFile) {
    const serialized = await fs.readFile(options.actionsFile, 'utf8')
    parsed = JSON.parse(serialized)
  } else if (options.actionsJson) {
    parsed = JSON.parse(options.actionsJson)
  } else {
    throw new Error('Actions are required. Use --actions-file or --actions-json.')
  }

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && Array.isArray(parsed.steps)) {
    return parsed.steps
  }

  throw new Error('Invalid actions payload: expected an array or an object with steps[].')
}

const advanceOneFrame = async (page) => {
  const advanced = await page.evaluate(async (frameMs) => {
    if (typeof window.advanceTime !== 'function') {
      return false
    }
    await window.advanceTime(frameMs)
    return true
  }, FRAME_MS)

  if (!advanced) {
    throw new Error('window.advanceTime is not available for deterministic stepping.')
  }
}

const runStep = async (page, canvas, step) => {
  const buttons = new Set(Array.isArray(step.buttons) ? step.buttons : [])

  for (const button of buttons) {
    if (button === 'left_mouse_button' || button === 'right_mouse_button') {
      const bbox = canvas ? await canvas.boundingBox() : null
      if (!bbox) {
        continue
      }

      const offsetX = typeof step.mouse_x === 'number' ? step.mouse_x : bbox.width / 2
      const offsetY = typeof step.mouse_y === 'number' ? step.mouse_y : bbox.height / 2
      await page.mouse.move(bbox.x + offsetX, bbox.y + offsetY)
      await page.mouse.down({
        button: button === 'left_mouse_button' ? 'left' : 'right',
      })
      continue
    }

    const key = BUTTON_TO_KEY[button]
    if (key) {
      await page.keyboard.down(key)
    }
  }

  const frames = Number.isFinite(step.frames) ? Math.max(1, Math.floor(step.frames)) : 1
  for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    await advanceOneFrame(page)
  }

  for (const button of buttons) {
    if (button === 'left_mouse_button' || button === 'right_mouse_button') {
      await page.mouse.up({
        button: button === 'left_mouse_button' ? 'left' : 'right',
      })
      continue
    }

    const key = BUTTON_TO_KEY[button]
    if (key) {
      await page.keyboard.up(key)
    }
  }
}

const runScenario = async (page, canvas, steps) => {
  for (const step of steps) {
    await runStep(page, canvas, step)
  }
}

const writeScreenshot = async (page, canvas, targetPath) => {
  if (canvas) {
    try {
      await canvas.screenshot({ path: targetPath, type: 'png' })
      return
    } catch {
      // Fall back to page screenshot below.
    }
  }

  await page.screenshot({ path: targetPath, type: 'png', omitBackground: false })
}

const main = async () => {
  const options = parseArgs(process.argv)
  const steps = await readActions(options)
  await fs.mkdir(options.screenshotDir, { recursive: true })

  const browser = await chromium.launch({
    headless: options.headless,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  })
  const page = await browser.newPage()
  const seenErrors = new Set()
  const pendingErrors = []
  const recordError = (kind, text) => {
    const payload = { type: kind, text }
    const key = JSON.stringify(payload)
    if (seenErrors.has(key)) {
      return
    }
    seenErrors.add(key)
    pendingErrors.push(payload)
  }

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return
    }
    recordError('console.error', message.text())
  })
  page.on('pageerror', (error) => {
    recordError('pageerror', String(error))
  })

  await page.goto(options.url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'))
  })

  let canvas = await getLargestCanvas(page)

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    if (!canvas) {
      canvas = await getLargestCanvas(page)
    }

    await runScenario(page, canvas, steps)
    await wait(options.pauseMs)

    const screenshotPath = path.join(options.screenshotDir, `shot-${iteration}.png`)
    await writeScreenshot(page, canvas, screenshotPath)

    const stateText = await page.evaluate(() => {
      if (typeof window.render_game_to_text === 'function') {
        return window.render_game_to_text()
      }
      return null
    })
    if (stateText) {
      const statePath = path.join(options.screenshotDir, `state-${iteration}.json`)
      await fs.writeFile(statePath, stateText, 'utf8')
    }

    if (pendingErrors.length > 0) {
      const errorsPath = path.join(options.screenshotDir, `errors-${iteration}.json`)
      await fs.writeFile(errorsPath, `${JSON.stringify(pendingErrors, null, 2)}\n`, 'utf8')
      break
    }
  }

  await browser.close()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
