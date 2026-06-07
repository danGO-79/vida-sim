import { generateDNA, classifyPersonality } from './DNA'
import type { DNA } from './DNA'

describe('GeneticsEngine', () => {
  describe('generateDNA', () => {
    it('generates deterministic DNA from the same seed', () => {
      const dna1 = generateDNA(12345)
      const dna2 = generateDNA(12345)
      expect(dna1).toEqual(dna2)
    })

    it('generates different DNA from different seeds', () => {
      const dna1 = generateDNA(100)
      const dna2 = generateDNA(200)
      expect(dna1).not.toEqual(dna2)
    })

    it('produces values within expected ranges', () => {
      const dna = generateDNA(42)

      expect(dna.growthRate).toBeGreaterThanOrEqual(0.1)
      expect(dna.growthRate).toBeLessThanOrEqual(2.0)

      expect(dna.maxHeight).toBeGreaterThanOrEqual(50)
      expect(dna.maxHeight).toBeLessThanOrEqual(200)

      expect(dna.branchingFactor).toBeGreaterThanOrEqual(0.1)
      expect(dna.branchingFactor).toBeLessThanOrEqual(1.0)

      expect(dna.flowerProduction).toBeGreaterThanOrEqual(0)
      expect(dna.flowerProduction).toBeLessThanOrEqual(1)

      expect(dna.longevity).toBeGreaterThanOrEqual(0.5)
      expect(dna.longevity).toBeLessThanOrEqual(3.0)

      expect(dna.branchAngle).toBeGreaterThanOrEqual(20)
      expect(dna.branchAngle).toBeLessThanOrEqual(80)

      expect(dna.colorPalette.stem.length).toBe(3)
      expect(dna.colorPalette.leaf.length).toBe(3)
      expect(dna.colorPalette.flower.length).toBe(3)
      expect(dna.colorPalette.fruit.length).toBe(3)
    })

    it('always produces valid color components (0-1)', () => {
      const dna = generateDNA(77)
      const pal = dna.colorPalette
      for (const key of ['stem', 'leaf', 'flower', 'fruit'] as const) {
        for (const v of pal[key]) {
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  describe('classifyPersonality', () => {
    function makeDna(overrides: Partial<DNA>): DNA {
      return {
        growthRate: 1,
        maxHeight: 100,
        branchingFactor: 0.5,
        leafDensity: 0.5,
        leafSize: 1,
        flowerProduction: 0.3,
        fruitProduction: 0.3,
        diseaseResistance: 0.5,
        waterEfficiency: 0.5,
        longevity: 1.5,
        branchAngle: 45,
        colorPalette: { stem: [0.3, 0.5, 0.15], leaf: [0.3, 0.6, 0.12], flower: [0.95, 0.6, 0.07], fruit: [0.85, 0.22, 0.11] },
        phyllotaxis: 'alternate',
        whorlCount: 4,
        internodeDistance: 1.0,
        maxBranches: 6,
        apicalDominance: 0.5,
        phototropism: 0.5,
        branchThickness: 0.5,
        ...overrides
      }
    }

    it('classifies as Vertical when tall and fast-growing', () => {
      const dna = makeDna({ growthRate: 1.8, maxHeight: 180 })
      expect(classifyPersonality(dna)).toBe('Vertical')
    })

    it('classifies as Frondosa when highly branching', () => {
      const dna = makeDna({ branchingFactor: 0.8, leafDensity: 0.9 })
      expect(classifyPersonality(dna)).toBe('Frondosa')
    })

    it('classifies as Florecedora when high flower production', () => {
      const dna = makeDna({ flowerProduction: 0.9 })
      expect(classifyPersonality(dna)).toBe('Florecedora')
    })

    it('classifies as Resistente when resistant and efficient', () => {
      const dna = makeDna({ diseaseResistance: 0.9, waterEfficiency: 0.85 })
      expect(classifyPersonality(dna)).toBe('Resistente')
    })

    it('classifies as Equilibrada for average DNA', () => {
      const dna = makeDna({})
      expect(classifyPersonality(dna)).toBe('Equilibrada')
    })
  })
})
