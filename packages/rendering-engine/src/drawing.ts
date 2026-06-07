import { colorFromRGB, darken, lighten, lerp, lerpColor, colorToCSS, clamp } from './math'

export interface DrawParams {
  stemHeight: number
  stemRadius: number
  branchCount: number
  leafCount: number
  flowerCount: number
  fruitCount: number
  stemColor: number
  leafColor: number
  flowerColor: number
  fruitColor: number
  branchAngle: number
  leafSize: number
  swayAmount: number
  swayTime: number
  sunAngle: number
}

export interface ArchitectureRenderNode {
  x: number
  y: number
  leafSize: number
  leafAngle: number
  hasFlower: boolean
  hasFruit: boolean
  allowSway?: boolean
  nodeIndex?: number
}

const CX = 200

function getDayBounds(season: string): { dayStart: number; dayEnd: number } {
  switch (season) {
    case 'summer': return { dayStart: 5, dayEnd: 21 }
    case 'winter': return { dayStart: 7, dayEnd: 17 }
    default: return { dayStart: 6, dayEnd: 20 }
  }
}

/** Blends hour-based twilight with sunlight so dawn/dusk stay visually coherent */
function daylightBlend(hour: number, season: string, sunlight: number): number {
  const { dayStart, dayEnd } = getDayBounds(season)
  const twilight = 1.25
  const hourFactor = smoothstep(dayStart - twilight, dayStart + 1.75, hour)
    * (1 - smoothstep(dayEnd - 0.75, dayEnd + twilight, hour))
  const lightFactor = smoothstep(0, 40, sunlight)
  return clamp(hourFactor * 0.55 + lightFactor * 0.45, 0, 1)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Storm intensity: active rain or clouds building with high rain probability */
function stormBuildup(rain: number, cloudCover: number, rainProbability: number): number {
  const rainFactor = clamp(rain / 50, 0, 1)
  const stormIntent = smoothstep(25, 60, rainProbability)
  const cloudStorm = clamp((cloudCover - 35) / 60, 0, 1) * stormIntent
  return Math.max(rainFactor, cloudStorm)
}

const BASE_CLOUD_COUNT = 2

function lerpArray(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t)
}

export function drawSky(ctx: CanvasRenderingContext2D, sunlight: number, hour: number, season: string, rain: number, humidity: number, cloudCover: number, rainProbability: number, w: number, h: number): void {
  const ds = season === 'summer' ? 5 : season === 'winter' ? 7 : 6
  const de = season === 'summer' ? 21 : season === 'winter' ? 17 : 20

  type SkyPalette = [number, number, number, number, number, number, number, number, number]
  const palettes: Record<string, SkyPalette> = {
    night:     [0.02, 0.02, 0.08,  0.03, 0.03, 0.10,  0.04, 0.04, 0.12],
    dawn:      [0.10, 0.08, 0.25,  0.35, 0.15, 0.30,  0.50, 0.35, 0.15],
    morning:   [0.28, 0.52, 0.82,  0.42, 0.62, 0.84,  0.58, 0.73, 0.88],
    noon:      [0.38, 0.60, 0.93,  0.44, 0.68, 0.90,  0.64, 0.78, 0.96],
    afternoon: [0.32, 0.55, 0.88,  0.46, 0.66, 0.86,  0.68, 0.74, 0.88],
    sunset:    [0.08, 0.10, 0.30,  0.50, 0.20, 0.35,  0.80, 0.45, 0.10],
    dusk:      [0.03, 0.03, 0.15,  0.10, 0.06, 0.20,  0.20, 0.12, 0.15],
  }

  interface PeriodDef { name: string; start: number; peakStart: number; peakEnd: number; end: number }
  const periods: PeriodDef[] = [
    { name: 'dawn',      start: ds - 0.75, peakStart: ds - 0.125, peakEnd: ds + 0.5,     end: ds + 1.5 },
    { name: 'morning',   start: ds + 0.25, peakStart: ds + 1.25,  peakEnd: ds + 2.5,     end: ds + 3.5 },
    { name: 'noon',      start: ds + 2.5,  peakStart: ds + 5,     peakEnd: de - 5,       end: de - 2.5 },
    { name: 'afternoon', start: de - 3.5,  peakStart: de - 2.5,   peakEnd: de - 1.25,    end: de - 0.25 },
    { name: 'sunset',    start: de - 1.0,  peakStart: de - 0.5,   peakEnd: de + 0.25,    end: de + 0.75 },
    { name: 'dusk',      start: de + 0.25, peakStart: de + 0.75,  peakEnd: de + 1.25,    end: de + 1.5 },
  ]

  function periodWeight(p: PeriodDef, h: number): number {
    if (h <= p.start || h >= p.end) return 0
    if (h <= p.peakStart) return smoothstep(p.start, p.peakStart, h)
    if (h <= p.peakEnd) return 1
    return 1 - smoothstep(p.peakEnd, p.end, h)
  }

  let isInAnyPeriod = false
  let mixed: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  let totalWeight = 0
  for (const p of periods) {
    const w = periodWeight(p, hour)
    if (w > 0) {
      isInAnyPeriod = true
      const c = palettes[p.name]
      for (let i = 0; i < 9; i++) mixed[i] += c[i] * w
      totalWeight += w
    }
  }

  let colors: number[]
  if (!isInAnyPeriod) {
    colors = palettes.night
  } else {
    for (let i = 0; i < 9; i++) mixed[i] /= totalWeight
    const nightBlend = Math.max(0, 1 - totalWeight / 0.5)
      * (1 - daylightBlend(hour, season, sunlight)) * 0.65
    for (let i = 0; i < 9; i++) {
      mixed[i] = lerp(mixed[i], palettes.night[i], nightBlend)
    }
    colors = mixed
  }

  // Weather modifier
  const isWinter = season === 'winter'
  const dayFactor = sunlight / 100
  let sat = 1
  let bright = 1
  let colorShift: [number, number, number] = [0, 0, 0]

  // Brightness tied to simulated sunlight; dawn capped until light catches up
  if (hour > ds - 0.5 && hour < de + 1) {
    sat = lerp(0.55, 1, smoothstep(0, 0.55, dayFactor))
    bright = lerp(0.68, 1.12, smoothstep(0, 100, sunlight))
    if (hour < ds + 2.5) {
      const dawnCap = lerp(0.74, 1.05, smoothstep(0, 55, sunlight))
      bright = Math.min(bright, dawnCap)
    }
  }

  // Sky grays only during active rain or approaching storm
  const storm = stormBuildup(rain, cloudCover, rainProbability)
  const rainFade = Math.max(smoothstep(0, 40, rain), storm * 0.85)
  if (rainFade > 0) {
    const rSat = isWinter ? 0.4 : 0.35
    const rBright = isWinter ? 1.3 : 0.85
    const rShift: [number, number, number] = isWinter
      ? [0.2, 0.2, 0.25]
      : [0.05, 0.05, 0.1]
    sat = lerp(sat, rSat, rainFade)
    bright = lerp(bright, rBright, rainFade)
    colorShift[0] = rShift[0] * rainFade
    colorShift[1] = rShift[1] * rainFade
    colorShift[2] = rShift[2] * rainFade
  }

  // Dawn + humidity > 70 → fog
  const isDawn = hour >= ds - 0.75 && hour <= ds + 1.5
  if (isDawn && humidity > 70) {
    const fog = Math.min(1, (humidity - 70) / 30) * 0.6
    sat *= (1 - fog)
    bright *= (1 + fog * 0.04)
    const fogShift = fog * 0.12
    colorShift[0] += fogShift
    colorShift[1] += fogShift
    colorShift[2] += fogShift * 1.3
  }

  // Apply weather to colors (copy to avoid mutation during iteration)
  const result = [...colors]
  for (let i = 0; i < 9; i++) {
    const groupStart = Math.floor(i / 3) * 3
    const grayVal = (colors[groupStart] + colors[groupStart + 1] + colors[groupStart + 2]) / 3
    let c = grayVal + (colors[i] - grayVal) * sat
    c *= bright
    c += colorShift[i % 3]
    result[i] = Math.max(0, Math.min(1, c))
  }
  colors = result

  const [tr, tg, tb, mr, mg, mb, br, bg, bb] = colors
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, colorToCSS(colorFromRGB(tr, tg, tb)))
  g.addColorStop(0.5, colorToCSS(colorFromRGB(mr, mg, mb)))
  g.addColorStop(1, colorToCSS(colorFromRGB(br, bg, bb)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

let _starCache: { x: number; y: number; bright: number; r: number }[] | null = null

export function drawStars(ctx: CanvasRenderingContext2D, sunlight: number, rain: number, cloudCover: number, rainProbability: number, hour: number, season: string, w: number, h: number): void {
  if (!_starCache) {
    _starCache = []
    for (let i = 0; i < 40; i++) {
      _starCache.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.6,
        bright: 0.3 + Math.random() * 0.6,
        r: 0.7 + Math.random() * 1.2
      })
    }
  }
  const dayFade = daylightBlend(hour, season, sunlight)
  const storm = stormBuildup(rain, cloudCover, rainProbability)
  const rainFade = Math.max(smoothstep(5, 45, rain), storm * 0.7)
  const fade = clamp(Math.max(dayFade, rainFade), 0, 1)
  if (fade >= 1) return
  const count = Math.floor(Math.max(0, (1 - fade)) * _starCache.length)
  for (let i = 0; i < count; i++) {
    const s = _starCache[i]
    ctx.fillStyle = `rgba(255,255,255,${s.bright * (1 - fade)})`
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

interface CloudPuff { px: number; py: number; r: number }
interface CloudEntity {
  x: number
  y: number
  puffs: CloudPuff[]
  opacity: number
  targetOpacity: number
  vx: number
  vy: number
  size: number
  seed: number
  isPaused: boolean
  pauseTimer: number
  pauseDuration: number
}

let _clouds: CloudEntity[] = []
let _lastCloudCount = 0
let _lastRain = -1
let _lastCloudCover = -1
let _lastRainProbability = -1
let _lastSunlight = -1

function _spawnCloud(w: number, seed: number, startOpacity: number, sizeScale = 1): CloudEntity {
  const cx = Math.sin(seed * 7.3 + 1.1) * w * 0.35 + w * 0.5
  const cy = 25 + (Math.sin(seed * 3.7 + seed * 0.5) * 0.5 + 0.5) * 140
  const baseR = (18 + Math.sin(seed * 2.3) * 6) * sizeScale
  const puffCount = 6 + Math.floor(Math.sin(seed * 3.7) * 1.5 + 1.5)
  const puffs: CloudPuff[] = []
  for (let p = 0; p < puffCount; p++) {
    const t = (p / (puffCount - 1)) * 2 - 1
    const dome = 1 - t * t
    const r = (baseR + Math.sin(p * 2.3 + seed * 1.1) * 6) * (0.65 + dome * 0.5 + Math.sin(p * 3.7 + seed * 0.7) * 0.12)
    const px = t * baseR * 2.2 + Math.sin(p * 1.7 + seed * 2.3) * 4
    const py = -dome * baseR * 0.5 - Math.sin(p * 3.1 + seed * 0.9) * baseR * 0.2 + (1 - Math.abs(t)) * baseR * 0.1 * Math.sin(p * 2.1 + seed)
    puffs.push({ px, py, r })
  }
  return {
    x: cx,
    y: cy,
    puffs,
    opacity: startOpacity,
    targetOpacity: 1,
    vx: (Math.sin(seed * 5.1) * 0.5 + 0.5) * 0.3 + 0.1,
    vy: (Math.sin(seed * 4.3 + 2) * 0.5 + 0.5) * 0.08,
    size: 1,
    seed,
    isPaused: true,
    pauseTimer: 60 + Math.random() * 60,
    pauseDuration: 60 + Math.random() * 120
  }
}

export function drawClouds(ctx: CanvasRenderingContext2D, sunlight: number, season: string, rain: number, cloudCover: number, rainProbability: number, swayTime: number, windFactor: number, w: number, h: number): void {
  const storm = stormBuildup(rain, cloudCover, rainProbability)
  const targetCount = storm > 0.08
    ? Math.round(lerp(BASE_CLOUD_COUNT, 8, storm))
    : BASE_CLOUD_COUNT

  const bright = lerp(0.88, 0.30, storm)
  const alpha = lerp(0.58, 0.85, storm)

  const sr = season === 'summer' ? 0.05 : season === 'winter' ? -0.12 : 0
  const shadowColor = colorToCSS(colorFromRGB(bright * 0.5 + sr, bright * 0.5 + sr, bright * 0.55 + sr), alpha * 0.15)
  const cloudColor = colorToCSS(colorFromRGB(bright + sr, bright + sr, bright + 0.05 + sr), alpha)

  const hasChanged = Math.abs(targetCount - _lastCloudCount) > 0.5
    || Math.abs(rain - _lastRain) > 5
    || Math.abs(cloudCover - _lastCloudCover) > 8
    || Math.abs(rainProbability - _lastRainProbability) > 10
  _lastCloudCount = targetCount
  _lastRain = rain
  _lastCloudCover = cloudCover
  _lastRainProbability = rainProbability
  _lastSunlight = sunlight

  const sizeScale = 0.85 + storm * 0.45
  if (_clouds.length < targetCount) {
    while (_clouds.length < targetCount) {
      const seed = _clouds.length + Math.random() * 100
      _clouds.push(_spawnCloud(w, seed, 0, sizeScale))
    }
  } else if (hasChanged && _clouds.length > targetCount) {
    for (let i = 0; i < _clouds.length; i++) {
      _clouds[i].targetOpacity = i < targetCount ? 1 : 0
    }
  }

  const hDrift = Math.sin(swayTime * 0.025) * (20 + windFactor * 20)

  for (const cloud of _clouds) {
    cloud.opacity += (cloud.targetOpacity - cloud.opacity) * 0.03

    if (cloud.isPaused) {
      cloud.x += cloud.vx * 0.15
      cloud.pauseTimer--
      if (cloud.pauseTimer <= 0) {
        cloud.isPaused = false
      }
    } else {
      cloud.x += cloud.vx * (1 + windFactor * 0.5)
      cloud.y += cloud.vy
      cloud.pauseTimer--
      if (cloud.pauseTimer <= 0 && cloud.targetOpacity === 1) {
        if (Math.random() < 0.02 * (1 - windFactor)) {
          cloud.isPaused = true
          cloud.pauseTimer = cloud.pauseDuration
        }
      }
    }

    if (cloud.x > w + 80) {
      cloud.x = -80
      cloud.y = 25 + (Math.sin(cloud.seed * 3.7 + cloud.seed * 0.5) * 0.5 + 0.5) * 140
    }
    if (cloud.x < -80) {
      cloud.x = w + 80
    }

    if (cloud.opacity < 0.01) continue

    const bx = cloud.x + hDrift
    const by = cloud.y + Math.cos(swayTime * 0.018 + cloud.seed) * 5

    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = cloud.opacity
      ctx.fillStyle = pass === 0 ? shadowColor : cloudColor
      for (const puff of cloud.puffs) {
        const sy = pass === 0 ? 3 : 0
        const sx = pass === 0 ? 2 : 0
        ctx.beginPath()
        ctx.ellipse(bx + puff.px + sx, by + puff.py + sy, puff.r, puff.r * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  _clouds = _clouds.filter(c => !(c.opacity < 0.01 && c.targetOpacity === 0))
}

export function drawSun(ctx: CanvasRenderingContext2D, sunAngle: number, sunlight: number, season: string, rain: number, hour: number): void {
  const elev = Math.sin(sunAngle)
  const elevVis = smoothstep(-0.02, 0.18, elev)
  const lightVis = smoothstep(0, 18, sunlight)
  const hourVis = daylightBlend(hour, season, sunlight)
  const sunVisibility = clamp(elevVis * 0.5 + Math.min(lightVis, hourVis) * 0.5, 0, 1)
  if (sunVisibility <= 0.001) return
  const seasonElev = season === 'summer' ? 1 : season === 'winter' ? 0.55 : 0.75
  const arcHeight = 160
  const horizonY = 280

  const sx = CX + Math.cos(sunAngle) * 180
  const sy = horizonY - elev * arcHeight * seasonElev

  const diskThreshold = 0.08
  const diskAlpha = elev < diskThreshold ? smoothstep(-0.05, diskThreshold, elev) * 0.35 : Math.min(1, (elev - diskThreshold) / 0.12)
  const lowSunDim = elev < 0.3 ? lerp(0.4, 1, smoothstep(0.04, 0.3, elev)) : 1
  const lightDim = smoothstep(0, 55, sunlight)
  const glowScale = lowSunDim * lerp(0.45, 1, lightDim)
  const glowAlpha = Math.min(1, elev * 0.65 + 0.05) * Math.min(1, sunlight / 40) * sunVisibility * glowScale

  const rainFade = smoothstep(5, 25, rain)
  const finalDiskAlpha = diskAlpha * (1 - rainFade) * sunVisibility
  const finalGlowAlpha = glowAlpha * (1 - rainFade * 0.85)

  if (finalGlowAlpha <= 0.01 && finalDiskAlpha <= 0) return

  const colorBlend = Math.min(1, elev / 0.6)
  const r = 1
  const g = 0.5 + colorBlend * 0.45
  const b = 0.1 + colorBlend * 0.7

  const r16 = r * 255
  const g16 = g * 255
  const b16 = b * 255
  const rDisk = 14 + (1 - diskAlpha) * 4

  // 1. Corona — large outer atmosphere glow (grows with elevation)
  const coronaR = rDisk * (3 + elev * 4) * lerp(0.75, 1, lightDim)
  const corona = ctx.createRadialGradient(sx, sy, 0, sx, sy, coronaR)
  corona.addColorStop(0, `rgba(255,255,240,${finalGlowAlpha * 0.08})`)
  corona.addColorStop(0.2, `rgba(${r16},${g16},${b16},${finalGlowAlpha * 0.05})`)
  corona.addColorStop(0.6, `rgba(${r16},${g16},${b16},${finalGlowAlpha * 0.02})`)
  corona.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = corona
  ctx.beginPath()
  ctx.arc(sx, sy, coronaR, 0, Math.PI * 2)
  ctx.fill()

  // 2. Inner halo ring — bright ring around the disk (grows with elevation)
  const haloR = rDisk * (1.5 + elev * 2)
  const halo = ctx.createRadialGradient(sx, sy, rDisk * 0.9, sx, sy, haloR)
  halo.addColorStop(0, `rgba(${r16},${g16},${b16},${finalGlowAlpha * 0.25})`)
  halo.addColorStop(0.5, `rgba(${r16},${g16},${b16},${finalGlowAlpha * 0.08})`)
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(sx, sy, haloR, 0, Math.PI * 2)
  ctx.fill()

  // 3. Main glow — soft radial halo (grows with elevation)
  const glowR = 15 + elev * 35
  const gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR)
  gg.addColorStop(0, `rgba(${r16},${g16},${b16},${finalGlowAlpha * 0.35})`)
  gg.addColorStop(0.4, `rgba(${r16},${g16},${b16},${finalGlowAlpha * 0.15})`)
  gg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gg
  ctx.beginPath()
  ctx.arc(sx, sy, glowR, 0, Math.PI * 2)
  ctx.fill()

  // 4. Solar disk
  if (finalDiskAlpha > 0) {
    ctx.fillStyle = `rgba(${r16},${g16},${b16},${finalDiskAlpha})`
    ctx.beginPath()
    ctx.arc(sx, sy, rDisk, 0, Math.PI * 2)
    ctx.fill()

    // 4a. Bright inner core — white hot center
    const coreR = rDisk * 0.4
    const coreGr = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR)
    coreGr.addColorStop(0, `rgba(255,255,255,${finalDiskAlpha * 0.9})`)
    coreGr.addColorStop(0.4, `rgba(255,255,240,${finalDiskAlpha * 0.5})`)
    coreGr.addColorStop(1, 'rgba(255,255,220,0)')
    ctx.fillStyle = coreGr
    ctx.beginPath()
    ctx.arc(sx, sy, coreR, 0, Math.PI * 2)
    ctx.fill()

    // 4b. Specular highlight — bright reflection spot upper-right
    const specR = rDisk * 0.18
    const specOffX = rDisk * 0.45
    const specOffY = -rDisk * 0.40
    const specGr = ctx.createRadialGradient(sx + specOffX, sy + specOffY, 0, sx + specOffX, sy + specOffY, specR)
    specGr.addColorStop(0, `rgba(255,255,255,${finalDiskAlpha * 0.85})`)
    specGr.addColorStop(0.5, `rgba(255,255,255,${finalDiskAlpha * 0.3})`)
    specGr.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = specGr
    ctx.beginPath()
    ctx.arc(sx + specOffX, sy + specOffY, specR, 0, Math.PI * 2)
    ctx.fill()

    // 4c. Rim highlight — arc on upper-right edge
    const rimR = rDisk * 0.15
    const rimOffX = rDisk * 0.55
    const rimOffY = -rDisk * 0.45
    const rimGr = ctx.createRadialGradient(sx + rimOffX, sy + rimOffY, 0, sx + rimOffX, sy + rimOffY, rimR)
    rimGr.addColorStop(0, `rgba(255,255,255,${finalDiskAlpha * 0.25})`)
    rimGr.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = rimGr
    ctx.beginPath()
    ctx.arc(sx + rimOffX, sy + rimOffY, rimR, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawPot(ctx: CanvasRenderingContext2D, sunAngle: number, potCX: number, potY: number): void {
  const pc = colorFromRGB(0.72, 0.39, 0.16)
  const rc = colorFromRGB(0.78, 0.44, 0.20)

  const profile = [
    { y: -20, r: 22 },
    { y: -4,  r: 28 },
    { y: 6,   r: 22 },
    { y: 8,   r: 28 },
    { y: 14,  r: 32 },
  ]

  const horiz = Math.abs(Math.cos(sunAngle))
  const shadeOffset = Math.cos(sunAngle) * 0.25 * horiz

  const pts = profile.map(p => ({ x: potCX + p.r, y: potY + p.y }))
  const ptsL = profile.map(p => ({ x: potCX - p.r, y: potY + p.y }))

  ctx.beginPath()
  ctx.moveTo(ptsL[0].x, ptsL[0].y)
  for (let i = 1; i < ptsL.length; i++) {
    const p0 = ptsL[i - 1]
    const p1 = ptsL[i]
    const cpx = (p0.x + p1.x) / 2
    ctx.quadraticCurveTo(p0.x + (p1.x - p0.x) * 0.3, (p0.y + p1.y) / 2, p1.x, p1.y)
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p0 = ptsL[ptsL.length - 1]
    const p1 = pts[i]
    if (i === pts.length - 1) {
      ctx.lineTo(p1.x, p1.y)
    } else {
      const p0 = pts[i + 1]
      const p1 = pts[i]
      ctx.quadraticCurveTo(p0.x + (p1.x - p0.x) * 0.3, (p0.y + p1.y) / 2, p1.x, p1.y)
    }
  }
  ctx.closePath()

  const pg = ctx.createLinearGradient(ptsL[0].x, 0, pts[0].x, 0)
  const darkShade = 0.08 + (1 - shadeOffset) * 0.15
  const lightShade = 0.08 + (1 + shadeOffset) * 0.15
  pg.addColorStop(0, colorToCSS(darken(pc, darkShade)))
  pg.addColorStop(0.5, colorToCSS(pc))
  pg.addColorStop(1, colorToCSS(darken(pc, lightShade)))
  ctx.fillStyle = pg
  ctx.fill()

  const rimProfile = profile.slice(3)
  if (rimProfile.length >= 2) {
    ctx.beginPath()
    const rpts = rimProfile.map(p => ({ x: potCX + p.r, y: potY + p.y }))
    const rptsL = rimProfile.map(p => ({ x: potCX - p.r, y: potY + p.y }))
    ctx.moveTo(rptsL[0].x, rptsL[0].y)
    ctx.quadraticCurveTo(
      (rptsL[0].x + rptsL[1].x) / 2, (rptsL[0].y + rptsL[1].y) / 2,
      rptsL[1].x, rptsL[1].y
    )
    ctx.quadraticCurveTo(
      (rpts[1].x + rpts[0].x) / 2, (rpts[1].y + rpts[0].y) / 2,
      rpts[0].x, rpts[0].y
    )
    ctx.closePath()
    const rg = ctx.createLinearGradient(rptsL[0].x, 0, rpts[0].x, 0)
    rg.addColorStop(0, colorToCSS(darken(rc, darkShade)))
    rg.addColorStop(0.5, colorToCSS(rc))
    rg.addColorStop(1, colorToCSS(darken(rc, lightShade)))
    ctx.fillStyle = rg
    ctx.fill()
  }
}

export function drawSoil(ctx: CanvasRenderingContext2D, potCX: number, potTopY: number, sunAngle: number, season = 'spring'): void {
  const soilY = potTopY + 6
  const baseColor = colorFromRGB(0.35, 0.22, 0.12)
  const horiz = Math.abs(Math.cos(sunAngle))
  const shadeOffset = Math.cos(sunAngle) * 0.2 * horiz

  const ringDefs = [
    { r: 22, yOff: 0 },
    { r: 14, yOff: 2 },
    { r: 7,  yOff: 3.5 },
  ]

  ctx.beginPath()
  ctx.moveTo(potCX - ringDefs[0].r, soilY)
  for (const ring of ringDefs) {
    ctx.lineTo(potCX - ring.r, soilY + ring.yOff)
  }
  ctx.quadraticCurveTo(potCX, soilY + 5.5, potCX + ringDefs[2].r, soilY + ringDefs[2].yOff)
  for (let i = ringDefs.length - 2; i >= 0; i--) {
    const ring = ringDefs[i]
    ctx.lineTo(potCX + ring.r, soilY + ring.yOff)
  }
  ctx.closePath()

  const sg = ctx.createLinearGradient(potCX - ringDefs[0].r, 0, potCX + ringDefs[0].r, 0)
  const darkShade = 0.12 + (1 - shadeOffset) * 0.08
  const lightShade = 0.08 + (1 + shadeOffset) * 0.08
  sg.addColorStop(0, colorToCSS(darken(baseColor, darkShade)))
  sg.addColorStop(0.5, colorToCSS(baseColor))
  sg.addColorStop(1, colorToCSS(darken(baseColor, lightShade)))
  ctx.fillStyle = sg
  ctx.fill()

  for (let i = 0; i < 12; i++) {
    const angle = i * 2.4 + 0.3
    const radius = 3 + (i % 6) * 3
    const bx = potCX + Math.cos(angle) * radius
    const by = soilY + 0.5 + (i % 4) * 0.8
    const pebbleVar = ((i * 50 + 13) % 100) / 1000
    ctx.fillStyle = colorToCSS(darken(baseColor, 0.14 + pebbleVar))
    ctx.beginPath()
    ctx.ellipse(bx, by, 2.5 + (i % 3) * 0.8, 1.2 + (i % 2) * 0.5, angle * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  for (let i = 0; i < 20; i++) {
    const bx = potCX + (Math.sin(i * 7.3 + 1.2) * 0.5) * 40
    const by = soilY + (Math.sin(i * 11.7 + 3.4) * 0.5 + 0.5) * 4
    const dotSize = 0.5 + (Math.sin(i * 5.1 + 2.8) * 0.5 + 0.5) * 0.8
    const dotAlpha = 0.1 + (Math.sin(i * 9.3 + 0.7) * 0.5 + 0.5) * 0.15
    ctx.fillStyle = `rgba(60,40,25,${dotAlpha})`
    ctx.beginPath()
    ctx.arc(bx, by, dotSize, 0, Math.PI * 2)
    ctx.fill()
  }

  if (season === 'winter') {
    const frost = ctx.createLinearGradient(potCX, soilY, potCX, soilY + 5)
    frost.addColorStop(0, 'rgba(235, 240, 248, 0.35)')
    frost.addColorStop(1, 'rgba(235, 240, 248, 0)')
    ctx.fillStyle = frost
    ctx.beginPath()
    ctx.moveTo(potCX - ringDefs[0].r, soilY)
    for (const ring of ringDefs) {
      ctx.lineTo(potCX - ring.r, soilY + ring.yOff)
    }
    ctx.quadraticCurveTo(potCX, soilY + 5.5, potCX + ringDefs[2].r, soilY + ringDefs[2].yOff)
    for (let i = ringDefs.length - 2; i >= 0; i--) {
      const ring = ringDefs[i]
      ctx.lineTo(potCX + ring.r, soilY + ring.yOff)
    }
    ctx.closePath()
    ctx.fill()
  }
}

export function drawShadow(ctx: CanvasRenderingContext2D, sunAngle: number, stemHeight: number, potCX: number, soilY: number): void {
  const elevation = Math.sin(sunAngle)
  const dirX = -Math.cos(sunAngle)

  if (elevation <= 0.05 || Math.abs(dirX) < 0.05) return

  const y = soilY + 10
  const potR = 30
  const shadowLen = Math.max(4, (1 - elevation * 0.75) * 30)
  const offsetX = dirX * shadowLen
  const potGrad = ctx.createRadialGradient(potCX + offsetX, y, 0, potCX + offsetX, y, potR * 1.2)
  potGrad.addColorStop(0, `rgba(0,0,0,${clamp(elevation * 0.22, 0.06, 0.20)})`)
  potGrad.addColorStop(0.6, `rgba(0,0,0,${clamp(elevation * 0.14, 0.03, 0.12)})`)
  potGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = potGrad
  ctx.beginPath()
  ctx.ellipse(potCX + offsetX, y, potR * 1.2, potR * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()

  if (stemHeight > 10) {
    const plantLen = (1 - elevation * 0.7) * stemHeight * 0.4
    if (plantLen > 4) {
      const plantOfsX = dirX * (shadowLen + plantLen * 0.6)
      const plantW = Math.max(5, 8 + stemHeight * 0.04)
      const plantGrad = ctx.createRadialGradient(potCX + plantOfsX, y, 0, potCX + plantOfsX, y, plantW * 2.5)
      plantGrad.addColorStop(0, `rgba(0,0,0,${clamp(elevation * 0.10, 0.02, 0.08)})`)
      plantGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = plantGrad
      ctx.beginPath()
      ctx.ellipse(potCX + offsetX + dirX * plantLen * 0.3, y, plantLen * 0.55 + plantW, plantW * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function drawGround(ctx: CanvasRenderingContext2D, season: string, w: number, h: number, day = 0): void {
  const safeDay = Number.isFinite(day) ? day : 0
  const groundY = 365
  const seasonLen = 364 / 4
  const dayInYear = safeDay % 364

  let winterMix = season === 'winter' ? 1 : 0
  if (season === 'autumn') {
    const autumnDay = dayInYear - seasonLen * 2
    winterMix = smoothstep(seasonLen - 18, seasonLen - 2, autumnDay)
  }

  const isAutumn = season === 'autumn'
  const isSpring = season === 'spring'

  const summerColor = colorFromRGB(0.35, 0.48, 0.20)
  const autumnColor = colorFromRGB(0.50, 0.38, 0.22)
  const winterColor = colorFromRGB(0.52, 0.50, 0.46)
  const springColor = colorFromRGB(0.40, 0.50, 0.25)

  let baseColor: number
  if (season === 'summer') {
    baseColor = summerColor
  } else if (isSpring) {
    baseColor = springColor
  } else if (isAutumn) {
    baseColor = lerpColor(summerColor, autumnColor, clamp((dayInYear - seasonLen) / seasonLen, 0, 1))
    baseColor = lerpColor(baseColor, winterColor, winterMix)
  } else {
    baseColor = winterColor
  }

  const groundH = h - groundY

  // Main ground fill with subtle gradient (lighter at horizon)
  const gg = ctx.createLinearGradient(0, groundY, 0, h)
  gg.addColorStop(0, colorToCSS(lighten(baseColor, 0.06), 1))
  gg.addColorStop(1, colorToCSS(darken(baseColor, 0.08), 1))
  ctx.fillStyle = gg
  ctx.fillRect(0, groundY, w, groundH)

  // Shadow zone under pot
  const potCX = 200
  const shadowZone = ctx.createRadialGradient(potCX, groundY + 8, 0, potCX, groundY + 8, 55)
  shadowZone.addColorStop(0, 'rgba(0,0,0,0.18)')
  shadowZone.addColorStop(0.5, 'rgba(0,0,0,0.08)')
  shadowZone.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shadowZone
  ctx.fillRect(potCX - 55, groundY, 110, 20)

  // Subtle horizontal soil texture
  for (let i = 0; i < 10; i++) {
    const ty = groundY + 2 + i * 3.5
    const alpha = 0.04 + Math.sin(i * 1.7) * 0.025
    ctx.fillStyle = colorToCSS(darken(baseColor, 0.1), alpha)
    ctx.fillRect(0, ty, w, 1 + (i % 2))
  }

  // Varied texture dots (stones, pebbles, debris) — deterministic
  const dotColors = [
    darken(baseColor, 0.25),
    darken(baseColor, 0.18),
    darken(baseColor, 0.30),
    colorFromRGB(0.30, 0.25, 0.18),
    colorFromRGB(0.40, 0.32, 0.22),
    lighten(baseColor, 0.05),
  ]
  for (let i = 0; i < 45; i++) {
    const seed = i * 17.3 + 3.7
    const bx = (Math.sin(seed * 3.1) * 0.5 + 0.5) * w
    const by = groundY + 2 + (Math.sin(seed * 5.7 + 1.3) * 0.5 + 0.5) * (groundH - 4)
    const dotR = 0.8 + (Math.sin(seed * 2.3) * 0.5 + 0.5) * 2.2
    const colorIdx = Math.floor(Math.abs(Math.sin(seed * 7.1)) * dotColors.length)
    const dotColor = dotColors[colorIdx]
    const dotAlpha = 0.3 + (Math.sin(seed * 4.3) * 0.5 + 0.5) * 0.4
    ctx.fillStyle = colorToCSS(dotColor, dotAlpha)
    ctx.beginPath()
    ctx.ellipse(bx, by, dotR, dotR * 0.6, seed * 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Horizon line
  ctx.fillStyle = colorToCSS(darken(baseColor, 0.15), 0.35)
  ctx.fillRect(0, groundY, w, 1)

  if (winterMix > 0.05) {
    const snowAlpha = 0.15 + winterMix * 0.25
    const patches = [
      { x: 70, y: 372, rx: 55, ry: 12 },
      { x: 260, y: 376, rx: 62, ry: 10 },
      { x: 175, y: 382, rx: 42, ry: 8 },
      { x: 330, y: 374, rx: 35, ry: 7 },
    ]
    for (const patch of patches) {
      const sg = ctx.createRadialGradient(patch.x, patch.y, 0, patch.x, patch.y, patch.rx)
      sg.addColorStop(0, `rgba(240, 244, 252, ${snowAlpha})`)
      sg.addColorStop(0.6, `rgba(230, 236, 245, ${snowAlpha * 0.5})`)
      sg.addColorStop(1, 'rgba(230, 236, 245, 0)')
      ctx.fillStyle = sg
      ctx.beginPath()
      ctx.ellipse(patch.x, patch.y, patch.rx, patch.ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (winterMix < 0.85) {
    // Varied grass blades near pot base
    const baseY = groundY - 1
    const grassColors = isAutumn
      ? [colorFromRGB(0.55, 0.40, 0.18), colorFromRGB(0.50, 0.35, 0.12), colorFromRGB(0.60, 0.45, 0.20)]
      : [colorFromRGB(0.28, 0.52, 0.18), colorFromRGB(0.32, 0.58, 0.22), colorFromRGB(0.25, 0.48, 0.15), colorFromRGB(0.38, 0.60, 0.25)]

    for (let i = 0; i < 22; i++) {
      const seed = i * 13.7 + 2.3
      const gx = potCX - 38 + i * 3.8 + Math.sin(seed * 2.3) * 3
      const gh = 3 + (Math.sin(seed * 3.7 + 1) * 0.5 + 0.5) * 5
      const lean = Math.sin(seed * 1.9) * 2.5
      const colorIdx = Math.floor(Math.abs(Math.sin(seed * 5.1)) * grassColors.length)
      const grassColor = grassColors[colorIdx]
      const lw = 0.8 + (Math.sin(seed * 1.8) * 0.5 + 0.5) * 0.6

      ctx.strokeStyle = colorToCSS(grassColor, 1)
      ctx.lineWidth = lw
      ctx.beginPath()
      ctx.moveTo(gx, baseY)
      ctx.quadraticCurveTo(gx + lean * 0.5, baseY - gh * 0.6, gx + lean, baseY - gh)
      ctx.stroke()

      // Small seed head on some blades
      if (i % 4 === 0 && gh > 5) {
        ctx.fillStyle = colorToCSS(darken(grassColor, 0.1), 0.7)
        ctx.beginPath()
        ctx.arc(gx + lean, baseY - gh - 1.5, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

export function drawSnow(ctx: CanvasRenderingContext2D, potCX: number, potY: number, _sunAngle: number): void {
  const rimTopY = potY + 14
  const rimR = 32

  ctx.fillStyle = 'rgba(235, 240, 250, 0.85)'
  ctx.beginPath()
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const a = t * Math.PI
    const jitter = Math.sin(i * 3.7 + t * 12) * 2
    const r = rimR * (1 + 0.04 * Math.sin(i * 2.3)) + jitter
    const x = potCX + Math.cos(a) * r
    const y = rimTopY - 1 + Math.abs(Math.sin(i * 2.3 + t * 8)) * 2.5 + 0.5
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.lineTo(potCX + rimR * 1.05, rimTopY + 4)
  ctx.lineTo(potCX - rimR * 1.05, rimTopY + 4)
  ctx.closePath()
  ctx.fill()
}

export function drawStem(ctx: CanvasRenderingContext2D, params: DrawParams, potCX: number, potTopY: number, sunAngle: number, season: string): void {
  const { stemHeight, stemColor, swayAmount, swayTime } = params
  const baseY = potTopY - 2
  const isWinter = season === 'winter'
  const color = isWinter ? darken(stemColor, 0.25) : stemColor
  const bottomR = Math.max(2, 2.5 + 5 * Math.min(1, stemHeight / 200))
  const topR = Math.max(1, bottomR * 0.4)

  const segments = Math.max(3, Math.floor(stemHeight / 8))
  const horiz = Math.abs(Math.cos(sunAngle))
  const stemX = potCX

  for (let s = 0; s < segments; s++) {
    const t0 = s / segments
    const t1 = (s + 1) / segments
    const sway0 = Math.sin(swayTime * 2 + t0 * 3) * swayAmount * 0.5 * t0
    const sway1 = Math.sin(swayTime * 2 + t1 * 3) * swayAmount * 0.5 * t1
    const r0 = bottomR + (topR - bottomR) * t0
    const r1 = bottomR + (topR - bottomR) * t1
    const y0 = baseY - stemHeight * t0
    const y1 = baseY - stemHeight * t1
    const x0 = stemX + sway0
    const x1 = stemX + sway1

    const dot = Math.cos(sunAngle)
    const shade = 0.06 + (dot * 0.5 + 0.5) * 0.2 * horiz

    ctx.fillStyle = colorToCSS(darken(color, shade))
    ctx.beginPath()
    ctx.moveTo(x0 - r0, y0)
    ctx.quadraticCurveTo((x0 - r0 + x1 - r1) / 2, (y0 + y1) / 2, x1 - r1, y1)
    ctx.lineTo(x1 + r1, y1)
    ctx.quadraticCurveTo((x0 + r0 + x1 + r1) / 2, (y0 + y1) / 2, x0 + r0, y0)
    ctx.closePath()
    ctx.fill()

    const lightShade = 0.06 + ((Math.cos(sunAngle + Math.PI) * 0.5 + 0.5)) * 0.12 * horiz
    ctx.fillStyle = colorToCSS(lighten(color, lightShade * 0.3))
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x0 + r0 * 0.3, y0)
    ctx.lineTo(x1 + r1 * 0.3, y1)
    ctx.lineTo(x1, y1)
    ctx.closePath()
    ctx.fill()
  }
}

export function drawBranches(ctx: CanvasRenderingContext2D, params: DrawParams, potCX: number, potTopY: number, sunAngle: number, season: string): void {
  const { branchCount, stemHeight, stemColor, branchAngle, swayAmount, swayTime } = params
  const baseY = potTopY - 2
  const isWinter = season === 'winter'
  const color = isWinter ? darken(stemColor, 0.25) : stemColor
  const horiz = Math.abs(Math.cos(sunAngle))
  const stemX = potCX

  for (let i = 0; i < branchCount; i++) {
    const t = (i + 0.5) / Math.max(1, branchCount)
    const originY = baseY - stemHeight * (0.25 + t * 0.65)
    const angle = i * 2.8 + t * 0.7
    const length = 8 + (1 - t) * 15
    const sway = Math.sin(swayTime * 2.5 + i * 1.3) * swayAmount * 0.4
    const rotAngle = angle + sway
    const segments = Math.max(2, Math.floor(length / 5))
    const baseRadius = 2.5 * (1 - t * 0.6)

    for (let s = 0; s < segments; s++) {
      const st = s / segments
      const nst = (s + 1) / segments
      const droop = st * st * length * 0.09
      const ndroop = nst * nst * length * 0.09
      const wiggle = Math.sin(st * 3.7 + i * 2.1) * 1.5 * st
      const nwiggle = Math.sin(nst * 3.7 + i * 2.1) * 1.5 * nst
      const hDist = 2 + Math.pow(st, 0.7) * length * 0.12 + wiggle
      const nhDist = 2 + Math.pow(nst, 0.7) * length * 0.12 + nwiggle

      const cx = stemX + Math.cos(rotAngle) * hDist
      const cz = Math.sin(rotAngle) * hDist
      const cy = originY - droop
      const nx = stemX + Math.cos(rotAngle) * nhDist
      const nz = Math.sin(rotAngle) * nhDist
      const ny = originY - ndroop

      const bulge = 1 + 0.3 * Math.exp(-st * 5)
      const nbulge = 1 + 0.3 * Math.exp(-nst * 5)
      const br = Math.max(0.3, baseRadius * (1 - st * 0.72) * bulge)
      const nr = Math.max(0.3, baseRadius * (1 - nst * 0.72) * nbulge)

      const shade = 0.06 + ((Math.cos(rotAngle) * Math.cos(sunAngle) * 0.5 + 0.5)) * 0.2
      ctx.fillStyle = colorToCSS(darken(color, shade))
      ctx.beginPath()
      ctx.moveTo(cx - br, cy + cz * 0.5)
      ctx.lineTo(nx - nr, ny + nz * 0.5)
      ctx.lineTo(nx + nr, ny + nz * 0.5)
      ctx.lineTo(cx + br, cy + cz * 0.5)
      ctx.closePath()
      ctx.fill()
    }
  }
}

export function drawLeaves(ctx: CanvasRenderingContext2D, params: DrawParams, potCX: number, potTopY: number, sunAngle: number, season: string): void {
  const { leafCount, leafColor, leafSize, stemHeight, branchAngle, swayAmount, swayTime, stemColor } = params
  if (leafCount <= 0) return
  const baseY = potTopY - 2
  const totalLeaves = Math.round(leafCount * 2)
  if (totalLeaves <= 0) return
  const horiz = Math.abs(Math.cos(sunAngle))
  const stemX = potCX

  for (let i = 0; i < totalLeaves; i++) {
    const tBase = (i + 0.5) / totalLeaves
    const jitter = Math.sin(i * 13.7 + leafCount * 5.3) * 0.075
    const potClearance = 22
    const tMin = Math.min(0.5, potClearance / (Math.max(1, stemHeight) * 0.95))
    const tRange = 0.92 - tMin
    const t = tMin + tRange * clamp(tBase + jitter * 0.5, 0, 1)
    const y = baseY - stemHeight * t * 0.95
    const angle = i * 2.4 + Math.sin(i * 7.1 + leafCount * 3.7) * 0.4
    const dist = 15 + t * 30
    const sway = Math.sin(swayTime * 2 + i * 1.7) * swayAmount * 0.3
    const openness = clamp(1 - Math.abs(t - 0.5) * 0.6, 0.3, 1)
    const maturityBonus = (1 - t) * 0.3
    const effectiveLeafSize = clamp(leafSize + maturityBonus, 0.3, 1.0)
    const sizeBase = effectiveLeafSize * (30 + (1 - t) * 50)
    const sizeVar = 0.7 + Math.sin(i * 7.3 + t * 3.1) * 0.3
    const size = sizeBase * sizeVar
    const leafAngle = angle + sway + (t - 0.5) * branchAngle / 180 * Math.PI

    let finalColor: number
    if (season === 'autumn') {
      const autumnT = clamp((totalLeaves - i) / totalLeaves, 0, 1)
      const autumnColor = lerpColor(leafColor, colorFromRGB(0.85, 0.45 + autumnT * 0.3, 0.08 + autumnT * 0.1), autumnT)
      finalColor = autumnColor
    } else if (season === 'spring') {
      finalColor = lighten(leafColor, 0.12)
    } else {
      finalColor = leafColor
    }

    const colorVariation = ((i * 37) % 100) / 500
    const color = lighten(finalColor, colorVariation)
    const dot = Math.cos(angle) * Math.cos(sunAngle)
    const dirShade = 0.05 + (dot * 0.5 + 0.5) * 0.15 * horiz
    const dirColor = darken(color, dirShade)

    const px = stemX
    const py = y
    const rx = stemX + Math.cos(angle) * dist
    const ry = y

    const branchW = 3.5 * (1 - t * 0.3)
    const ba = Math.atan2(ry - py, rx - px)
    const bpx = -Math.sin(ba)
    const bpy = Math.cos(ba)
    const mx = (px + rx) / 2
    const my = (py + ry) / 2
    const curve = Math.sin(i * 3.7 + t * 5.1) * 20
    const cpx = mx + bpx * curve
    const cpy = my + bpy * curve
    ctx.fillStyle = colorToCSS(darken(stemColor, 0.08))
    ctx.beginPath()
    ctx.moveTo(px + bpx * branchW, py + bpy * branchW)
    ctx.quadraticCurveTo(cpx + bpx * branchW * 0.5, cpy + bpy * branchW * 0.5, rx + bpx * 0.5, ry + bpy * 0.5)
    ctx.quadraticCurveTo(cpx - bpx * branchW * 0.5, cpy - bpy * branchW * 0.5, px - bpx * branchW, py - bpy * branchW)
    ctx.closePath()
    ctx.fill()

    const lx = rx
    _drawLeaf(ctx, lx, ry, size, leafAngle, dirColor, openness)
  }
}

function _drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: number, openness: number): void {
  const len = size * 0.55 * (openness * 0.8 + 0.2)
  const wid = size * 0.26

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(1, 0.4)
  ctx.scale(1 + (1 - openness) * 0.3, 1)

  ctx.fillStyle = colorToCSS(color)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(wid * 0.5, len * 0.15, wid * 0.9, len * 0.4, 0, len)
  ctx.bezierCurveTo(-wid * 0.9, len * 0.4, -wid * 0.5, len * 0.15, 0, 0)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = colorToCSS(darken(color, 0.18))
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(0, len * 0.1)
  ctx.lineTo(0, len * 0.85)
  ctx.stroke()

  ctx.restore()
}

export function drawArchitectureLeaves(
  ctx: CanvasRenderingContext2D,
  nodes: ArchitectureRenderNode[],
  leafColor: number,
  stemColor: number,
  swayAmount: number,
  swayTime: number,
  season: string,
  sunAngle: number,
  leafSizeGene = 1.0
): void {
  const dnaLeafSize = clamp(leafSizeGene / 1.25, 0.4, 1.2)
  if (nodes.length === 0) return
  const horiz = Math.abs(Math.cos(sunAngle))

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.leafSize < 0.02) continue

    const t = i / Math.max(1, nodes.length)
    const angle = node.leafAngle
    const dist = 10 + t * 20
    const sway = node.allowSway === false
      ? 0
      : Math.sin(swayTime * 2 + i * 1.7) * swayAmount * 0.3
    const openness = clamp(1 - Math.abs(t - 0.5) * 0.6, 0.3, 1)
    const size = node.leafSize * (20 + (1 - t) * 30)

    const leafRot = angle + sway
    const phototropismBias = 0.3 * clamp(Math.sin(sunAngle - leafRot), -1, 1) * 0.5
    const finalLeafRot = leafRot + phototropismBias

    const px = node.x
    const py = node.y
    const rx = node.x + Math.cos(finalLeafRot) * dist
    const ry = node.y

    const maturityBonus = (1 - t) * 0.3
    const effectiveLeafSize = clamp(dnaLeafSize + maturityBonus, 0.3, 1.0)
    const sizeBase = effectiveLeafSize * size
    const sizeVar = 0.7 + Math.sin(i * 7.3 + t * 3.1) * 0.3
    const finalSize = sizeBase * sizeVar * (season === 'winter' ? 0.75 : 1)

    let finalColor: number
    if (season === 'autumn') {
      const autumnT = clamp(1 - i / nodes.length, 0, 1)
      finalColor = lerpColor(leafColor, colorFromRGB(0.85, 0.45 + autumnT * 0.3, 0.08 + autumnT * 0.1), autumnT)
    } else if (season === 'winter') {
      finalColor = darken(leafColor, 0.35)
    } else if (season === 'spring') {
      finalColor = lighten(leafColor, 0.12)
    } else {
      finalColor = leafColor
    }

    const colorVariation = ((i * 37) % 100) / 500
    const color = lighten(finalColor, colorVariation)
    const dot = Math.cos(finalLeafRot) * Math.cos(sunAngle)
    const dirShade = 0.05 + (dot * 0.5 + 0.5) * 0.15 * horiz
    const dirColor = darken(color, dirShade)

    const branchW = 3.5 * (1 - t * 0.3)
    const ba = Math.atan2(ry - py, rx - px)
    const bpx = -Math.sin(ba)
    const bpy = Math.cos(ba)
    const mx = (px + rx) / 2
    const my = (py + ry) / 2
    const curve = Math.sin(i * 3.7 + t * 5.1) * 20
    const cpx = mx + bpx * curve
    const cpy = my + bpy * curve
    ctx.fillStyle = colorToCSS(darken(stemColor, 0.08))
    ctx.beginPath()
    ctx.moveTo(px + bpx * branchW, py + bpy * branchW)
    ctx.quadraticCurveTo(cpx + bpx * branchW * 0.5, cpy + bpy * branchW * 0.5, rx + bpx * 0.5, ry + bpy * 0.5)
    ctx.quadraticCurveTo(cpx - bpx * branchW * 0.5, cpy - bpy * branchW * 0.5, px - bpx * branchW, py - bpy * branchW)
    ctx.closePath()
    ctx.fill()

    const lx = rx
    _drawLeaf(ctx, lx, ry, finalSize, finalLeafRot, dirColor, openness)
  }
}

export function drawArchitectureReproduction(
  ctx: CanvasRenderingContext2D,
  nodes: ArchitectureRenderNode[],
  flowerColor: number,
  fruitColor: number,
  swayAmount: number,
  swayTime: number,
  sunAngle: number,
  season: string
): void {
  if (season === 'winter') return
  const horiz = Math.abs(Math.cos(sunAngle))

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node.hasFlower && !node.hasFruit) continue

    const sway = node.allowSway === false
      ? 0
      : Math.sin(swayTime * 1.5 + i * 2.1) * swayAmount * 0.2
    const px = node.x
    const py = node.y + sway * 0.3

    if (node.hasFlower && !node.hasFruit) {
      const openness = clamp(Math.sin(swayTime * 0.5 + i) * 0.5 + 0.5, 0.2, 1)
      const size = 10 + node.leafSize * 8
      const dot = Math.cos(node.leafAngle) * Math.cos(sunAngle)
      const dirShade = 0.05 + (dot * 0.5 + 0.5) * 0.12 * horiz
      _drawFlower(ctx, px, py, size, darken(flowerColor, dirShade), openness)
    }

    if (node.hasFruit) {
      const ripeness = clamp(Math.sin(swayTime * 0.3 + i * 2) * 0.5 + 0.5, 0.2, 1)
      const size = 10 + node.leafSize * 6
      const mixedColor = lerpColor(colorFromRGB(0.5, 0.8, 0.2), fruitColor, ripeness)
      const dot = Math.cos(node.leafAngle) * Math.cos(sunAngle)
      const shade = 0.06 + (dot * 0.5 + 0.5) * 0.18
      const col = darken(mixedColor, shade)
      const r = size * 0.4
      ctx.fillStyle = colorToCSS(col)
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
      const hl = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r)
      hl.addColorStop(0, 'rgba(255,255,255,0.35)')
      hl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = hl
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function drawFlowers(ctx: CanvasRenderingContext2D, params: DrawParams, potCX: number, potTopY: number, sunAngle: number, season: string): void {
  const { flowerCount, flowerColor, stemHeight, swayAmount, swayTime } = params
  if (flowerCount <= 0 || season === 'winter') return
  const baseY = potTopY - 2
  const horiz = Math.abs(Math.cos(sunAngle))
  const stemX = potCX

  for (let i = 0; i < flowerCount; i++) {
    const t = (i + 0.5) / Math.max(1, flowerCount)
    const y = baseY - stemHeight * (0.3 + t * 0.6)
    const angle = i * 3.1 + t * 1.7
    const dist = 3 + t * 5
    const px = stemX + Math.cos(angle) * dist
    const py = y
    const sway = Math.sin(swayTime * 1.5 + i * 2.1) * swayAmount * 0.2
    const openness = clamp(Math.sin(swayTime * 0.5 + i) * 0.5 + 0.5, 0.2, 1)
    const size = 12 + t * 8
    const dot = Math.cos(angle) * Math.cos(sunAngle)
    const dirShade = 0.05 + (dot * 0.5 + 0.5) * 0.12 * horiz
    const dirColor = darken(flowerColor, dirShade)

    _drawFlower(ctx, px, py + sway * 0.3, size, dirColor, openness)
  }
}

function _drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: number, openness: number): void {
  const petalCount = 6
  const open = openness * 0.8 + 0.2
  const petalLen = size * 0.35 * open
  const petalWid = size * 0.22

  ctx.save()
  ctx.translate(x, y)

  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2
    ctx.save()
    ctx.rotate(a)
    ctx.fillStyle = colorToCSS(color)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(petalWid * 0.6, petalLen * 0.2, petalWid * 0.8, petalLen * 0.6, 0, petalLen)
    ctx.bezierCurveTo(-petalWid * 0.8, petalLen * 0.6, -petalWid * 0.6, petalLen * 0.2, 0, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  const pistilColor = colorFromRGB(0.95, 0.72, 0.08)
  ctx.fillStyle = colorToCSS(pistilColor)
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.06, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorToCSS(darken(pistilColor, 0.15))
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.035, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

export function drawFruits(ctx: CanvasRenderingContext2D, params: DrawParams, potCX: number, potTopY: number, sunAngle: number): void {
  const { fruitCount, fruitColor, stemHeight, swayAmount, swayTime } = params
  const baseY = potTopY - 2
  const horiz = Math.abs(Math.cos(sunAngle))
  const stemX = potCX

  for (let i = 0; i < fruitCount; i++) {
    const t = (i + 0.5) / Math.max(1, fruitCount)
    const y = baseY - stemHeight * (0.2 + t * 0.5)
    const angle = i * 2.7 + t * 1.3
    const dist = 2 + t * 4
    const px = stemX + Math.cos(angle) * dist
    const py = y
    const sway = Math.sin(swayTime * 1.2 + i * 1.5) * swayAmount * 0.15
    const size = 10 + t * 6
    const ripeness = clamp(Math.sin(swayTime * 0.3 + i * 2) * 0.5 + 0.5, 0.2, 1)

    const mixedColor = lerpColor(colorFromRGB(0.5, 0.8, 0.2), fruitColor, ripeness)
    const dot = Math.cos(angle) * Math.cos(sunAngle)
    const shade = 0.06 + (dot * 0.5 + 0.5) * 0.18
    const col = darken(mixedColor, shade)

    const r = size * 0.4
    ctx.fillStyle = colorToCSS(col)
    ctx.beginPath()
    ctx.arc(px + sway * 0.2, py + sway * 0.1, r, 0, Math.PI * 2)
    ctx.fill()

    const hl = ctx.createRadialGradient(px - r * 0.3 + sway * 0.2, py - r * 0.3 + sway * 0.1, 0, px + sway * 0.2, py + sway * 0.1, r)
    hl.addColorStop(0, colorToCSS(lighten(col, 0.2)))
    hl.addColorStop(0.3, colorToCSS(lighten(col, 0.1)))
    hl.addColorStop(1, colorToCSS(col))
    ctx.fillStyle = hl
    ctx.beginPath()
    ctx.arc(px + sway * 0.2, py + sway * 0.1, r, 0, Math.PI * 2)
    ctx.fill()
  }
}
