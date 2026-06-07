import {
  drawSky, drawStars, drawSun, drawClouds,
  drawPot, drawSoil, drawGround, drawShadow, drawSnow,
  drawStem, drawBranches, drawLeaves, drawFlowers, drawFruits,
  drawArchitectureLeaves, drawArchitectureReproduction
} from './drawing'
import type { ArchitectureRenderNode } from './drawing'
import { colorFromRGB, clamp, lerp, smoothstep } from './math'
import { ParticleSystem } from './particles'
import { drawFauna } from './fauna'
import { drawLightingOverlay, drawLightningBolt, generateLightningBolt } from './lighting'
import type { LightningBolt } from './lighting'
import type { FaunaEntity } from '@vida/ecosystem-engine'
import type { ArchitectureSnapshot, LeafDropEvent } from '@vida/simulation-engine'

export type EngineState = {
  flowerCount: number
  fruitCount: number
  health: number
  vitality: number
  sunlight: number
  wind: number
  rain: number
  rainProbability: number
  cloudCover: number
  hour: number
  season: string
  humidity: number
  day: number
}

export type DNAColors = {
  stem: [number, number, number]
  leaf: [number, number, number]
  flower: [number, number, number]
  fruit: [number, number, number]
}

export type PlantVisualTraits = {
  leafSize: number
}

interface BranchRenderData {
  id: number
  baseX: number
  baseY: number
  tipX: number
  tipY: number
  length: number
  parentBranchId: number | null
  mature: boolean
  isApex: boolean
  nodes: ArchitectureRenderNode[]
}

function branchDirection(baseAngle: number, azimuth: number): { dx: number; dy: number } {
  const dx = Math.cos(baseAngle) * Math.cos(azimuth)
  const dy = -Math.sin(baseAngle)
  const mag = Math.hypot(dx, dy) || 1
  return { dx: dx / mag, dy: dy / mag }
}

function pointOnSegment(
  bx: number, by: number, tx: number, ty: number, dist: number, totalLen: number
): { x: number; y: number } {
  const t = totalLen > 0 ? clamp(dist / totalLen, 0, 1) : 0
  return { x: bx + (tx - bx) * t, y: by + (ty - by) * t }
}

function darken(color: number, factor: number): number {
  const r = ((color >> 16) & 0xff) / 255
  const g = ((color >> 8) & 0xff) / 255
  const b = (color & 0xff) / 255
  const f = 1 - factor
  const nr = Math.max(0, Math.min(255, Math.round(r * f * 255)))
  const ng = Math.max(0, Math.min(255, Math.round(g * f * 255)))
  const nb = Math.max(0, Math.min(255, Math.round(b * f * 255)))
  return (nr << 16) | (ng << 8) | nb
}

function colorToCSS(color: number, alpha: number = 1): string {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  if (alpha >= 1) return `rgb(${r},${g},${b})`
  return `rgba(${r},${g},${b},${alpha})`
}

export class Canvas2DRenderer {
  private ctx: CanvasRenderingContext2D
  private w = 400
  private h = 400
  private swayTime = 0
  private particles: ParticleSystem
  private lastFauna: FaunaEntity[] = []
  private lightningTimer = 0
  private lightningIntensity = 0
  private lightningBolt: LightningBolt | null = null

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = this.w
    canvas.height = this.h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    this.ctx = ctx
    this.particles = new ParticleSystem()
  }

  setFauna(fauna: FaunaEntity[]): void {
    this.lastFauna = fauna
  }

  update(
    state: EngineState,
    dnaColors: DNAColors,
    deltaMs: number,
    architecture?: ArchitectureSnapshot,
    visualTraits?: PlantVisualTraits,
    leafDrops: LeafDropEvent[] = []
  ): void {
    this.swayTime += deltaMs / 1000
    const deltaS = deltaMs / 1000

    const windFactor = clamp(state.wind / 33.33, 0, 1)

    const stemColor = colorFromRGB(dnaColors.stem[0], dnaColors.stem[1], dnaColors.stem[2])
    const leafColor = colorFromRGB(dnaColors.leaf[0], dnaColors.leaf[1], dnaColors.leaf[2])
    const flowerColor = colorFromRGB(dnaColors.flower[0], dnaColors.flower[1], dnaColors.flower[2])
    const fruitColor = colorFromRGB(dnaColors.fruit[0], dnaColors.fruit[1], dnaColors.fruit[2])

    const stemColorCSS = colorToCSS(stemColor)
    const leafColorNum = leafColor

    const dayStart = state.season === 'summer' ? 5 : state.season === 'winter' ? 7 : 6
    const dayEnd = state.season === 'summer' ? 21 : state.season === 'winter' ? 17 : 20

    const twiExt = 1.0
    const sunProgress = (state.hour - (dayStart - twiExt)) / ((dayEnd + twiExt) - (dayStart - twiExt))
    const sunAngle = Math.PI * Math.max(0, Math.min(1, sunProgress))

    const twiWidth = 1.0
    const dayWeight = smoothstep(dayStart - twiWidth, dayStart, state.hour)
                   * (1 - smoothstep(dayEnd, dayEnd + twiWidth, state.hour))
    const dayProgress = clamp((state.hour - dayStart) / (dayEnd - dayStart), 0, 1)
    const shadeAngle = Math.PI * 0.1 + dayProgress * Math.PI * 0.8
    const nightAngle = Math.PI * 0.1
    const shadingAngle = lerp(nightAngle, shadeAngle, dayWeight)

    // Lightning
    if (this.lightningTimer > 0) {
      this.lightningTimer--
      this.lightningIntensity *= 0.7
    } else {
      this.lightningIntensity = 0
      this.lightningBolt = null
    }
    const isStormBuilding = state.rain >= 20 && state.rain < 55 && state.rainProbability > 75
    const isStormActive = state.rain >= 55

    if ((isStormBuilding || isStormActive) && Math.random() < 0.003) {
      const baseIntensity = 0.3 + Math.random() * 0.4
      const bonusIntensity = state.rainProbability > 90 ? 0.2 : 0
      this.lightningIntensity = Math.min(1, baseIntensity + bonusIntensity)
      this.lightningTimer = 5 + Math.floor(Math.random() * 10)
      this.lightningBolt = generateLightningBolt(this.w, this.h)
    }

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)

    drawSky(ctx, state.sunlight, state.hour, state.season, state.rain, state.humidity, state.cloudCover, state.rainProbability, this.w, this.h)
    drawStars(ctx, state.sunlight, state.rain, state.cloudCover, state.rainProbability, state.hour, state.season, this.w, this.h)
    drawSun(ctx, sunAngle, state.sunlight, state.season, state.rain, state.hour)
    drawClouds(ctx, state.sunlight, state.season, state.rain, state.cloudCover, state.rainProbability, this.swayTime, windFactor, this.w, this.h)
    if (this.lightningBolt && this.lightningIntensity > 0.05) {
      drawLightningBolt(ctx, this.lightningBolt, this.lightningIntensity)
    }
    drawGround(ctx, state.season, this.w, this.h, state.day)

    const potCX = 200
    const potY = 359
    const baseY = potY - 2

    if (architecture && architecture.branches.length > 0) {
      const heightScale = 1.8
      const branches = buildBranches(architecture, potCX, baseY, heightScale, this.swayTime, windFactor * 2)
      const visualHeight = Math.max(20, (architecture.branches.find(b => b.parentBranchId === null)?.length ?? 100) * heightScale)

      if (leafDrops.length > 0) {
        const sites: { x: number; y: number }[] = []
        for (const drop of leafDrops) {
          const branch = branches.find(b => b.id === drop.branchId)
          const node = branch?.nodes.find(n => n.nodeIndex === drop.nodeIndex)
          if (node) sites.push({ x: node.x, y: node.y })
        }
        if (sites.length > 0) {
          this.particles.spawnLeafDrops(sites, state.wind, state.season)
        }
      }

      drawShadow(ctx, sunAngle, visualHeight, potCX, potY + 6)

      // Draw branch stems
      for (const branch of branches) {
        const isMain = branch.parentBranchId === null
        const bottomR = isMain ? 5 : 2.5
        const topR = isMain ? 2 : 1
        const segments = Math.max(2, Math.floor(branch.length / 6))

        for (let s = 0; s < segments; s++) {
          const t0 = s / segments
          const t1 = (s + 1) / segments
          const r0 = bottomR + (topR - bottomR) * t0
          const r1 = bottomR + (topR - bottomR) * t1
          const bx = branch.baseX + (branch.tipX - branch.baseX) * t0
          const by = branch.baseY + (branch.tipY - branch.baseY) * t0
          const ex = branch.baseX + (branch.tipX - branch.baseX) * t1
          const ey = branch.baseY + (branch.tipY - branch.baseY) * t1

          ctx.fillStyle = stemColorCSS
          ctx.beginPath()
          ctx.moveTo(bx - r0, by)
          ctx.quadraticCurveTo((bx - r0 + ex - r1) / 2, (by + ey) / 2, ex - r1, ey)
          ctx.lineTo(ex + r1, ey)
          ctx.quadraticCurveTo((bx + r0 + ex + r1) / 2, (by + ey) / 2, bx + r0, by)
          ctx.closePath()
          ctx.fill()
        }
      }

      // Draw leaves at node positions
      const allNodes: ArchitectureRenderNode[] = []
      for (const branch of branches) {
        allNodes.push(...branch.nodes)
      }
      drawArchitectureLeaves(
        ctx, allNodes, leafColorNum, stemColor,
        windFactor * 2, this.swayTime, state.season, shadingAngle,
        visualTraits?.leafSize ?? 1.0
      )
      drawArchitectureReproduction(ctx, allNodes, flowerColor, fruitColor, windFactor * 2, this.swayTime, shadingAngle, state.season)
    } else {
      drawShadow(ctx, sunAngle, 100, potCX, potY + 6)

      // Fallback: use current params with defaults
      const fallbackParams = {
        stemHeight: 100,
        stemRadius: 6,
        branchCount: 0,
        leafCount: 0,
        flowerCount: state.flowerCount,
        fruitCount: state.fruitCount,
        stemColor,
        leafColor,
        flowerColor,
        fruitColor,
        branchAngle: 35,
        leafSize: 0.8,
        swayAmount: windFactor * 2,
        swayTime: this.swayTime,
        sunAngle: shadingAngle
      }
      drawStem(ctx, fallbackParams, potCX, potY, shadingAngle, state.season)
      drawBranches(ctx, fallbackParams, potCX, potY, shadingAngle, state.season)
      drawLeaves(ctx, fallbackParams, potCX, potY, shadingAngle, state.season)
      drawFlowers(ctx, fallbackParams, potCX, potY, shadingAngle, state.season)
      drawFruits(ctx, fallbackParams, potCX, potY, shadingAngle)
    }

    drawPot(ctx, shadingAngle, potCX, potY)
    drawSoil(ctx, potCX, potY, shadingAngle, state.season)

    if (state.season === 'winter' && state.rain > 12) {
      drawSnow(ctx, potCX, potY, shadingAngle)
    }

    drawFauna(ctx, this.lastFauna, potCX, potY, this.swayTime)

    this.particles.update(deltaS, state.sunlight, state.rain, state.flowerCount > 0, state.health, state.wind, state.season, this.swayTime, this.w, this.h, ctx)

    drawLightingOverlay(ctx, state.sunlight, state.hour, this.w, this.h, this.lightningIntensity)
  }

  destroy(): void {
    this.particles.clear()
  }
}

function buildBranches(
  snapshot: ArchitectureSnapshot,
  baseX: number, baseY: number,
  heightScale: number,
  swayTime: number, swayAmount: number
): BranchRenderData[] {
  const byId = new Map<number, BranchRenderData>()
  const sorted = [...snapshot.branches].sort((a, b) => {
    if (a.parentBranchId === null) return -1
    if (b.parentBranchId === null) return 1
    return a.id - b.id
  })

  for (const bs of sorted) {
    let branchBaseX = baseX
    let branchBaseY = baseY
    const isMain = bs.parentBranchId === null
    const allowSway = isMain || bs.isApex || !bs.mature

    if (bs.parentBranchId !== null) {
      const parentBs = snapshot.branches.find(b => b.id === bs.parentBranchId)
      const parentRender = byId.get(bs.parentBranchId)

      if (parentBs && parentRender) {
        if (parentBs.parentBranchId === null) {
          if (bs.stemAttachPosition != null) {
            const stemSway = allowSway
              ? Math.sin(swayTime * 2 + bs.id * 1.1) * swayAmount * 0.15
              : 0
            branchBaseX = baseX + stemSway
            branchBaseY = baseY - bs.stemAttachPosition * heightScale
          } else if (bs.parentNodeIndex !== null) {
            const stemNode = parentBs.nodes[bs.parentNodeIndex]
            if (stemNode) {
              branchBaseX = baseX
              branchBaseY = baseY - stemNode.position * heightScale
            }
          }
        } else if (bs.parentNodeIndex !== null) {
          const parentNode = parentBs.nodes[bs.parentNodeIndex]
          if (parentNode) {
            const pt = pointOnSegment(
              parentRender.baseX, parentRender.baseY,
              parentRender.tipX, parentRender.tipY,
              parentNode.position, parentBs.length
            )
            branchBaseX = pt.x
            branchBaseY = pt.y
          }
        }
      }
    }

    const length = Math.min(bs.length * heightScale, 200)
    const tipSway = allowSway ? Math.sin(swayTime * 2 + bs.id * 1.5) * swayAmount * 0.3 : 0

    let tipX: number
    let tipY: number

    if (isMain) {
      tipX = baseX + tipSway
      tipY = baseY - length
    } else {
      const dir = branchDirection(bs.baseAngle, bs.azimuth)
      tipX = branchBaseX + dir.dx * length + tipSway
      tipY = branchBaseY + dir.dy * length
    }

    const nodes: ArchitectureRenderNode[] = []
    const nodeAllowSway = allowSway

    if (isMain) {
      for (const ns of bs.nodes) {
        const sway = Math.sin(swayTime * 2 + ns.index * 1.1 + bs.id) * swayAmount * 0.15
        const nx = baseX + sway
        const ny = baseY - ns.position * heightScale
        nodes.push({
          x: nx, y: ny, leafSize: 0, leafAngle: 0,
          hasFlower: ns.hasFlower ?? false, hasFruit: ns.hasFruit ?? false,
          allowSway: true, nodeIndex: ns.index
        })
      }
    } else {
      const dir = branchDirection(bs.baseAngle, bs.azimuth)
      for (const ns of bs.nodes) {
        const t = bs.length > 0 ? ns.position / bs.length : 0
        const sway = nodeAllowSway
          ? Math.sin(swayTime * 2 + t * 3 + bs.id * 1.5) * swayAmount * 0.35 * Math.min(1, t * 2)
          : 0
        const dist = ns.position * heightScale
        const nx = branchBaseX + dir.dx * dist + sway
        const ny = branchBaseY + dir.dy * dist
        const hasFlower = ns.hasFlower ?? false
        const hasFruit = ns.hasFruit ?? false

        if (!ns.leaves || ns.leaves.length === 0) {
          if (hasFlower || hasFruit) {
            nodes.push({
              x: nx, y: ny, leafSize: 0.5, leafAngle: 0,
              hasFlower, hasFruit, allowSway: nodeAllowSway, nodeIndex: ns.index
            })
          } else {
            nodes.push({
              x: nx, y: ny, leafSize: 0, leafAngle: 0,
              hasFlower: false, hasFruit: false, allowSway: nodeAllowSway, nodeIndex: ns.index
            })
          }
          continue
        }

        let firstLeaf = true
        for (const leaf of ns.leaves) {
          if (leaf.dead) continue
          nodes.push({
            x: nx,
            y: ny,
            leafSize: leaf.size * leaf.scale,
            leafAngle: leaf.angle,
            hasFlower: firstLeaf && hasFlower,
            hasFruit: firstLeaf && hasFruit,
            allowSway: nodeAllowSway,
            nodeIndex: ns.index
          })
          firstLeaf = false
        }
      }
    }

    const renderData: BranchRenderData = {
      id: bs.id,
      baseX: branchBaseX,
      baseY: branchBaseY,
      tipX,
      tipY,
      length,
      parentBranchId: bs.parentBranchId,
      mature: bs.mature ?? false,
      isApex: bs.isApex ?? false,
      nodes
    }
    byId.set(bs.id, renderData)
  }

  return sorted.map(bs => byId.get(bs.id)!)
}
