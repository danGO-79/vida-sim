export type FaunaType = 'bee' | 'butterfly' | 'ladybug' | 'firefly' | 'mosquito' | 'ant' | 'bird'

export interface FaunaEntity {
  id: string
  type: FaunaType
  x: number
  y: number
  z: number
  life: number
  maxLife: number
  orbitPhase?: number
  orbitRadius?: number
  baseY?: number
  wanderAngle?: number
  landed?: boolean
  landTimer?: number
  leafTargetX?: number
  leafTargetY?: number
  groundY?: number
  direction?: number
  groupId?: string
}

export interface EcosystemEvent {
  type: string
  description: string
  day: number
}
