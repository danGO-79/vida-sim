import { generateDNA, classifyPersonality } from './DNA'
import type { DNA, PlantPersonality } from './DNA'

export class GeneticsEngine {
  private _dna: DNA
  readonly personality: PlantPersonality
  readonly createdAt: number

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.createdAt = seed
    } else {
      this.createdAt = Date.now()
      seed = this.createdAt
    }
    this._dna = generateDNA(seed)
    this.personality = classifyPersonality(this._dna)
  }

  get dna(): DNA {
    return { ...this._dna }
  }

  get seed(): number {
    return this.createdAt
  }

  generateNewSeed(): number {
    return Date.now() + Math.floor(Math.random() * 1000000)
  }

  regenerate(seed: number): void {
    this._dna = generateDNA(seed)
    Object.assign(this, { personality: classifyPersonality(this._dna) })
  }
}
