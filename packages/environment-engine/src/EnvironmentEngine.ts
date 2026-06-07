import type { EnvironmentState, Season } from './EnvironmentState'

const DAYS_PER_YEAR = 364
const SEASON_LENGTH = DAYS_PER_YEAR / 4

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export class EnvironmentEngine {
  private readonly _solarTables: Record<Season, [number, number][]> = {
    winter: [
      [0, 0], [6, 0], [6.5, 2], [7, 8], [7.5, 14], [8, 20], [9, 50],
      [10, 65], [11, 80], [12, 90], [13, 100], [14, 85],
      [15, 70], [16, 55], [17, 25], [17.5, 14], [18, 8], [19, 0], [24, 0]
    ],
    spring: [
      [0, 0], [5, 0], [5.5, 2], [6, 5], [6.5, 10], [7, 18], [7.5, 28], [8, 45],
      [9, 55], [10, 65], [11, 80], [12, 90], [13, 95],
      [14, 100], [15, 95], [16, 85], [17, 75], [18, 65],
      [19, 45], [19.5, 32], [20, 25], [21, 5], [22, 0], [24, 0]
    ],
    summer: [
      [0, 0], [4, 0], [4.5, 2], [5, 5], [5.5, 12], [6, 20], [6.5, 32], [7, 45],
      [8, 60], [9, 70], [10, 80], [11, 90], [12, 95],
      [13, 100], [14, 100], [15, 95], [16, 90], [17, 85],
      [18, 80], [19, 75], [20, 60], [21, 35], [22, 15], [23, 5], [24, 0]
    ],
    autumn: [
      [0, 0], [6, 0], [6.5, 2], [7, 8], [7.5, 14], [8, 20], [8.5, 32], [9, 45],
      [10, 60], [11, 75], [12, 90], [13, 100], [14, 90],
      [15, 80], [16, 70], [17, 60], [18, 35], [19, 15], [20, 5], [21, 0], [24, 0]
    ]
  }

  private _state: EnvironmentState
  private _targetCloudCover = 20
  private _targetWind = 20
  private _windGust = 20
  private _rainAccum = 0
  private _thermalCloudTarget = 0

  private _pressureHistory: number[] = Array(48).fill(50)
  private _pressureHistoryIndex = 0
  private _pressureChange24h = 0
  private _prevWind = 20

  private _lastPressure = 50
  private _lastHumidity = 60
  private _lastCloudCover = 20
  private _pressureTrend = 0
  private _humidityTrend = 0
  private _cloudTrend = 0
  private _dryDays = 0
  private _lowPressurePhase = 0
  private _highPressurePhase = 0
  private _rainyDays = 0
  private _hasRainedBefore = false
  private _lastUpdateDay = 0
  private readonly _RAIN_ACCUM_CEILING = 15
  private readonly _POST_RAIN_COOLDOWN_DAYS = 2
  private readonly _MAX_RAIN_EPISODE_DAYS = 2.5
  private readonly _DROUGHT_GUARANTEE_DAYS = 35
  private readonly _DROUGHT_RAMP_START = 18

  constructor() {
    this._state = {
      sunlight: 0,
      temperature: 22,
      humidity: 60,
      wind: 20,
      rain: 0,
      cloudCover: 20,
      season: 'spring',
      hour: 0,
      day: 0,
      pressure: 50,
      month: 1,
      rainProbability: 0
    }
  }

  get state(): EnvironmentState {
    return { ...this._state }
  }

  getPersistedState(): EnvironmentState {
    return {
      ...this._state,
      rainAccum: this._rainAccum,
      dryDays: this._dryDays,
      hasRainedBefore: this._hasRainedBefore,
      targetCloudCover: this._targetCloudCover,
      rainyDays: this._rainyDays
    }
  }

  /** Alinea el reloj climático con los días simulados tras cargar partida */
  syncClock(simulatedDays: number): void {
    this._lastUpdateDay = simulatedDays
  }

  get windGust(): number {
    return this._windGust
  }

  update(days: number): void {
    const dayDelta = Math.max(0, days - this._lastUpdateDay)
    this._lastUpdateDay = days
    this._state.day = days
    const dayInYear = days % DAYS_PER_YEAR
    this._state.month = Math.min(12, Math.floor(dayInYear / (DAYS_PER_YEAR / 12)) + 1)

    this._updateTrends()
    this._updatePressureHistory()
    this._updatePressure()
    this._updateRainEvolution(dayDelta)
    this._updateThermalClouds()
    this._updateHumidity()
    this._updateWind()
    this._updateCloudCover()
    this._updateSeason()
    this._updateHour()
    this._updateSunlight(dayDelta)
    this._updateTemperature()
  }

  private _updateTrends(): void {
    const humDiff = this._state.humidity - this._lastHumidity
    const pressDiff = this._state.pressure - this._lastPressure
    const cloudDiff = this._state.cloudCover - this._lastCloudCover

    this._humidityTrend = clamp(humDiff / 2, -1, 1)
    this._pressureTrend = clamp(pressDiff / 2, -1, 1)
    this._cloudTrend = clamp(cloudDiff / 5, -1, 1)

    this._lastHumidity = this._state.humidity
    this._lastPressure = this._state.pressure
    this._lastCloudCover = this._state.cloudCover
  }

  private _updatePressureHistory(): void {
    this._pressureHistory[this._pressureHistoryIndex] = this._state.pressure
    this._pressureHistoryIndex = (this._pressureHistoryIndex + 1) % this._pressureHistory.length
    const oldest = this._pressureHistory[this._pressureHistoryIndex]
    this._pressureChange24h = this._state.pressure - oldest
  }

  private _updatePressure(): void {
    const hour = this._state.hour
    const season = this._state.season

    const dailyOsc = Math.sin((hour - 4) / 24 * Math.PI * 2) * 2

    const seasonBase: Record<Season, { base: number; var: number }> = {
      winter: { base: 1017, var: 15 },
      spring: { base: 1015, var: 10 },
      summer: { base: 1021, var: 7 },
      autumn: { base: 1010, var: 15 }
    }
    const sb = seasonBase[season]

    const tempEffect = this._state.temperature > 20
      ? -(this._state.temperature - 20) * 0.2
      : (20 - this._state.temperature) * 0.15

    const humEffect = -this._humidityTrend * 3

    const cloudEffect = lerp(3, -5, smoothstep(0, 100, this._state.cloudCover))

    const windEffect = lerp(1, -2, smoothstep(0, 20, this._state.wind))

    const phaseEffect = clamp(this._lowPressurePhase * -4 + this._highPressurePhase * 3, -2, 1.5)

    const trendEffect = this._pressureTrend * 2

    const rainyRecovery = smoothstep(1, 4, this._rainyDays) * 3

    const noise = (Math.random() - 0.5) * sb.var * 0.3

    const target = sb.base + dailyOsc + tempEffect + humEffect + cloudEffect + windEffect + phaseEffect + trendEffect + rainyRecovery + noise

    const scaledPressure = ((target - 980) / 60) * 100
    this._state.pressure = lerp(this._state.pressure, clamp(scaledPressure, 0, 100), 0.1)
  }

  private _calculateRainProbability(): number {
    let prob = 0

    const seasonBase: Record<Season, number> = {
      spring: 40, summer: 25, autumn: 60, winter: 32
    }
    prob += seasonBase[this._state.season]

    const monthAdjust: Record<number, number> = {
      1: +10, 2: +5, 3: +15, 4: +25, 5: +20, 6: -10,
      7: -25, 8: -15, 9: +20, 10: +35, 11: +30, 12: +15
    }
    prob += monthAdjust[this._state.month] ?? 0

    prob += lerp(-30, 50, smoothstep(30, 95, this._state.humidity))

    prob += lerp(-40, 60, smoothstep(10, 100, this._state.cloudCover))

    prob += lerp(50, -35, smoothstep(5, 95, this._state.pressure))

    const windContrib = lerp(0, 30, smoothstep(0, 18, this._state.wind))
    const windInhibit = smoothstep(18, 25, this._state.wind) * 50
    prob += windContrib - windInhibit

    prob += Math.max(0, this._humidityTrend + this._cloudTrend) * 10
    prob -= this._pressureTrend * 25

    if (this._dryDays > 3) {
      prob -= Math.min(22, (this._dryDays - 3) * 3)
    }
    if (this._dryDays > 5) {
      prob += Math.min(25, (this._dryDays - 5) * 4)
    }

    if (this._dryDays >= this._DROUGHT_GUARANTEE_DAYS) {
      return 100
    }
    if (this._dryDays > this._DROUGHT_RAMP_START) {
      prob += smoothstep(this._DROUGHT_RAMP_START, this._DROUGHT_GUARANTEE_DAYS, this._dryDays) * 70
    }

    if (this._state.season === 'summer' || this._state.season === 'spring') {
      if (this._state.temperature > 25 && this._state.humidity > 70 && this._state.hour > 14) {
        prob += 30
      }
    }

    return clamp(prob, 0, 100)
  }

  private _updateRainEvolution(dayDelta: number): void {
    const d = dayDelta > 0 ? dayDelta : 0.002

    const prob = this._calculateRainProbability()
    this._state.rainProbability = prob

    if (this._dryDays >= this._DROUGHT_GUARANTEE_DAYS && this._state.rain < 5) {
      this._state.rainProbability = 100
      this._rainAccum = this._RAIN_ACCUM_CEILING
      this._targetCloudCover = Math.max(this._targetCloudCover, 95)
    }

    if (this._state.rain < 5) {
      this._dryDays += d
      this._rainyDays = Math.max(0, this._rainyDays - d * 0.5)
    } else {
      this._dryDays = 0
      this._rainyDays += d
      this._hasRainedBefore = true
    }

    if (this._state.humidity > 70 && this._cloudTrend > 0 && this._pressureTrend < 0) {
      this._lowPressurePhase += d * 0.5
      this._highPressurePhase = Math.max(0, this._highPressurePhase - d * 0.25)
    } else if (this._state.cloudCover < 40 && this._state.humidity < 60 && this._pressureTrend > 0) {
      this._highPressurePhase += d * 0.5
      this._lowPressurePhase = Math.max(0, this._lowPressurePhase - d * 0.25)
    } else {
      this._lowPressurePhase = Math.max(0, this._lowPressurePhase - d * 0.15)
      this._highPressurePhase = Math.max(0, this._highPressurePhase - d * 0.15)
    }

    const postRainCooldown = this._hasRainedBefore
      && this._state.rain < 5
      && this._dryDays < this._POST_RAIN_COOLDOWN_DAYS
    const accumScale = postRainCooldown ? 0.35 : 1
    const episodeEnding = this._rainyDays >= this._MAX_RAIN_EPISODE_DAYS

    if (episodeEnding) {
      const over = this._rainyDays - this._MAX_RAIN_EPISODE_DAYS
      this._rainAccum = Math.max(0, this._rainAccum - (0.35 + over * 0.2) * d)
      this._targetCloudCover = lerp(this._targetCloudCover, 38, 0.14 * d)
    } else if (prob > 70) {
      this._rainAccum = Math.min(this._RAIN_ACCUM_CEILING, this._rainAccum + 0.8 * d * accumScale)
      if (this._rainyDays < 1.5) {
        this._targetCloudCover = lerp(this._targetCloudCover, 95, 0.22 * d)
      }
    } else if (prob > 50) {
      this._rainAccum = Math.min(this._RAIN_ACCUM_CEILING, this._rainAccum + 0.5 * d * accumScale)
      if (this._rainyDays < 1.5) {
        this._targetCloudCover = lerp(this._targetCloudCover, 80, 0.18 * d)
      }
    } else if (prob > 30) {
      this._rainAccum = Math.min(this._RAIN_ACCUM_CEILING, this._rainAccum + 0.28 * d * accumScale)
      this._targetCloudCover = lerp(this._targetCloudCover, 65, 0.14 * d)
    } else if (prob > 15) {
      this._rainAccum = Math.min(this._RAIN_ACCUM_CEILING, this._rainAccum + 0.12 * d * accumScale)
      this._targetCloudCover = lerp(this._targetCloudCover, 55, 0.12 * d)
    } else if (prob > 5) {
      this._rainAccum = Math.max(0, this._rainAccum - 0.04 * d)
      this._targetCloudCover = lerp(this._targetCloudCover, 45, 0.06 * d)
    } else {
      this._rainAccum = Math.max(0, this._rainAccum - 0.08 * d)
      this._targetCloudCover = lerp(this._targetCloudCover, 30, 0.07 * d)
    }

    this._state.cloudCover = lerp(this._state.cloudCover, this._targetCloudCover, 0.28 * d)
    this._state.cloudCover = clamp(this._state.cloudCover, 0, 100)

    const targetRain = clamp(this._rainAccum * 10, 0, 100)
    const rainLerp = prob > 50 ? 0.75 : prob > 30 ? 0.55 : prob > 15 ? 0.35 : 0.2
    this._state.rain = lerp(this._state.rain, targetRain, rainLerp * d)
  }

  private _updateThermalClouds(): void {
    const hour = this._state.hour
    const temp = this._state.temperature
    const humidity = this._state.humidity
    const season = this._state.season
    const rain = this._state.rain

    // Winter: no thermal clouds
    if (season === 'winter') {
      this._thermalCloudTarget *= 0.95
      return
    }

    // Rain suppression: continuous over 3→10mm (no hard threshold)
    const rainSuppress = smoothstep(3, 10, rain)
    if (rainSuppress > 0.999) {
      this._thermalCloudTarget *= 0.95
      return
    }

    const seasonFactors: Record<Season, number> = {
      spring: 1.0, summer: 1.2, autumn: 0.3, winter: 0
    }

    // Hour factor: builds 6→10, peak 10→16, decays 16→22, off 22→6
    let hourFactor: number
    if (hour < 6 || hour >= 22) {
      hourFactor = 0
    } else if (hour < 10) {
      hourFactor = smoothstep(6, 10, hour)
    } else if (hour < 16) {
      hourFactor = 1.0
    } else {
      hourFactor = 1 - smoothstep(16, 22, hour)
    }

    // Temperature factor: starts at 18°C, peaks at 35°C
    const tempFactor = smoothstep(18, 35, temp)

    // Humidity factor: needs 45% to start, peaks at 75%
    const humidityFactor = humidity > 45 ? smoothstep(45, 75, humidity) : 0

    const target = hourFactor * tempFactor * humidityFactor * seasonFactors[season] * 40 * (1 - rainSuppress)
    this._thermalCloudTarget = lerp(this._thermalCloudTarget, target, 0.02)
  }

  private _updateSeason(): void {
    const dayInYear = this._state.day % DAYS_PER_YEAR

    if (dayInYear < SEASON_LENGTH) {
      this._state.season = 'spring'
    } else if (dayInYear < SEASON_LENGTH * 2) {
      this._state.season = 'summer'
    } else if (dayInYear < SEASON_LENGTH * 3) {
      this._state.season = 'autumn'
    } else {
      this._state.season = 'winter'
    }
  }

  private _updateHour(): void {
    const fractionalDay = this._state.day % 1
    this._state.hour = fractionalDay * 24
  }

  private _getDayBounds(season: Season): { dayStart: number; dayEnd: number } {
    switch (season) {
      case 'summer': return { dayStart: 5, dayEnd: 21 }
      case 'winter': return { dayStart: 7, dayEnd: 17 }
      default: return { dayStart: 6, dayEnd: 20 }
    }
  }

  private _sunCurve(dayProgress: number): number {
    if (dayProgress <= 0 || dayProgress >= 1) return 0
    return Math.sin(dayProgress * Math.PI)
  }

  private _lookupTable(season: Season, hour: number): number {
    const table = this._solarTables[season]
    if (hour <= table[0][0]) return table[0][1]
    if (hour >= table[table.length - 1][0]) return table[table.length - 1][1]
    for (let i = 0; i < table.length - 1; i++) {
      if (hour >= table[i][0] && hour < table[i + 1][0]) {
        const t = (hour - table[i][0]) / (table[i + 1][0] - table[i][0])
        return lerp(table[i][1], table[i + 1][1], t)
      }
    }
    return 0
  }

  private _weatherModifier(): number {
    const cloud = this._state.cloudCover
    const rain = this._state.rain
    const isWinter = this._state.season === 'winter'

    // Cloud contribution: continuous 1.0 → 0.55 as cloudCover goes 0→60
    const cloudFactor = 1.0 - smoothstep(0, 60, cloud) * 0.45

    // Rain contribution: continuous
    // Non-winter: 1.0 → 0.20 as rain goes 0→50
    // Winter: 1.0 → 0.70 (snow is bright, rain pools reflect light)
    const rainMin = isWinter ? 0.70 : 0.20
    const rainFactor = 1.0 - smoothstep(0, 50, rain) * (1 - rainMin)

    let modifier = Math.min(cloudFactor, rainFactor)

    // Winter snow clouds are brighter
    if (isWinter && cloud > 60) {
      modifier += (cloud - 60) / 40 * 0.05
    }

    return clamp(modifier, isWinter ? 0.60 : 0.20, 1.0)
  }

  private _updateSunlight(dayDelta: number): void {
    let target = this._lookupTable(this._state.season, this._state.hour)
      * this._weatherModifier()

    // Winter rain pools reflect light (continuous, no hard threshold)
    if (this._state.season === 'winter') {
      target += smoothstep(0, 10, this._state.rain) * 5
    }

    const diff = target - this._state.sunlight
    const timeScale = clamp(dayDelta * 6, 0.2, 1)
    const { dayStart, dayEnd } = this._getDayBounds(this._state.season)
    const hour = this._state.hour
    const inTransition = (hour >= dayStart - 1.5 && hour <= dayStart + 2.5)
      || (hour >= dayEnd - 1.5 && hour <= dayEnd + 2)
    const lerpRate = (0.2 + timeScale * 0.5) * (inTransition ? 2 : 1)
    const maxStep = Math.max(0.6, Math.abs(diff) * lerpRate)
    this._state.sunlight += clamp(diff, -maxStep, maxStep)
  }

  private _updateTemperature(): void {
    const hour = this._state.hour
    const season = this._state.season
    const { dayStart, dayEnd } = this._getDayBounds(season)

    const baseTemp: Record<Season, { day: number; night: number }> = {
      spring: { day: 22, night: 15 },
      summer: { day: 32, night: 25 },
      autumn: { day: 18, night: 10 },
      winter: { day: 15, night: 8 }
    }

    const base = baseTemp[season]
    const sunFactor = this._state.sunlight / 100

    if (hour >= dayStart && hour <= dayEnd) {
      const progress = (hour - dayStart) / (dayEnd - dayStart)
      const curve = this._sunCurve(progress)
      const dayRange = base.day - base.night
      this._state.temperature = base.night + curve * dayRange + sunFactor * 6
    } else {
      let nightProgress: number
      if (hour > dayEnd) {
        nightProgress = (hour - dayEnd) / (24 - dayEnd + dayStart)
      } else {
        nightProgress = (hour + 24 - dayEnd) / (24 - dayEnd + dayStart)
      }
      const cooling = nightProgress * 6
      this._state.temperature = base.night + 3 - cooling
    }

    if (this._state.cloudCover > 60) {
      const cloudCooling = (this._state.cloudCover - 60) / 40 * 3
      this._state.temperature -= cloudCooling
    }
  }

  private _updateCloudCover(): void {
    this._targetCloudCover = clamp(this._targetCloudCover, 0, 100)
    const combined = clamp(this._targetCloudCover + this._thermalCloudTarget, 0, 100)
    this._state.cloudCover = lerp(this._state.cloudCover, combined, 0.03)
    this._state.cloudCover = clamp(this._state.cloudCover, 0, 100)
  }

  private _updateHumidity(): void {
    const season = this._state.season
    const cloudCover = this._state.cloudCover

    let base: number
    switch (season) {
      case 'spring': base = 60; break
      case 'summer': base = 35; break
      case 'autumn': base = 80; break
      case 'winter': base = 55; break
    }

    const rainBoost = this._state.rain * 0.3
    const cloudBoost = cloudCover * 0.15
    const tempDrain = Math.max(0, (this._state.temperature - 25)) * 0.5

    const target = base + rainBoost + cloudBoost - tempDrain
    const smoothRate = 0.1

    this._state.humidity = lerp(this._state.humidity, clamp(target, 10, 100), smoothRate)
  }

private _updateWind(): void {
    const hour = this._state.hour
    const season = this._state.season
    const pressure = this._state.pressure
    const cloudCover = this._state.cloudCover
    const rain = this._state.rain
    const humidity = this._state.humidity
    const temperature = this._state.temperature
    const month = this._state.month

    // 1. Convert pressure (0–100 scale) to hPa
    const hPa = 980 + (pressure / 100) * 60

    // 2. Pressure determines wind range (min/max)
    let minWind: number; let maxWind: number
    if (hPa > 1020) {
      minWind = 0; maxWind = 5
    } else if (hPa > 1010) {
      minWind = 2; maxWind = 7
    } else if (hPa > 1000) {
      minWind = 4; maxWind = 10
    } else {
      minWind = 8; maxWind = 15
    }

    // 3. Gradient (24h change) as multiplier within range
    const pressureChangeHpa = this._pressureChange24h * 0.6
    let gradientFactor: number
    if (pressureChangeHpa < -5) {
      gradientFactor = 1.5
    } else if (pressureChangeHpa < -2) {
      gradientFactor = 1.15
    } else if (pressureChangeHpa > 5) {
      gradientFactor = 0.7
    } else if (pressureChangeHpa > 2) {
      gradientFactor = 0.85
    } else {
      gradientFactor = 1.0
    }

    // 4. Hour factor with peak at 15h
    let hourFactor: number
    if (hour >= 0 && hour < 5) {
      hourFactor = lerp(0.3, 0.5, hour / 5)
    } else if (hour >= 5 && hour < 10) {
      hourFactor = lerp(0.5, 0.7, (hour - 5) / 5)
    } else if (hour >= 10 && hour < 14) {
      hourFactor = lerp(0.7, 0.85, (hour - 10) / 4)
    } else if (hour >= 14 && hour < 17) {
      hourFactor = 0.85
    } else if (hour >= 17 && hour < 21) {
      hourFactor = lerp(0.85, 0.4, (hour - 17) / 4)
    } else {
      hourFactor = lerp(0.4, 0.3, (hour - 21) / 3)
    }

    // 5. Season factor (average wind, converted to multiplier vs baseline 5 m/s)
    const seasonAvg: Record<Season, number> = {
      winter: 6.5, spring: 5.0, summer: 3.5, autumn: 6.0
    }
    const seasonVar: Record<Season, number> = {
      winter: 3, spring: 3, summer: 2, autumn: 3.5
    }
    const seasonFactor = seasonAvg[season] + (Math.random() - 0.5) * seasonVar[season] * 2
    const seasonMultiplier = seasonFactor / 5

    // 6. Month factor
    const monthFactors: Record<number, number> = {
      1: 1.05, 2: 1.05, 3: 1.10, 4: 1.10, 5: 1.05,
      6: 0.85, 7: 0.85, 8: 0.90,
      9: 1.05, 10: 1.10, 11: 1.10, 12: 1.05
    }
    const monthFactor = monthFactors[month] ?? 1.0

    // 7. Cloud factor
    const cloudFactor = cloudCover < 20 ? 1.0
      : cloudCover < 50 ? 1.15
      : cloudCover < 80 ? 1.3
      : 1.5

    // 8. Rain factor
    let rainFactor = 1.0
    if (rain > 5 && rain <= 20) {
      rainFactor = 1.1
    } else if (rain > 20 && rain <= 50) {
      rainFactor = 1.2
    } else if (rain > 50 && rain <= 75) {
      rainFactor = 1.3
    } else if (rain > 75) {
      rainFactor = 1.5 + Math.random() * 1.0
    }

    // Combine: start at mid-point of pressure range, apply multipliers
    let target = minWind + (maxWind - minWind) * 0.4
    target *= gradientFactor
    target *= hourFactor
    target *= seasonMultiplier
    target *= monthFactor
    target *= cloudFactor
    target *= rainFactor

    target = clamp(target, minWind + 0.5, maxWind)

    // Dead calm / high-pressure settling
    if (this._highPressurePhase > 0.8 && this._pressureTrend > 0.5) {
      target = 0.1
    } else if (this._highPressurePhase > 0.3 && this._pressureTrend > 0) {
      const settle = clamp(this._highPressurePhase * this._pressureTrend, 0, 1) * 0.4
      target *= 1 - settle
    }

    // Natural variability
    target += (Math.random() - 0.5) * 0.5

    target = clamp(target, 0.1, 33.33)

    const transitionRate = 0.02
    this._state.wind = lerp(this._state.wind, target, transitionRate)

    this._windGust = this._state.wind * (1.1 + Math.random() * 0.9)
    this._windGust = clamp(this._windGust, 0.5, 33.33)

    this._prevWind = this._state.wind
  }

  restore(state: EnvironmentState): void {
    this._state = {
      sunlight: state.sunlight,
      temperature: state.temperature,
      humidity: state.humidity,
      wind: state.wind,
      rain: state.rain,
      cloudCover: state.cloudCover,
      season: state.season,
      hour: state.hour,
      day: state.day,
      pressure: state.pressure,
      month: state.month,
      rainProbability: state.rainProbability
    }
    this._lastUpdateDay = state.day
    this._targetWind = state.wind
    this._windGust = state.wind
    this._pressureHistory.fill(state.pressure)
    this._lastPressure = state.pressure
    this._lastHumidity = state.humidity
    this._lastCloudCover = state.cloudCover
    this._rainAccum = state.rainAccum ?? clamp(state.rain / 10, 0, this._RAIN_ACCUM_CEILING)
    this._dryDays = state.dryDays ?? 0
    this._hasRainedBefore = state.hasRainedBefore ?? state.rain >= 5
    this._targetCloudCover = state.targetCloudCover ?? state.cloudCover
    this._rainyDays = state.rainyDays ?? (state.rain >= 5 ? 1 : 0)
  }
}
