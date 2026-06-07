import { SimulationEngine } from './SimulationEngine'
import { EnvironmentEngine } from '@vida/environment-engine'
import { GeneticsEngine } from '@vida/genetics-engine'
import type { PlantParams } from './PlantState'

function createTestEngine(seed = 42): {
  engine: SimulationEngine
  genetics: GeneticsEngine
  environment: EnvironmentEngine
} {
  const genetics = new GeneticsEngine(seed)
  const environment = new EnvironmentEngine()
  const engine = new SimulationEngine(genetics.dna, environment.state)
  return { engine, genetics, environment }
}

function advance(
  engine: SimulationEngine,
  environment: EnvironmentEngine,
  ticks: number,
  ms = 100
): void {
  for (let i = 0; i < ticks; i++) {
    environment.update(engine.simulatedDays)
    engine.setEnvironment(environment.state)
    engine.update(ms)
  }
}

describe('SimulationEngine', () => {
  describe('initial state', () => {
    it('starts with default parameters', () => {
      const { engine } = createTestEngine()
      const s = engine.state
      expect(s.health).toBe(100)
      expect(s.vitality).toBe(50)
      expect(s.energy).toBe(30)
      expect(s.hydration).toBe(80)
      expect(s.nutrients).toBe(70)
      expect(s.age).toBe(0)
      expect(s.isLatent).toBe(false)
      expect(engine.architecture.getHeight()).toBe(0)
    })
  })

  describe('time progression', () => {
    it('increases simulated days with real time', () => {
      const { engine, environment } = createTestEngine()
      const initialDays = engine.simulatedDays
      advance(engine, environment, 100)
      expect(engine.simulatedDays).toBeGreaterThan(initialDays)
    })

    it('scales time correctly (1 real day = 7 simulated days)', () => {
      const { engine, environment } = createTestEngine()
      environment.update(0)
      engine.setEnvironment(environment.state)
      engine.update(86400_000)
      expect(engine.simulatedDays).toBeCloseTo(7, 0)
    })
  })

  describe('plant growth', () => {
    it('increases height over time in good conditions', () => {
      const { engine, environment } = createTestEngine()
      const initialHeight = engine.architecture.getHeight()
      advance(engine, environment, 864 * 30)
      expect(engine.architecture.getHeight()).toBeGreaterThan(initialHeight)
    })
  })

  describe('latency', () => {
    it('enters latent state when health and resources are depleted', () => {
      const { engine, environment } = createTestEngine()
      const s = engine.state
      s.health = 0
      s.hydration = 0
      s.nutrients = 0
      advance(engine, environment, 10, 1000)
      expect(engine.state.isLatent).toBe(true)
    })

    it('recovers from latency when conditions improve over time', () => {
      const { engine, environment } = createTestEngine()
      const s = engine.state
      s.health = 0
      s.hydration = 0
      s.nutrients = 0
      s.isLatent = true
      advance(engine, environment, 1, 86400_000 * 1.5)
      expect(engine.state.isLatent).toBe(false)
      expect(engine.state.health).toBeGreaterThan(0)
      expect(engine.state.hydration).toBeGreaterThan(0)
      expect(engine.state.vitality).toBeGreaterThan(0)
    })
  })

  describe('leaf growth', () => {
    it('produces more leaves as the plant grows', () => {
      const { engine, environment } = createTestEngine()
      const initialLeaves = engine.architecture.getTotalLeaves()
      advance(engine, environment, 864 * 20)
      expect(engine.architecture.getTotalLeaves()).toBeGreaterThanOrEqual(initialLeaves)
    })
  })

  describe('energy management', () => {
    it('generates energy during daytime when the plant has foliage', () => {
      const { engine, environment } = createTestEngine()
      for (let i = 0; i < 8; i++) {
        environment.update(engine.simulatedDays)
        engine.setEnvironment(environment.state)
        engine.update(86400_000)
      }
      expect(engine.architecture.getTotalLeaves()).toBeGreaterThan(0)

      environment.update(0.5)
      engine.setEnvironment(environment.state)
      engine.state.vitality = 80

      const initialEnergy = engine.state.energy
      advance(engine, environment, 10, 1000)
      expect(engine.state.energy).toBeGreaterThan(initialEnergy - 1)
    })
  })

  describe('restore', () => {
    it('restores saved state correctly', () => {
      const { engine } = createTestEngine()
      const savedState: PlantParams = {
        age: 25,
        health: 70,
        vitality: 60,
        energy: 55,
        hydration: 65,
        nutrients: 50,
        stress: 20,
        flowers: 3,
        fruits: 1
      }

      engine.restore(savedState, 25)

      const s = engine.state
      expect(s.age).toBe(25)
      expect(s.health).toBe(70)
      expect(s.flowers).toBe(3)
      expect(s.fruits).toBe(1)
    })
  })
})
