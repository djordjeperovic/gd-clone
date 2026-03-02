export type GameMode =
  | 'menu'
  | 'running'
  | 'practice'
  | 'paused'
  | 'dead'
  | 'complete'

export type RunMode = 'running' | 'practice'

export type LevelObjectType =
  | 'ground'
  | 'spike'
  | 'jumpOrb'
  | 'gravityPortal'
  | 'jumpPad'
  | 'dashOrb'
  | 'coin'
export type TriggerType = 'checkpoint' | 'speed'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface LevelObject extends Rect {
  id: string
  type: LevelObjectType
}

export interface LevelTrigger extends Rect {
  id: string
  type: TriggerType
  speedMultiplier?: number
}

export interface LevelData {
  length: number
  objects: LevelObject[]
  triggers: LevelTrigger[]
}

export type LevelId = 'classic' | 'floating'

export interface LevelDefinition {
  id: LevelId
  name: string
  data: LevelData
}

export interface PlayerState {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  grounded: boolean
}

export interface PracticeCheckpoint {
  x: number
  y: number
  speedMultiplier: number
  gravityDirection: 1 | -1
}

export type ParticleKind = 'trail' | 'dust' | 'spark' | 'shard'
export type ParticleShape = 'square' | 'circle'

export interface ParticleState {
  kind: ParticleKind
  shape: ParticleShape
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  lifetime: number
  opacity: number
  color: string
  rotation: number
  spin: number
  drag: number
  gravityScale: number
}

export interface ParticleSystemState {
  items: ParticleState[]
  trailTimer: number
  rngState: number
}

export interface GameState {
  mode: GameMode
  currentRunMode: RunMode
  attempt: number
  runElapsedSeconds: number
  completedRunSeconds: number | null
  bestCompletionSeconds: number | null
  bestCrashCount: number | null
  bestCoinCount: number | null
  crashCount: number
  coinCount: number
  totalCoins: number
  player: PlayerState
  cameraX: number
  progressPercent: number
  speedMultiplier: number
  gravityDirection: 1 | -1
  deathTimer: number
  practiceCheckpoint: PracticeCheckpoint | null
  activatedCheckpointTriggers: Set<string>
  activatedSpeedTriggers: Set<string>
  activatedInteractives: Set<string>
  particles: ParticleSystemState
}

export interface InputSnapshot {
  jumpPressed: boolean
  restartPressed: boolean
  togglePracticePressed: boolean
  pausePressed: boolean
  fullscreenPressed: boolean
}

declare global {
  interface Window {
    render_game_to_text: () => string
    advanceTime: (ms: number) => void
  }
}

export {}
