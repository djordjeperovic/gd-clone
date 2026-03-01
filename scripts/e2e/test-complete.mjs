import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ensureActionsFile } from './generate-complete-actions.mjs'

const HOST = '127.0.0.1'
const PORT = 4173
const SERVER_ORIGIN = `http://${HOST}:${PORT}`
const HARNESS_URL = `${SERVER_ORIGIN}/scripts/e2e/harness.html`
const REPO_PLAYWRIGHT_CLIENT = 'scripts/e2e/playwright-actions-client.mjs'
const OPTIONAL_SKILL_PLAYWRIGHT_CLIENT =
  'C:/Users/djord/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const actionsPath = path.join(here, 'complete-actions.json')
const outputDir = path.join(repoRoot, 'output', 'e2e-complete')

const runCommand = (command, args, options = {}) => {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForServer = async (serverProcess, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error('Vite dev server exited before becoming ready.')
    }

    try {
      const response = await fetch(SERVER_ORIGIN)
      if (response.ok) {
        return
      }
    } catch {
      // Retry until timeout.
    }

    await wait(250)
  }

  throw new Error(`Timed out waiting for dev server at ${SERVER_ORIGIN}.`)
}

const stopServer = async (serverProcess) => {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return
  }

  const exited = new Promise((resolve) => {
    serverProcess.once('close', () => resolve())
  })

  serverProcess.kill('SIGTERM')
  await Promise.race([exited, wait(3_000)])

  if (serverProcess.exitCode === null) {
    serverProcess.kill('SIGKILL')
    await exited
  }
}

const startServer = async () => {
  const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  const serverProcess = spawn(process.execPath, [
    viteBin,
    '--host',
    HOST,
    '--port',
    String(PORT),
    '--strictPort',
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[vite] ${chunk.toString()}`)
  })
  serverProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[vite] ${chunk.toString()}`)
  })

  await waitForServer(serverProcess)
  return serverProcess
}

const resolveStateFile = async () => {
  const entries = await fs.readdir(outputDir)
  const stateFiles = entries
    .filter((entry) => /^state-\d+\.json$/u.test(entry))
    .sort((a, b) => {
      const an = Number(a.match(/\d+/u)?.[0] ?? '-1')
      const bn = Number(b.match(/\d+/u)?.[0] ?? '-1')
      return an - bn
    })

  if (stateFiles.length === 0) {
    throw new Error(`No state-*.json files found in ${outputDir}.`)
  }

  return path.join(outputDir, stateFiles[stateFiles.length - 1])
}

const assertCompletionState = (state) => {
  const errors = []

  if (state.mode !== 'complete') {
    errors.push(`Expected mode "complete", received "${state.mode}".`)
  }

  if (
    typeof state.completedRunSeconds !== 'number' ||
    !Number.isFinite(state.completedRunSeconds)
  ) {
    errors.push(
      `Expected completedRunSeconds to be a non-null number, received ${String(
        state.completedRunSeconds,
      )}.`,
    )
  }

  if (
    typeof state.bestCompletionSeconds !== 'number' ||
    !Number.isFinite(state.bestCompletionSeconds)
  ) {
    errors.push(
      `Expected bestCompletionSeconds to be a non-null number, received ${String(
        state.bestCompletionSeconds,
      )}.`,
    )
  }

  if (typeof state.crashCount !== 'number' || Number.isNaN(state.crashCount)) {
    errors.push(`Expected crashCount to be a number, received ${String(state.crashCount)}.`)
  }

  if (errors.length > 0) {
    throw new Error(`Completion assertions failed:\n- ${errors.join('\n- ')}`)
  }
}

const runPlaywrightClient = async () => {
  const clientArgs = [
    '--url',
    HARNESS_URL,
    '--actions-file',
    actionsPath,
    '--iterations',
    '1',
    '--pause-ms',
    '50',
    '--screenshot-dir',
    outputDir,
  ]
  const requestedClient = process.env.GDCLONE_E2E_CLIENT?.trim()
  const repoClient = path.join(repoRoot, REPO_PLAYWRIGHT_CLIENT)
  const candidates = [
    requestedClient
      ? path.isAbsolute(requestedClient)
        ? requestedClient
        : path.resolve(repoRoot, requestedClient)
      : null,
    repoClient,
    (await fileExists(OPTIONAL_SKILL_PLAYWRIGHT_CLIENT))
      ? OPTIONAL_SKILL_PLAYWRIGHT_CLIENT
      : null,
  ]
  const attemptedClients = []
  const seenClients = new Set()

  for (const candidate of candidates) {
    if (!candidate || seenClients.has(candidate)) {
      continue
    }
    seenClients.add(candidate)

    if (!(await fileExists(candidate))) {
      attemptedClients.push(`- ${candidate} (missing)`)
      continue
    }

    const result = await runCommand(process.execPath, [candidate, ...clientArgs])
    if (result.stdout.trim()) {
      process.stdout.write(result.stdout)
    }
    if (result.stderr.trim()) {
      process.stderr.write(result.stderr)
    }

    if (result.code === 0) {
      return
    }

    attemptedClients.push(`- ${candidate} (exit code ${result.code})`)
  }

  if (attemptedClients.length === 0) {
    throw new Error('No Playwright client candidates were available to run.')
  }

  throw new Error(
    ['Playwright client failed for all candidates.', 'Tried:', ...attemptedClients].join(
      '\n',
    ),
  )
}

const main = async () => {
  await ensureActionsFile(actionsPath)
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })

  let serverProcess = null
  try {
    serverProcess = await startServer()
    await runPlaywrightClient()
  } finally {
    await stopServer(serverProcess)
  }

  const statePath = await resolveStateFile()
  const stateJson = await fs.readFile(statePath, 'utf8')
  const state = JSON.parse(stateJson)
  assertCompletionState(state)

  process.stdout.write(
    [
      '',
      'Completion assertions passed:',
      `- mode: ${state.mode}`,
      `- completedRunSeconds: ${state.completedRunSeconds}`,
      `- bestCompletionSeconds: ${state.bestCompletionSeconds}`,
      `- crashCount: ${state.crashCount}`,
      `- state file: ${path.relative(repoRoot, statePath)}`,
      '',
    ].join('\n'),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
