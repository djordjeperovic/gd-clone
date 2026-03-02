import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const JUMP_FRAMES = [
  87, 139, 185, 243, 299, 354, 393, 451, 496, 546, 585, 624, 663, 702, 742,
  781, 820, 956, 1000, 1044, 1088, 1132, 1176, 1220, 1260, 1301, 1342, 1383,
  1422, 1461, 1500,
]

const FINAL_SETTLE_FRAMES = 360

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const defaultOutputPath = path.join(here, 'complete-actions.json')

const buildSteps = () => {
  const steps = [{ buttons: ['space'], frames: 1 }]
  let cursor = 0

  for (const jumpFrame of JUMP_FRAMES) {
    const waitFrames = jumpFrame - cursor
    if (waitFrames > 0) {
      steps.push({ buttons: [], frames: waitFrames })
    }
    steps.push({ buttons: ['space'], frames: 1 })
    cursor = jumpFrame + 1
  }

  steps.push({ buttons: [], frames: FINAL_SETTLE_FRAMES })
  return steps
}

export const buildActionsPayload = () => ({
  metadata: {
    generatedBy: 'scripts/e2e/generate-complete-actions.mjs',
    description:
      'Deterministic completion trajectory across classic then floating levels for scripts/e2e/harness.html.',
    levelFlow: ['classic', 'floating'],
    jumpFrames: JUMP_FRAMES,
  },
  steps: buildSteps(),
})

export const ensureActionsFile = async (outputPath = defaultOutputPath) => {
  const payload = buildActionsPayload()
  const serialized = `${JSON.stringify(payload, null, 2)}\n`

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  let existing = null
  try {
    existing = await fs.readFile(outputPath, 'utf8')
  } catch {
    existing = null
  }

  if (existing !== serialized) {
    await fs.writeFile(outputPath, serialized, 'utf8')
  }

  return outputPath
}

const runAsScript = async () => {
  const targetArg = process.argv[2]
  const targetPath = targetArg
    ? path.resolve(repoRoot, targetArg)
    : defaultOutputPath
  const outputPath = await ensureActionsFile(targetPath)
  process.stdout.write(`${outputPath}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAsScript().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
