import type { DNA } from '@vida/genetics-engine'

const STEM_HEIGHT_FACTOR = 0.6
const MAX_FOLIAGE_FULLNESS = 0.8
const APEX_LENGTH_RATIO = 0.62
const BRANCH_LENGTH_RATIO = 0.35
const BRANCH_GROWTH_RATE = 0.85
const TWIG_LENGTH_RATIO = 0.12
const TWIG_GROWTH_RATE = 0.55
const TOTAL_GROWTH_DURATION = 20

export interface LeafSnapshot {
  age: number
  size: number
  angle: number
  scale: number
  dead: boolean
}

export interface BranchNodeSnapshot {
  index: number
  age: number
  position: number
  leaves: LeafSnapshot[]
  hasLateral: boolean
  lateralBranchId: number | null
  hasFlower?: boolean
  hasFruit?: boolean
}

export type BranchType = 'main' | 'lateral' | 'twig'

export interface BranchSnapshot {
  id: number
  parentBranchId: number | null
  parentNodeIndex: number | null
  nodes: BranchNodeSnapshot[]
  age: number
  length: number
  targetLength: number
  baseAngle: number
  azimuth: number
  active: boolean
  phyllotaxis: string
  phyllotaxisCount: number
  type: BranchType
  whorlIndex?: number
  growthRateFactor?: number
  mature?: boolean
  isApex?: boolean
  stemAttachPosition?: number
}

export interface ArchitectureSnapshot {
  branches: BranchSnapshot[]
  mainStemId: number
  nextId: number
  growthTimer: number
  nextNodeAt?: number
  apexBranchIds?: number[]
}

export type LeafDropEvent = {
  branchId: number
  nodeIndex: number
  angle: number
}

class LeafInstance {
  age = 0
  size = 0.01
  angle = 0
  scale = 1
  dead = false
  private _maxAge = 15 + Math.random() * 20

  get isDead(): boolean {
    return this.dead || this.age > this._maxAge * 1.5
  }

  grow(
    delta: number,
    growthRate: number,
    energyFactor: number,
    maxSize = 1,
    fullnessMod = 1
  ): void {
    this.age += delta
    if (this.isDead) return

    if (this.age > this._maxAge) {
      const senescenceRate = (this.age - this._maxAge) / this._maxAge
      this.size = Math.max(0, this.size - senescenceRate * 0.3 * delta)
      if (this.size < 0.05) this.dead = true
      return
    }

    if (fullnessMod <= 0) return

    const effectiveRate = growthRate * (0.5 + energyFactor * 0.5)
    const rate = effectiveRate * 2.5 * fullnessMod
    this.size += (1 - this.size) * rate * delta
    if (this.size > maxSize) this.size = maxSize
  }
}

class BranchNode {
  index: number
  age = 0
  position: number
  leaves: LeafInstance[]
  hasLateral = false
  lateralBranchId: number | null = null
  hasFlower = false
  hasFruit = false

  constructor(index: number, position: number, leafAngles: number[], leafScales: number[]) {
    this.index = index
    this.position = position
    this.leaves = leafAngles.map((angle, i) => {
      const leaf = new LeafInstance()
      leaf.angle = angle
      leaf.scale = leafScales[i]
      return leaf
    })
  }
}

class Branch {
  id: number
  parentBranchId: number | null
  parentNodeIndex: number | null
  nodes: BranchNode[] = []
  age = 0
  length = 0
  targetLength = 0
  baseAngle: number
  azimuth: number
  active = true
  type: BranchType
  whorlIndex = 0
  growthRateFactor = 1
  mature = false
  isApex = false
  stemAttachPosition: number | null = null
  private _phyllotaxis: DNA['phyllotaxis']
  private _phyllotaxisCount: number

  constructor(
    id: number,
    parentBranchId: number | null,
    parentNodeIndex: number | null,
    baseAngle: number,
    azimuth: number,
    type: BranchType
  ) {
    this.id = id
    this.parentBranchId = parentBranchId
    this.parentNodeIndex = parentNodeIndex
    this.baseAngle = baseAngle
    this.azimuth = azimuth
    this.type = type
    this._phyllotaxis = 'opposite'
    this._phyllotaxisCount = 2
  }
}

export class PlantArchitecture {
  branches: Map<number, Branch>
  nextId: number
  mainStemId: number
  private _dna: DNA
  private _growthTimer = 0
  private _nextNodeAt = 0
  private _whorlCount = 0
  private _apexBranchIds: number[] = []
  private _growthSeason = 'spring'
  private _mulchLayer = 0
  private _leafDropQueue: LeafDropEvent[] = []

  constructor(dna: DNA) {
    this._dna = dna
    this.branches = new Map()
    this.nextId = 1

    const mainStem = new Branch(0, null, null, 0, 0, 'main')
    mainStem.targetLength = this._stemMaxHeight()
    this.branches.set(0, mainStem)
    this.mainStemId = 0
    this._nextNodeAt = this._internodeLength() * 0.55
  }

  get mainStem(): Branch {
    return this.branches.get(this.mainStemId)!
  }

  private _stemMaxHeight(): number {
    return this._dna.maxHeight * STEM_HEIGHT_FACTOR
  }

  private _stemGrowthRate(): number {
    return this._stemMaxHeight() / TOTAL_GROWTH_DURATION
  }

  private _internodeLength(): number {
    const stemMax = this._stemMaxHeight()
    const spacing = 0.07 + this._dna.internodeDistance * 0.055
    const density = 0.85 + this._dna.branchingFactor * 0.35
    return stemMax * spacing / density
  }

  private _maxStemNodes(): number {
    const stemMax = this._stemMaxHeight()
    const bySpacing = Math.floor(stemMax / this._internodeLength())
    const byDna = Math.max(4, Math.floor(this._dna.maxBranches * 0.75))
    return Math.min(bySpacing, byDna, 12)
  }

  private _whorlLengthFactor(whorlIndex: number, maxNodes: number): number {
    const t = maxNodes <= 1 ? 0 : whorlIndex / (maxNodes - 1)
    const dominance = this._dna.apicalDominance
    return (1.0 - t * (0.4 + dominance * 0.35)) * (0.75 + this._dna.branchingFactor * 0.35)
  }

  private _whorlGrowthFactor(whorlIndex: number, maxNodes: number): number {
    const t = maxNodes <= 1 ? 0 : whorlIndex / (maxNodes - 1)
    return 1.2 - t * 0.5
  }

  private _newBranchId(): number {
    return this.nextId++
  }

  grow(
    dayDelta: number,
    energyFactor: number,
    nutrientFactor: number,
    _sunlightFactor: number,
    growthMod: number,
    growthRate: number,
    apicalDominance: number,
    _sunAngle: number,
    season: string
  ): void {
    this._growthSeason = season
    this._growthTimer += dayDelta
    const timer = this._growthTimer
    const growthVitality = Math.min(1, energyFactor * nutrientFactor * growthMod)
    void apicalDominance

    const mainStem = this.mainStem
    const stemProgress = Math.min(1, timer / TOTAL_GROWTH_DURATION)
    mainStem.length = stemProgress * mainStem.targetLength

    this._maybeSpawnStemNodes()
    this._syncApexWhorl()
    this._growChildBranches(dayDelta, growthRate, growthVitality)

    this._growAllLeaves(dayDelta, growthRate, growthVitality)

    for (const [, branch] of this.branches) {
      branch.age += dayDelta
    }
  }

  updateSeasonalFoliage(season: string, dayDelta: number): number {
    if (season === 'spring') {
      this._mulchLayer = Math.max(0, this._mulchLayer - dayDelta * 1.5)
      this._replenishSpringFoliage(season)
    }

    if (season === 'autumn' || season === 'winter') {
      const dt = Math.min(dayDelta, 0.35)
      const dropRate = season === 'autumn' ? 0.22 : 0.1

      for (const [, branch] of this.branches) {
        for (const node of branch.nodes) {
          for (const leaf of node.leaves) {
            if (leaf.dead) continue
            leaf.size = Math.max(0, leaf.size - dropRate * dt)
            if (leaf.size <= 0.08) {
              leaf.dead = true
            }
          }
        }
      }
    }

    return this._removeDeadLeaves(season === 'autumn' || season === 'winter')
  }

  consumeLeafDrops(): LeafDropEvent[] {
    const drops = this._leafDropQueue
    this._leafDropQueue = []
    return drops
  }

  private _removeDeadLeaves(queueDrops: boolean): number {
    let dropped = 0

    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        const surviving: LeafInstance[] = []
        for (const leaf of node.leaves) {
          if (leaf.dead || leaf.isDead) {
            dropped++
            if (queueDrops) {
              this._leafDropQueue.push({
                branchId: branch.id,
                nodeIndex: node.index,
                angle: leaf.angle
              })
            }
          } else {
            surviving.push(leaf)
          }
        }
        node.leaves = surviving
      }
    }

    if (queueDrops && dropped > 0) {
      this._mulchLayer += dropped
    }

    return dropped
  }

  private _leafMaxSize(): number {
    return clamp(0.45 + this._dna.leafSize * 0.35, 0.5, 1.0)
  }

  getTargetFullness(): number {
    return Math.min(MAX_FOLIAGE_FULLNESS, 0.25 + this._dna.leafDensity * 0.55)
  }

  getFoliageFullness(): number {
    const maxSize = this._leafMaxSize()
    let sum = 0
    let cap = 0
    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        for (const leaf of node.leaves) {
          if (leaf.isDead) continue
          sum += leaf.size * leaf.scale
          cap += maxSize * leaf.scale
        }
      }
    }
    return cap > 0 ? sum / cap : 0
  }

  private _growAllLeaves(dayDelta: number, growthRate: number, vitality: number): void {
    if (this._growthSeason === 'autumn' || this._growthSeason === 'winter') return

    const target = this.getTargetFullness()
    const maxSize = this._leafMaxSize()
    const springBoost = this._growthSeason === 'spring' ? 2.2 : 1

    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        for (const leaf of node.leaves) {
          const fullness = this.getFoliageFullness()
          if (fullness >= target) continue

          const headroom = target - fullness
          const fullnessMod = clamp(headroom / 0.12, 0.05, 1) * springBoost
          leaf.grow(dayDelta, growthRate, vitality, maxSize, fullnessMod)
        }
      }
    }
  }

  /** Re-leaf bare nodes on existing branches at spring budburst */
  private _replenishSpringFoliage(season: string): void {
    if (season !== 'spring') return

    for (const [, branch] of this.branches) {
      if (branch.type === 'main') continue

      const progress = branch.mature
        ? 1
        : (branch.targetLength > 0 ? branch.length / branch.targetLength : 0)
      if (branch.type === 'lateral' && progress < 0.1) continue
      if (branch.type === 'twig' && progress < 0.15) continue

      for (const node of branch.nodes) {
        this._addLeavesToNode(node, season)
      }
    }
  }

  private _bottomWhorlTargetLength(): number {
    const maxNodes = this._maxStemNodes()
    const stemMax = this._stemMaxHeight()
    const whorlFactor = this._whorlLengthFactor(0, maxNodes)
    return stemMax * BRANCH_LENGTH_RATIO * whorlFactor
  }

  private _maybeSpawnStemNodes(): void {
    const mainStem = this.mainStem
    const maxNodes = this._maxStemNodes()
    const internode = this._internodeLength()
    const apexReserve = internode * 0.85

    while (
      mainStem.nodes.length < maxNodes &&
      mainStem.length >= this._nextNodeAt
    ) {
      const attachHeight = Math.max(internode * 0.4, this._nextNodeAt - internode * 0.12)
      if (attachHeight > mainStem.length - apexReserve) break

      const nodeIndex = mainStem.nodes.length
      const node = new BranchNode(nodeIndex, attachHeight, [], [])
      mainStem.nodes.push(node)
      this._createLateralBranches(node, this._whorlCount)
      this._whorlCount++
      this._nextNodeAt += internode
    }
  }

  private _syncApexWhorl(): void {
    const mainStem = this.mainStem
    const internode = this._internodeLength()
    if (mainStem.length < internode * 0.25) return

    const stemMax = this._stemMaxHeight()
    const attachPosition = mainStem.length

    if (this._apexBranchIds.length < 2) {
      for (let i = this._apexBranchIds.length; i < 2; i++) {
        this._createApexBranch(i * Math.PI, stemMax, attachPosition)
      }
    }

    for (const branchId of this._apexBranchIds) {
      const branch = this.branches.get(branchId)
      if (branch) branch.stemAttachPosition = attachPosition
    }
  }

  private _createApexBranch(azimuth: number, _stemMax: number, attachPosition: number): void {
    const branchId = this._newBranchId()
    const angleVariation = (Math.random() - 0.5) * 12 * Math.PI / 180
    const spread = (this._dna.branchAngle * 0.65 * Math.PI / 180) + angleVariation + Math.PI * 0.18
    const finalAngle = clamp(spread, 0.4, 1.0)

    const bottomLength = this._bottomWhorlTargetLength()
    const apexFactor = APEX_LENGTH_RATIO * (0.92 + Math.random() * 0.12)

    const branch = new Branch(branchId, this.mainStemId, null, finalAngle, azimuth, 'lateral')
    branch.isApex = true
    branch.stemAttachPosition = attachPosition
    branch.length = 0
    branch.growthRateFactor = 1.15
    branch.targetLength = bottomLength * apexFactor
    branch.nodes.push(new BranchNode(0, 0, [], []))
    this._addLeavesToNode(branch.nodes[0])

    this.branches.set(branchId, branch)
    this._apexBranchIds.push(branchId)
  }

  private _growChildBranches(dayDelta: number, growthRate: number, vitality: number): void {
    const stemRate = this._stemGrowthRate()

    for (const [, branch] of this.branches) {
      if (branch.type === 'main') continue

      if (branch.mature) {
        if (branch.type === 'lateral') {
          this._maybeSpawnLeavesOnBranch(branch)
        } else if (branch.type === 'twig') {
          this._maybeSpawnLeavesOnTwig(branch)
        }
        continue
      }

      if (branch.length >= branch.targetLength) {
        branch.length = branch.targetLength
        branch.mature = true
        this._syncBranchStructure(branch, true)
        continue
      }

      const baseRate = branch.type === 'lateral' ? BRANCH_GROWTH_RATE : TWIG_GROWTH_RATE
      const rateFactor = baseRate * branch.growthRateFactor
      const growth = stemRate * rateFactor * growthRate * vitality * dayDelta
      branch.length = Math.min(branch.targetLength, branch.length + growth)

      this._syncBranchStructure(branch, false)

      if (branch.type === 'lateral') {
        this._maybeSpawnLeavesOnBranch(branch)
        this._maybeSpawnTwigs(branch)
      } else if (branch.type === 'twig') {
        this._maybeSpawnLeavesOnTwig(branch)
      }
    }
  }

  private _syncBranchStructure(branch: Branch, freeze: boolean): void {
    if (branch.type === 'main' || freeze) return

    if (branch.type === 'lateral') {
      const progress = branch.targetLength > 0 ? branch.length / branch.targetLength : 0

      if (branch.nodes.length === 0) {
        branch.nodes.push(new BranchNode(0, 0, [], []))
      }
      branch.nodes[0].position = 0

      if (progress >= 0.25 && branch.nodes.length < 2) {
        branch.nodes.push(new BranchNode(1, branch.length * 0.6, [], []))
      }
      if (branch.nodes.length >= 2) {
        branch.nodes[1].position = branch.length * 0.6
      }
    } else if (branch.type === 'twig') {
      if (branch.nodes.length === 0) {
        branch.nodes.push(new BranchNode(0, 0, [], []))
      }
      branch.nodes[0].position = 0
    }
  }

  private _branchCountForPhyllotaxis(): number {
    switch (this._dna.phyllotaxis) {
      case 'alternate': return 1
      case 'verticillate': return Math.min(3, this._dna.whorlCount)
      case 'spiral': return 1
      default: return 2
    }
  }

  private _createLateralBranches(node: BranchNode, whorlIndex: number): void {
    node.hasLateral = true
    const maxNodes = this._maxStemNodes()
    const whorlFactor = this._whorlLengthFactor(whorlIndex, maxNodes)
    const growthFactor = this._whorlGrowthFactor(whorlIndex, maxNodes)
    const stemMax = this._stemMaxHeight()
    const count = this._branchCountForPhyllotaxis()
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < count; i++) {
      const branchId = this._newBranchId()
      const angleVariation = (Math.random() - 0.5) * 18 * Math.PI / 180
      const baseDeg = this._dna.branchAngle + (whorlIndex % 2) * 8
      const spread = (baseDeg * Math.PI / 180) + angleVariation
      const gravity = Math.PI * 0.22
      const finalAngle = clamp(spread + gravity, 0.35, 1.15)

      let azimuth: number
      if (count === 1) {
        azimuth = whorlIndex * goldenAngle + i * Math.PI * 0.5
      } else if (count === 2) {
        azimuth = i * Math.PI
      } else {
        azimuth = (i / count) * Math.PI * 2
      }

      const branch = new Branch(branchId, this.mainStemId, node.index, finalAngle, azimuth, 'lateral')
      branch.length = 0
      branch.whorlIndex = whorlIndex
      branch.growthRateFactor = growthFactor
      branch.targetLength = stemMax * BRANCH_LENGTH_RATIO * whorlFactor * (0.92 + Math.random() * 0.12)
      branch.nodes.push(new BranchNode(0, 0, [], []))

      this.branches.set(branchId, branch)
    }
  }

  private _maybeSpawnTwigs(branch: Branch): void {
    if (branch.mature) return

    const progress = branch.length / branch.targetLength
    if (progress < 0.5) return

    for (const node of branch.nodes) {
      if (node.lateralBranchId !== null) continue

      const twigId = this._newBranchId()
      const angleVariation = (Math.random() - 0.5) * 20 * Math.PI / 180
      const spread = (this._dna.branchAngle * 0.45 * Math.PI / 180) + angleVariation + Math.PI * 0.12
      const finalAngle = clamp(spread, 0.25, 0.85)
      const azimuth = branch.azimuth + (Math.random() - 0.5) * 0.8

      const twig = new Branch(twigId, branch.id, node.index, finalAngle, azimuth, 'twig')
      twig.length = 0
      twig.whorlIndex = branch.whorlIndex
      twig.growthRateFactor = branch.growthRateFactor * 0.85
      twig.targetLength = branch.targetLength * TWIG_LENGTH_RATIO / BRANCH_LENGTH_RATIO
      twig.nodes.push(new BranchNode(0, 0, [], []))

      this.branches.set(twigId, twig)
      node.lateralBranchId = twigId
    }
  }

  private _addLeavesToNode(node: BranchNode, season?: string): void {
    const activeSeason = season ?? this._growthSeason
    if (activeSeason === 'autumn' || activeSeason === 'winter') return
    if (node.leaves.length > 0) return

    const isSpring = activeSeason === 'spring'
    for (const angle of [0, Math.PI]) {
      const leaf = new LeafInstance()
      leaf.angle = angle
      leaf.scale = 0.7 + Math.random() * 0.6
      if (isSpring) {
        leaf.size = 0.12 + Math.random() * 0.1
      }
      node.leaves.push(leaf)
    }
  }

  private _maybeSpawnLeavesOnBranch(branch: Branch): void {
    const progress = branch.mature
      ? 1
      : (branch.targetLength > 0 ? branch.length / branch.targetLength : 0)

    if (progress >= 0.1 && branch.nodes[0]) {
      this._addLeavesToNode(branch.nodes[0])
    }
    if (progress >= 0.3 && branch.nodes[1]) {
      this._addLeavesToNode(branch.nodes[1])
    }
  }

  private _maybeSpawnLeavesOnTwig(branch: Branch): void {
    const progress = branch.mature
      ? 1
      : (branch.targetLength > 0 ? branch.length / branch.targetLength : 0)
    if (progress < 0.15 || branch.nodes.length === 0) return
    this._addLeavesToNode(branch.nodes[0])
  }

  getTotalLeaves(): number {
    let count = 0
    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        for (const leaf of node.leaves) {
          if (!leaf.isDead) count++
        }
      }
    }
    return count
  }

  getDeadLeafCount(): number {
    return Math.floor(this._mulchLayer)
  }

  getActiveLeaves(): number {
    return this.getTotalLeaves()
  }

  getTotalNodes(): number {
    let count = 0
    for (const [, branch] of this.branches) {
      count += branch.nodes.length
    }
    return count
  }

  getHeight(): number {
    return this.mainStem.length
  }

  getBranchCount(): number {
    return this.branches.size
  }

  getFlowerableNodes(): { branchId: number; nodeIndex: number }[] {
    const result: { branchId: number; nodeIndex: number }[] = []
    for (const [, branch] of this.branches) {
      if (branch.type === 'main' || !branch.mature) continue
      for (let i = 0; i < branch.nodes.length; i++) {
        const node = branch.nodes[i]
        if (node.leaves.some(l => !l.isDead) && !node.hasFlower && !node.hasFruit) {
          result.push({ branchId: branch.id, nodeIndex: i })
        }
      }
    }
    return result
  }

  getFlowerCount(): number {
    let count = 0
    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        if (node.hasFlower) count++
      }
    }
    return count
  }

  getFruitCount(): number {
    let count = 0
    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        if (node.hasFruit) count++
      }
    }
    return count
  }

  updateReproduction(
    dayDelta: number,
    season: string,
    health: number,
    vitality: number,
    energy: number,
    flowerProduction: number,
    fruitProduction: number
  ): void {
    const flowerCount = this.getFlowerCount()
    const fruitCount = this.getFruitCount()

    if (
      health > 70 &&
      vitality > 60 &&
      this.getTotalNodes() > 5 &&
      flowerProduction > 0
    ) {
      const flowerChance = flowerProduction * dayDelta * 2 * (
        season === 'spring' ? 1.5 : season === 'winter' ? 0.2 : 1.0
      )
      if (flowerChance > Math.random() * (100 / (flowerCount + 1))) {
        const candidates = this.getFlowerableNodes()
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)]
          const branch = this.branches.get(pick.branchId)
          const node = branch?.nodes[pick.nodeIndex]
          if (node) node.hasFlower = true
        }
      }
    }

    if (flowerCount > 0 && fruitProduction > 0) {
      const fruitChance = fruitProduction * dayDelta * 0.5
      if (fruitChance > Math.random() * (20 / (fruitCount + 1))) {
        const floweringNodes: { branchId: number; nodeIndex: number }[] = []
        for (const [, branch] of this.branches) {
          if (!branch.mature) continue
          for (let i = 0; i < branch.nodes.length; i++) {
            const node = branch.nodes[i]
            if (node.hasFlower && !node.hasFruit) {
              floweringNodes.push({ branchId: branch.id, nodeIndex: i })
            }
          }
        }
        if (floweringNodes.length > 0) {
          const pick = floweringNodes[Math.floor(Math.random() * floweringNodes.length)]
          const branch = this.branches.get(pick.branchId)
          const node = branch?.nodes[pick.nodeIndex]
          if (node) node.hasFruit = true
        }
      }
    }

    if (flowerCount > 0 && (health < 40 || vitality < 20 || energy < 15)) {
      for (const [, branch] of this.branches) {
        for (const node of branch.nodes) {
          if (node.hasFlower && !node.hasFruit && Math.random() < 0.5 * dayDelta) {
            node.hasFlower = false
          }
        }
      }
    }
  }

  getAllNodes(): { branchId: number; nodeIndex: number; position: number; leafSizes: number[]; leafDead: boolean[] }[] {
    const result: { branchId: number; nodeIndex: number; position: number; leafSizes: number[]; leafDead: boolean[] }[] = []
    for (const [, branch] of this.branches) {
      for (const node of branch.nodes) {
        result.push({
          branchId: branch.id,
          nodeIndex: node.index,
          position: node.position,
          leafSizes: node.leaves.map(l => l.size * l.scale),
          leafDead: node.leaves.map(l => l.isDead)
        })
      }
    }
    return result
  }

  snapshot(): ArchitectureSnapshot {
    const branches: BranchSnapshot[] = []
    for (const [, branch] of this.branches) {
      const nodes: BranchNodeSnapshot[] = branch.nodes.map(n => ({
        index: n.index,
        age: n.age,
        position: n.position,
        leaves: n.leaves.map(l => ({ age: l.age, size: l.size, angle: l.angle, scale: l.scale, dead: l.dead })),
        hasLateral: n.hasLateral,
        lateralBranchId: n.lateralBranchId,
        hasFlower: n.hasFlower,
        hasFruit: n.hasFruit
      }))
      branches.push({
        id: branch.id,
        parentBranchId: branch.parentBranchId,
        parentNodeIndex: branch.parentNodeIndex,
        nodes,
        age: branch.age,
        length: branch.length,
        targetLength: branch.targetLength,
        baseAngle: branch.baseAngle,
        azimuth: branch.azimuth,
        active: branch.active,
        phyllotaxis: branch['_phyllotaxis'],
        phyllotaxisCount: branch['_phyllotaxisCount'],
        type: branch.type,
        whorlIndex: branch.whorlIndex,
        growthRateFactor: branch.growthRateFactor,
        mature: branch.mature,
        isApex: branch.isApex,
        stemAttachPosition: branch.stemAttachPosition ?? undefined
      })
    }
    return {
      branches,
      mainStemId: this.mainStemId,
      nextId: this.nextId,
      growthTimer: this._growthTimer,
      nextNodeAt: this._nextNodeAt,
      apexBranchIds: [...this._apexBranchIds]
    }
  }

  private static _inferTargetLength(bs: BranchSnapshot, dna: DNA, branchType: BranchType): number {
    if (bs.targetLength > 0) return bs.targetLength
    const stemMax = dna.maxHeight * STEM_HEIGHT_FACTOR
    if (branchType === 'main') return stemMax
    if (branchType === 'lateral') return Math.max(bs.length, stemMax * BRANCH_LENGTH_RATIO)
    return Math.max(bs.length, stemMax * TWIG_LENGTH_RATIO)
  }

  static fromSnapshot(data: ArchitectureSnapshot, dna: DNA): PlantArchitecture {
    const arch = new PlantArchitecture(dna)
    arch.branches.clear()
    arch.nextId = data.nextId
    arch.mainStemId = data.mainStemId
    arch._dna = dna
    arch._growthTimer = data.growthTimer || 0
    arch._nextNodeAt = data.nextNodeAt ?? arch._internodeLength() * 0.55
    const laterals = data.branches.filter(b => b.type === 'lateral' && !b.isApex)
    arch._whorlCount = laterals.length > 0
      ? Math.max(...laterals.map(b => b.whorlIndex ?? 0)) + 1
      : 0
    arch._apexBranchIds = data.apexBranchIds
      ?? data.branches.filter(b => b.isApex).map(b => b.id)

    for (const bs of data.branches) {
      const rawType = (bs as { type?: string }).type || 'main'
      const branchType: BranchType = rawType === 'sublateral' ? 'twig' : rawType as BranchType
      const branch = new Branch(
        bs.id, bs.parentBranchId, bs.parentNodeIndex,
        bs.baseAngle, bs.azimuth,
        branchType
      )
      branch.age = bs.age
      branch.length = bs.length
      branch.targetLength = PlantArchitecture._inferTargetLength(bs, dna, branchType)
      branch.whorlIndex = bs.whorlIndex ?? 0
      branch.growthRateFactor = bs.growthRateFactor ?? 1
      branch.active = bs.active
      branch.mature = bs.mature ?? (bs.length >= branch.targetLength * 0.99)
      branch.isApex = bs.isApex ?? false
      branch.stemAttachPosition = bs.stemAttachPosition ?? null
      branch.nodes = bs.nodes.map(ns => {
        const leafAngles = ns.leaves.map(l => l.angle)
        const leafScales = ns.leaves.map(l => l.scale)
        const node = new BranchNode(ns.index, ns.position, leafAngles, leafScales)
        node.age = ns.age
        node.hasLateral = ns.hasLateral
        node.lateralBranchId = ns.lateralBranchId
        node.hasFlower = ns.hasFlower ?? false
        node.hasFruit = ns.hasFruit ?? false
        for (let i = 0; i < Math.min(ns.leaves.length, node.leaves.length); i++) {
          node.leaves[i].age = ns.leaves[i].age
          node.leaves[i].size = ns.leaves[i].size
          if ('dead' in ns.leaves[i]) node.leaves[i].dead = ns.leaves[i].dead
        }
        return node
      })
      arch.branches.set(bs.id, branch)
    }
    return arch
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
