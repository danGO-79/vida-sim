import type { DNA } from '@vida/genetics-engine'
import type { EnvironmentState } from '@vida/environment-engine'
import { PlantState, STAT_FLOOR, drainStat } from './PlantState'
import type { PlantParams } from './PlantState'
import { PlantArchitecture } from './PlantArchitecture'
import type { ArchitectureSnapshot } from './PlantArchitecture'

export interface SimulationConfig {
  timeScale: number
  tickInterval: number
}

export type SimulationCallback = (state: PlantParams, days: number, environment: EnvironmentState) => void

const REAL_MS_PER_DAY = 86400_000
const DEFAULT_TIME_SCALE = 7

export class SimulationEngine {
  private _state: PlantState
  private _architecture: PlantArchitecture
  private _simulatedDays: number
  private _running = false
  private _lastTick = 0
  private _rafId: number | null = null
  private _callbacks: SimulationCallback[] = []
  private _config: SimulationConfig
  private _dna: DNA
  private _environment: EnvironmentState
  private _antCount = 0

  constructor(dna: DNA, environment: EnvironmentState, config?: Partial<SimulationConfig>) {
    this._state = new PlantState()
    this._architecture = new PlantArchitecture(dna)
    this._simulatedDays = 0
    this._dna = dna
    this._environment = environment
    this._config = {
      timeScale: DEFAULT_TIME_SCALE,
      tickInterval: 100,
      ...config
    }
  }

  get state(): PlantState {
    return this._state
  }

  get architecture(): PlantArchitecture {
    return this._architecture
  }

  get simulatedDays(): number {
    return this._simulatedDays
  }

  onTick(cb: SimulationCallback): void {
    this._callbacks.push(cb)
  }

  start(): void {
    if (this._running) return
    this._running = true
    this._lastTick = performance.now()
    this._tick(this._lastTick)
  }

  stop(): void {
    this._running = false
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  reset(dna: DNA, environment: EnvironmentState): void {
    this.stop()
    this._state = new PlantState()
    this._architecture = new PlantArchitecture(dna)
    this._simulatedDays = 0
    this._dna = dna
    this._environment = environment
  }

  restore(state: PlantParams, simulatedDays: number): void {
    Object.assign(this._state, state)
    this._simulatedDays = simulatedDays
    this._state.clamp()
  }

  restoreArchitecture(data: ArchitectureSnapshot): void {
    this._architecture = PlantArchitecture.fromSnapshot(data, this._dna)
  }

  setEnvironment(env: EnvironmentState): void {
    this._environment = env
  }

  setAntCount(count: number): void {
    this._antCount = Math.max(0, count)
  }

  update(realDeltaMs: number): void {
    const dayDelta = (realDeltaMs / REAL_MS_PER_DAY) * this._config.timeScale
    this._simulatedDays += dayDelta
    this._advance(dayDelta)
  }

  private _tick = (now: number): void => {
    if (!this._running) return

    const realDelta = now - this._lastTick
    this._lastTick = now

    if (realDelta > 0) {
      this.update(realDelta)
    }

    this._rafId = requestAnimationFrame(this._tick)
  }

  private _advance(dayDelta: number): void {
    const s = this._state
    const env = this._environment
    const dna = this._dna
    const arch = this._architecture

    s.age += dayDelta

    const sunlight = env.sunlight / 100
    const temperature = env.temperature
    const humidity = env.humidity / 100
    const wind = env.wind / 100
    const season = env.season

    const isDay = sunlight > 0.05
    const isWarm = temperature > 10
    const isHot = temperature > 35
    const isCold = temperature < 5
    const isDry = humidity < 0.2
    const isWet = humidity > 0.8

    const seasonGrowthMod: Record<string, number> = {
      spring: 1.4,
      summer: 0.7,
      autumn: 0.9,
      winter: 0.4
    }
    const growthMod = seasonGrowthMod[season] ?? 1.0

    const waterEfficiency = dna.waterEfficiency
    const diseaseResistance = dna.diseaseResistance
    const growthRate = dna.growthRate

    const isRaining = env.rain >= 5
    const rainFactor = isRaining
      ? 1.1 + (env.rain / 100) * 1.4
      : 0.4 + (env.rain / 100) * 0.45
    const humidityFactor = 0.4 + humidity * 0.6
    const isAutumn = season === 'autumn'
    const isWinter = season === 'winter'
    const isDormantSeason = isAutumn || isWinter

    const nutrientSeasonMod =
      season === 'spring' ? 1.4 :
      isAutumn ? 1.35 :
      isWinter ? 0.9 : 0.9
    const nutrientTempMod = isDormantSeason
      ? Math.max(0.55, Math.min(1, 1 - Math.abs(temperature - 12) / 40))
      : Math.max(0.3, Math.min(1, 1 - Math.abs(temperature - 20) / 35))
    const rainNutrientBonus = isRaining ? 0.35 + (env.rain / 100) * 0.65 : 0
    const seasonalRainBonus = isDormantSeason && isRaining
      ? 0.2 + (env.rain / 100) * 0.4
      : 0
    const nutrientUptakeRate = (0.45 + waterEfficiency * 0.5)
      * rainFactor * humidityFactor * nutrientSeasonMod * nutrientTempMod
      + rainNutrientBonus + seasonalRainBonus
    const canAbsorbNutrients =
      s.hydration > 10 || (isRaining && s.hydration >= STAT_FLOOR) || s.hydration >= STAT_FLOOR

    const leafCount = arch.getTotalLeaves()
    const totalNodes = arch.getTotalNodes()
    const hasFoliage = leafCount > 0

    const energyFactor = s.energy / 100
    const nutrientFactor = s.nutrients / 100

    if (s.health < 15 && s.hydration < 10 && s.nutrients < 10) {
      s.isLatent = true
    }

    if (s.isLatent) {
      s.hydration += 2 * dayDelta * (0.5 + humidity)
      s.nutrients += (2.2 + env.rain / 35) * dayDelta * humidityFactor
      s.vitality = Math.min(5, s.vitality + 0.5 * dayDelta)
      s.stress = Math.max(0, s.stress - 1 * dayDelta)
      s.energy = drainStat(s.energy, 0.5 * dayDelta)

      if (s.hydration > 5 || s.nutrients > 5) {
        s.isLatent = false
        s.vitality = Math.max(10, s.vitality)
      } else {
        this._state.clamp()
        return
      }
    }

    // Compute sun angle (0=left, PI/2=noon, PI=right)
    const dayStart = season === 'summer' ? 5 : season === 'winter' ? 7 : 6
    const dayEnd = season === 'summer' ? 21 : season === 'winter' ? 17 : 20
    const sunProgress = (env.hour - dayStart) / (dayEnd - dayStart)
    const sunAngle = Math.PI * Math.max(0, Math.min(1, sunProgress))

    // Architecture-based growth
    arch.updateSeasonalFoliage(season, dayDelta)
    const deadLeafCount = arch.getDeadLeafCount()
    if (s.vitality > 10 && !s.isLatent) {
      arch.grow(
        dayDelta,
        energyFactor,
        nutrientFactor,
        sunlight,
        growthMod,
        growthRate,
        dna.apicalDominance,
        sunAngle,
        season
      )
    }

    // Photosynthesis (uses actual leaves from architecture)
    if (hasFoliage && isDay && isWarm && s.vitality >= STAT_FLOOR && !s.isLatent) {
      const photosynthesisBase = sunlight * (1 + 0.3 * leafCount / 10)
      const efficiencyMod = Math.min(1, s.health / 100)
      const rate = s.vitality > 10 ? 15 : 4
      const energyGain = photosynthesisBase * rate * dayDelta * efficiencyMod
      s.energy = Math.min(100, s.energy + energyGain)
    }

    if (canAbsorbNutrients) {
      const waterAbsorbed = (0.5 + waterEfficiency * 1.5) * dayDelta * humidity
      s.hydration = Math.min(100, s.hydration + waterAbsorbed)

      const nutrientAbsorbed = nutrientUptakeRate * dayDelta
      s.nutrients = Math.min(100, s.nutrients + nutrientAbsorbed)
    }

    if (this._antCount > 0 && !s.isLatent) {
      const antNutrientBonus = this._antCount * 0.35 * dayDelta
      s.nutrients = Math.min(100, s.nutrients + antNutrientBonus)
    }

    if (isDormantSeason && s.hydration >= STAT_FLOOR && !s.isLatent) {
      const rootUptake = isAutumn ? 0.35 : 0.25
      s.nutrients = Math.min(100, s.nutrients + rootUptake * dayDelta)
    }

    if (isAutumn && !s.isLatent) {
      const mulchBonus = (leafCount * 0.04 + deadLeafCount * 0.1) * dayDelta
      s.nutrients = Math.min(100, s.nutrients + mulchBonus)
    }

    // Maintenance cost (based on total nodes)
    if (s.vitality > 10) {
      const maintenance = 1 * dayDelta * (1 + 0.1 * leafCount + 0.05 * totalNodes)
      s.energy = drainStat(s.energy, maintenance)
      let nutrientMaintenanceFactor = isRaining ? 0.06 : 0.14
      if (isDormantSeason) nutrientMaintenanceFactor *= 0.5
      s.nutrients = drainStat(s.nutrients, maintenance * nutrientMaintenanceFactor)
    }

    const transpiration = (1.5 - waterEfficiency) * dayDelta * (isHot ? 3 : 1) * (1 + wind)
    s.hydration = drainStat(s.hydration, transpiration)

    if (isHot) {
      s.hydration = drainStat(s.hydration, 2 * dayDelta * (1 + wind))
    }
    if (isCold) {
      const coldDrain = s.vitality < 35 ? 2 : 5
      s.vitality = drainStat(s.vitality, coldDrain * dayDelta)
    }
    if (isDry) {
      s.hydration = drainStat(s.hydration, 1.5 * dayDelta)
    }

    const idealTemp = 20
    const tempStress = Math.abs(temperature - idealTemp) / 40
    s.stress += tempStress * 5 * dayDelta
    s.stress = Math.max(0, s.stress - 2 * dayDelta * (1 - tempStress))

    if (s.stress > 60) {
      s.health = drainStat(s.health, s.stress / 100 * 3 * dayDelta * (1 - diseaseResistance))
    }

    if (s.stress < 30 && s.health < 100) {
      s.health += 2 * dayDelta
    }

    const lowVitality = s.vitality < 35

    if (s.energy > 20 && s.health > 50 && s.vitality >= 35 && s.stress < 50) {
      s.vitality = Math.min(100, s.vitality + 2 * dayDelta)
    } else if (s.energy > 20 && s.health > 50 && s.vitality >= 15 && s.vitality < 35 && s.stress < 55) {
      s.vitality = Math.min(100, s.vitality + 1 * dayDelta)
    } else if (s.energy >= STAT_FLOOR && s.vitality <= 35 && s.health >= STAT_FLOOR && s.stress < 60) {
      const slowGain = s.vitality <= 10 ? 0.8 : 0.5
      s.vitality = Math.min(100, s.vitality + slowGain * dayDelta)
    } else if (
      s.vitality > STAT_FLOOR &&
      !lowVitality &&
      (s.energy < 15 || s.stress > 55) &&
      !(s.nutrients > 40 && s.hydration > 20)
    ) {
      s.vitality = drainStat(s.vitality, 3 * dayDelta)
    } else if (
      s.vitality > STAT_FLOOR &&
      lowVitality &&
      (s.energy < 10 || s.stress > 65) &&
      !(s.nutrients > 30 && s.hydration > 15)
    ) {
      s.vitality = drainStat(s.vitality, 1 * dayDelta)
    }

    if (
      s.nutrients > 30 &&
      s.hydration > 15 &&
      s.health > 40 &&
      s.vitality < 100 &&
      s.stress < 60 &&
      !s.isLatent
    ) {
      const nutrientVitalityGain = (s.nutrients / 100) * 1.2 * dayDelta
      s.vitality = Math.min(100, s.vitality + nutrientVitalityGain)
    } else if (
      s.nutrients > 15 &&
      s.hydration > 10 &&
      s.health > 30 &&
      s.vitality < 60 &&
      s.stress < 60 &&
      !s.isLatent
    ) {
      s.vitality = Math.min(100, s.vitality + 1 * dayDelta)
    } else if (
      s.nutrients >= STAT_FLOOR &&
      s.hydration >= STAT_FLOOR &&
      s.health >= STAT_FLOOR &&
      s.vitality <= 35 &&
      s.vitality < 100 &&
      s.stress < 60 &&
      !s.isLatent
    ) {
      const recoveryGain = ((s.nutrients + s.hydration) / 200) * 1.5 * dayDelta
      s.vitality = Math.min(100, s.vitality + recoveryGain)
    }

    if (s.energy <= STAT_FLOOR && s.vitality >= STAT_FLOOR && hasFoliage && isDay && isWarm && !s.isLatent) {
      s.energy = Math.min(100, s.energy + 0.5 * dayDelta)
    }

    arch.updateReproduction(
      dayDelta,
      season,
      s.health,
      s.vitality,
      s.energy,
      dna.flowerProduction,
      dna.fruitProduction
    )
    s.flowers = arch.getFlowerCount()
    s.fruits = arch.getFruitCount()

    this._state.clamp()

    const snapshot = this._state.snapshot()
    for (const cb of this._callbacks) {
      cb(snapshot, this._simulatedDays, this._environment)
    }
  }
}
