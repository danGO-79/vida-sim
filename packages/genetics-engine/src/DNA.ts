export interface ColorPalette {
  stem: [number, number, number]
  leaf: [number, number, number]
  flower: [number, number, number]
  fruit: [number, number, number]
}

export interface DNA {
  growthRate: number
  maxHeight: number
  branchingFactor: number
  leafDensity: number
  leafSize: number
  flowerProduction: number
  fruitProduction: number
  diseaseResistance: number
  waterEfficiency: number
  longevity: number
  branchAngle: number
  colorPalette: ColorPalette
  phyllotaxis: 'alternate' | 'opposite' | 'verticillate' | 'spiral'
  whorlCount: number
  internodeDistance: number
  maxBranches: number
  apicalDominance: number
  phototropism: number
  branchThickness: number
}

export type PlantPersonality =
  | 'Vertical'
  | 'Frondosa'
  | 'Florecedora'
  | 'Resistente'
  | 'Productiva'
  | 'Equilibrada'
  | 'Enana'
  | 'Longeva'
  | 'Ahorradora'

const PALETTES: ColorPalette[] = [
  { stem: [0.20, 0.62, 0.12], leaf: [0.29, 0.62, 0.12], flower: [0.95, 0.61, 0.07], fruit: [0.85, 0.22, 0.11] },
  { stem: [0.25, 0.58, 0.15], leaf: [0.32, 0.58, 0.15], flower: [0.91, 0.33, 0.50], fruit: [0.95, 0.65, 0.07] },
  { stem: [0.28, 0.54, 0.17], leaf: [0.25, 0.55, 0.18], flower: [0.53, 0.25, 0.70], fruit: [0.90, 0.35, 0.12] },
  { stem: [0.18, 0.60, 0.13], leaf: [0.35, 0.60, 0.10], flower: [1.00, 0.84, 0.00], fruit: [0.80, 0.60, 0.15] },
  { stem: [0.30, 0.52, 0.18], leaf: [0.22, 0.52, 0.20], flower: [0.85, 0.45, 0.55], fruit: [0.70, 0.30, 0.40] },
  { stem: [0.22, 0.65, 0.10], leaf: [0.30, 0.65, 0.08], flower: [0.70, 0.20, 0.60], fruit: [0.95, 0.55, 0.10] },
  { stem: [0.26, 0.56, 0.16], leaf: [0.28, 0.50, 0.22], flower: [0.98, 0.60, 0.40], fruit: [0.88, 0.72, 0.06] },
  { stem: [0.18, 0.60, 0.12], leaf: [0.33, 0.56, 0.14], flower: [0.60, 0.40, 0.80], fruit: [0.75, 0.35, 0.20] }
]

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]
}

function pickPalette(rng: () => number): ColorPalette {
  const idx = Math.floor(rng() * PALETTES.length)
  const nextIdx = (idx + 1 + Math.floor(rng() * (PALETTES.length - 1))) % PALETTES.length
  const t = rng() * 0.4
  const a = PALETTES[idx]
  const b = PALETTES[nextIdx]
  return {
    stem: lerpColor(a.stem, b.stem, t),
    leaf: lerpColor(a.leaf, b.leaf, t),
    flower: lerpColor(a.flower, b.flower, t),
    fruit: lerpColor(a.fruit, b.fruit, t)
  }
}

export function classifyPersonality(dna: DNA): PlantPersonality {
  if (dna.growthRate > 1.5 && dna.maxHeight > 150) return 'Vertical'
  if ((dna.branchingFactor > 0.7 || dna.maxBranches > 8) && dna.leafDensity > 0.7) return 'Frondosa'
  if (dna.flowerProduction > 0.7) return 'Florecedora'
  if (dna.diseaseResistance > 0.8 && dna.waterEfficiency > 0.75) return 'Resistente'
  if (dna.fruitProduction > 0.75) return 'Productiva'
  if (dna.longevity > 2.5) return 'Longeva'
  if (dna.waterEfficiency > 0.8) return 'Ahorradora'
  if (dna.maxHeight < 80) return 'Enana'
  return 'Equilibrada'
}

export function generateDNA(seed: number): DNA {
  let s = seed
  function rng(): number {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }

  const growthRate = 0.1 + rng() * 1.9
  const maxHeight = 50 + rng() * 150
  const branchingFactor = 0.1 + rng() * 0.9
  const leafDensity = 0.1 + rng() * 0.9
  const leafSize = 0.5 + rng() * 1.5
  const flowerProduction = rng() * 1.0
  const fruitProduction = rng() * 1.0
  const diseaseResistance = rng() * 1.0
  const waterEfficiency = rng() * 1.0
  const longevity = 0.5 + rng() * 2.5
  const branchAngle = 20 + rng() * 60
  const phyllotaxisOptions: DNA['phyllotaxis'][] = ['alternate', 'opposite', 'verticillate', 'spiral']
  const phyllotaxis = phyllotaxisOptions[Math.floor(rng() * phyllotaxisOptions.length)]
  const whorlCount = 3 + Math.floor(rng() * 3)
  const internodeDistance = 0.8 + rng() * 0.7
  const maxBranches = 3 + Math.floor(rng() * 10)
  const apicalDominance = 0.1 + rng() * 0.9
  const phototropism = rng() * 1.0
  const branchThickness = 0.3 + rng() * 0.7

  const dna: DNA = {
    growthRate,
    maxHeight,
    branchingFactor,
    leafDensity,
    leafSize,
    flowerProduction,
    fruitProduction,
    diseaseResistance,
    waterEfficiency,
    longevity,
    branchAngle,
    colorPalette: pickPalette(rng),
    phyllotaxis,
    whorlCount,
    internodeDistance,
    maxBranches,
    apicalDominance,
    phototropism,
    branchThickness
  }

  return dna
}
