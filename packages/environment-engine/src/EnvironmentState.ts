export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface EnvironmentState {
  sunlight: number
  temperature: number
  humidity: number
  wind: number // m/s (rango 0.5–33.33, equivale a ~2–120 km/h)
  rain: number
  cloudCover: number
  season: Season
  hour: number
  day: number
  pressure: number
  month: number
  rainProbability: number
  /** Estado interno de lluvia (persistido en saves v2+) */
  rainAccum?: number
  dryDays?: number
  hasRainedBefore?: boolean
  targetCloudCover?: number
  rainyDays?: number
}
