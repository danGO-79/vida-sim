import { EnvironmentEngine } from './EnvironmentEngine'

describe('EnvironmentEngine', () => {
  it('starts with default state', () => {
    const env = new EnvironmentEngine()
    const s = env.state
    expect(s.sunlight).toBe(0)
    expect(s.temperature).toBe(22)
    expect(s.humidity).toBe(60)
    expect(s.season).toBe('spring')
    expect(s.hour).toBe(0)
  })

  it('updates hour based on simulated days', () => {
    const env = new EnvironmentEngine()
    env.update(0.25)
    expect(env.state.hour).toBeCloseTo(6, 0)

    env.update(0.5)
    expect(env.state.hour).toBeCloseTo(12, 0)
  })

  it('cycles through seasons', () => {
    const env = new EnvironmentEngine()
    expect(env.state.season).toBe('spring')

    env.update(91)
    expect(env.state.season).toBe('summer')

    env.update(182)
    expect(env.state.season).toBe('autumn')

    env.update(273)
    expect(env.state.season).toBe('winter')
  })

  it('produces lower sunlight at night', () => {
    const env = new EnvironmentEngine()
    env.update(0.75)
    const nightLight = env.state.sunlight

    env.update(0.5)
    const dayLight = env.state.sunlight

    expect(nightLight).toBeLessThan(dayLight)
  })

  it('restores state correctly', () => {
    const env = new EnvironmentEngine()
    const saved = env.state
    saved.temperature = 15
    saved.humidity = 45

    const env2 = new EnvironmentEngine()
    env2.restore(saved)
    const restored = env2.state
    expect(restored.temperature).toBe(15)
    expect(restored.humidity).toBe(45)
  })

  it('produces varying wind over time', () => {
    const env = new EnvironmentEngine()
    const winds: number[] = []
    for (let i = 0; i < 200; i++) {
      env.update(env.state.day + 0.5)
      winds.push(env.state.wind)
    }
    const unique = new Set(winds.map(w => Math.round(w * 18)))
    expect(unique.size).toBeGreaterThan(1)
  })

  it('produces rain within the first simulated season', () => {
    const env = new EnvironmentEngine()
    let maxRain = 0
    for (let day = 0; day <= 45; day += 0.25) {
      env.update(day)
      maxRain = Math.max(maxRain, env.state.rain)
    }
    expect(maxRain).toBeGreaterThan(5)
  })

  it('persists and restores rain internals', () => {
    const env = new EnvironmentEngine()
    for (let day = 0; day <= 20; day += 0.5) {
      env.update(day)
    }
    const saved = env.getPersistedState()
    expect(saved.rainAccum).toBeDefined()

    const env2 = new EnvironmentEngine()
    env2.restore(saved)
    env2.syncClock(20)
    expect(env2.getPersistedState().rainAccum).toBeCloseTo(saved.rainAccum!, 1)
  })

  it('forces rain after 35 dry days', () => {
    const env = new EnvironmentEngine()
    const saved = env.getPersistedState()
    saved.rain = 0
    saved.cloudCover = 10
    saved.humidity = 30
    saved.season = 'summer'
    saved.month = 7
    saved.pressure = 85
    saved.dryDays = 35
    saved.day = 100

    env.restore(saved)
    env.syncClock(saved.day)

    env.update(saved.day + 0.05)
    expect(env.state.rainProbability).toBe(100)
    expect(env.getPersistedState().rainAccum).toBe(15)

    let rainStarted = false
    for (let i = 1; i <= 40; i++) {
      env.update(saved.day + i * 0.05)
      if (env.state.rain > 5) {
        rainStarted = true
        break
      }
    }
    expect(rainStarted).toBe(true)
  })
})
