export const STAT_FLOOR = 4

export function drainStat(current: number, amount: number): number {
  if (current <= STAT_FLOOR) return current
  return Math.max(STAT_FLOOR, current - amount)
}

export interface PlantParams {
  age: number
  health: number
  vitality: number
  energy: number
  hydration: number
  nutrients: number
  stress: number
  flowers: number
  fruits: number
}

export class PlantState {
  age = 0
  health = 100
  vitality = 50
  energy = 30
  hydration = 80
  nutrients = 70
  stress = 0
  flowers = 0
  fruits = 0
  isLatent = false

  snapshot(): PlantParams {
    return {
      age: this.age,
      health: this.health,
      vitality: this.vitality,
      energy: this.energy,
      hydration: this.hydration,
      nutrients: this.nutrients,
      stress: this.stress,
      flowers: this.flowers,
      fruits: this.fruits
    }
  }

  clamp(): void {
    this.health = Math.max(STAT_FLOOR, Math.min(100, this.health))
    this.vitality = Math.max(STAT_FLOOR, Math.min(100, this.vitality))
    this.energy = Math.max(STAT_FLOOR, Math.min(100, this.energy))
    this.hydration = Math.max(STAT_FLOOR, Math.min(100, this.hydration))
    this.nutrients = Math.max(STAT_FLOOR, Math.min(100, this.nutrients))
    this.stress = Math.max(0, Math.min(100, this.stress))
    this.flowers = Math.max(0, Math.round(this.flowers))
    this.fruits = Math.max(0, Math.round(this.fruits))
  }
}
