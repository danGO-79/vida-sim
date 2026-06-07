import type { DNA } from '@vida/genetics-engine'
import type { PlantParams, ArchitectureSnapshot } from '@vida/simulation-engine'
import type { EnvironmentState } from '@vida/environment-engine'

export interface HistoryEntry {
  day: number
  text: string
  timestamp: number
}

export interface SaveData {
  version: number
  dna: DNA
  state: PlantParams
  architecture?: ArchitectureSnapshot
  environment: EnvironmentState
  history: HistoryEntry[]
  createdAt: number
  lastSavedAt: number
  totalDaysObserved: number
  personality: string
}
