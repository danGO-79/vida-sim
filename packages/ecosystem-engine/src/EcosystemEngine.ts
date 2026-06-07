import type { FaunaEntity, FaunaType, EcosystemEvent } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isHourInRange(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour <= end
  return hour >= start || hour <= end
}

const ENTER_FRAMES = 15
const EXIT_FRAMES = 25

function isLadybug(f: FaunaEntity): boolean {
  return f.type === 'ladybug'
}

function isAnt(f: FaunaEntity): boolean {
  return f.type === 'ant'
}

function isBird(f: FaunaEntity): boolean {
  return f.type === 'bird'
}

export class EcosystemEngine {
  private _fauna: FaunaEntity[] = []
  private _events: EcosystemEvent[] = []
  private _cooldowns: Record<string, number> = {}

  private _visitTimer = 0
  private _cooldownTimer = 0
  private _state: 'idle' | 'entering' | 'active' | 'leaving' = 'idle'
  private _visitDuration = 0
  private _nextCooldown = 0
  private _swayTime = 0
  private _lastWarmSeason = false
  private _plantAttractive = false
  private _windFramesAbove8 = 0
  private _stemHeight = 0
  private _leafCount = 0

  get fauna(): FaunaEntity[] {
    return this._fauna
  }

  get activeAntCount(): number {
    return this._fauna.filter(f => isAnt(f) && f.life > 0).length
  }

  get events(): EcosystemEvent[] {
    return [...this._events]
  }

  update(days: number, sunlight: number, temperature: number, humidity: number, hasFlowers: boolean, hasFruits: boolean, season: string, hour: number, rain: number, wind: number, stemHeight: number, leafCount: number): void {
    this._plantAttractive = hasFlowers || hasFruits
    this._stemHeight = stemHeight
    this._leafCount = leafCount
    this._updateFauna(days, sunlight, temperature, humidity, hasFlowers, hasFruits, season, hour, rain, wind)
    this._checkEvents(days, sunlight, temperature, humidity, hasFlowers)
  }

  private _updateFauna(_days: number, _sunlight: number, temperature: number, _humidity: number, hasFlowers: boolean, _hasFruits: boolean, season: string, hour: number, rain: number, wind: number): void {
    this._swayTime += 0.02

    if (rain > 5) {
      if (this._fauna.length > 0 && this._state !== 'leaving') {
        for (const f of this._fauna) f.life = EXIT_FRAMES
        this._state = 'leaving'
      }
      if (this._fauna.length === 0) this._state = 'idle'
      this._lastWarmSeason = false
      return
    }

    // Wind filtering: non-ant fauna leave at wind >= 8;
    // bees also leave at wind >= 10
    if (wind > 8) {
      this._windFramesAbove8++
    } else if (wind < 7) {
      this._windFramesAbove8 = 0
    }

    if (wind >= 10) {
      this._fauna = this._fauna.filter(f => isAnt(f) || isBird(f))
    } else if (wind >= 8) {
      this._fauna = this._fauna.filter(f => isAnt(f) || f.type === 'bee' || isBird(f))
    }
    if (this._fauna.length === 0 && this._state !== 'idle') {
      this._state = 'idle'
      this._visitTimer = 0
      this._cooldownTimer = 0
    }

    const isWarmSeason = season === 'spring' || season === 'summer'

    if (!isWarmSeason) {
      this._fauna = []
      this._state = 'idle'
      this._visitTimer = 0
      this._cooldownTimer = 0
      this._lastWarmSeason = false
      return
    }

    const isWarm = temperature > 10
    const isHot = temperature > 28
    const beeHours = isHourInRange(hour, 7, 19)
    const mosquitoHours = isHourInRange(hour, 18, 3)

    if (!this._lastWarmSeason && isWarmSeason) {
      this._state = 'idle'
      this._cooldownTimer = 0
      this._nextCooldown = 60 + Math.floor(Math.random() * 120)
    }
    this._lastWarmSeason = true

    switch (this._state) {
      case 'idle':
        this._handleIdle(season, hour, isWarm, isHot, hasFlowers, beeHours, mosquitoHours, wind)
        break
      case 'entering':
        this._handleEntering()
        break
      case 'active':
        this._handleActive(season)
        break
      case 'leaving':
        this._handleLeaving()
        break
    }
  }

  private _handleIdle(season: string, hour: number, isWarm: boolean, isHot: boolean, hasFlowers: boolean, beeHours: boolean, mosquitoHours: boolean, wind: number): void {
    this._cooldownTimer++
    if (this._cooldownTimer < this._nextCooldown) return

    const types = this._pickTypes(season, hour, isWarm, isHot, beeHours, mosquitoHours, wind)
    if (types.length === 0) {
      this._cooldownTimer = 0
      this._nextCooldown = 30 + Math.floor(Math.random() * 60)
      return
    }

    const count = 1 + Math.floor(Math.random() * Math.min(types.length, 3))
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length]

      if (type === 'ant') {
        const groupSize = 5 + Math.floor(Math.random() * 4)
        const direction = Math.random() < 0.5 ? 1 : -1
        const groupId = `ant-${Date.now()}-${Math.random()}`
        const groundY = 368 + (Math.random() - 0.5) * 6

        for (let g = 0; g < groupSize; g++) {
          const entity: FaunaEntity = {
            id: `${type}-${Date.now()}-${Math.random()}`,
            type: 'ant',
            x: direction > 0 ? -10 - g * 6 : 410 + g * 6,
            y: groundY + (Math.random() - 0.5) * 6,
            z: 0,
            life: ENTER_FRAMES,
            maxLife: 200,
            groundY: groundY + (Math.random() - 0.5) * 4,
            direction,
            groupId
          }
          this._fauna.push(entity)
        }
      } else if (type === 'bird') {
        const direction = Math.random() < 0.5 ? 1 : -1
        const entity: FaunaEntity = {
          id: `bird-${Date.now()}-${Math.random()}`,
          type: 'bird',
          x: direction > 0 ? -160 : 160,
          y: 180 + Math.random() * 80,
          z: 0,
          life: ENTER_FRAMES,
          maxLife: 150 + Math.floor(Math.random() * 50),
          direction
        }
        this._fauna.push(entity)
      } else {
        const entryAngle = Math.random() * Math.PI * 2
        const entryDist = 100 + Math.random() * 60
        const entity: FaunaEntity = {
          id: `${type}-${Date.now()}-${Math.random()}`,
          type,
          x: Math.cos(entryAngle) * entryDist,
          y: 40 + Math.random() * 90,
          z: Math.sin(entryAngle) * entryDist,
          life: ENTER_FRAMES,
          maxLife: 600,
          orbitPhase: Math.random() * Math.PI * 2,
          orbitRadius: 25 + Math.random() * 35,
          baseY: 50 + Math.random() * 60,
          wanderAngle: Math.random() * Math.PI * 2
        }
        if (isLadybug(entity)) {
          entity.landed = false
          entity.landTimer = 40 + Math.floor(Math.random() * 80)
          const leafPos = this._getRandomLeafPosition(this._stemHeight, this._leafCount)
          entity.leafTargetX = leafPos.x
          entity.leafTargetY = leafPos.y
        }
        this._fauna.push(entity)
      }
    }

    this._state = 'entering'
    this._visitTimer = 0
  }

  private _pickTypes(season: string, hour: number, isWarm: boolean, isHot: boolean, beeHours: boolean, mosquitoHours: boolean, wind: number): FaunaType[] {
    const candidates: FaunaType[] = []

    // Wind filtering: at >= 10 only ants; at >= 8 ants + bees
    if (wind >= 10) {
      if (isWarm && !isHot) candidates.push('ant')
      return candidates
    }
    if (wind >= 8) {
      if (isWarm && !isHot) candidates.push('ant')
      if (beeHours && isWarm) candidates.push('bee')
      return candidates
    }

    if (beeHours && isWarm) {
      candidates.push('bee')
    }
    if (mosquitoHours && isWarm && season === 'spring') {
      candidates.push('mosquito')
    }
    if (beeHours && isWarm && !isHot) {
      candidates.push('butterfly')
    }
    if (isHourInRange(hour, 21.5, 6.5) && isWarm) {
      candidates.push('firefly')
    }
    if (beeHours && !isHot) {
      candidates.push('ladybug')
    }
    if (isWarm && !isHot) {
      candidates.push('ant')
    }
    if (beeHours && isWarm && !isHot) {
      candidates.push('bird')
    }

    const shuffled = candidates.sort(() => Math.random() - 0.5)
    const count = Math.min(shuffled.length, 1 + Math.floor(Math.random() * 2))
    return shuffled.slice(0, count)
  }

  private _getRandomLeafPosition(stemHeight: number, leafCount: number): { x: number, y: number } {
    const potCX = 200
    const baseY = 357
    const totalLeaves = Math.max(50, Math.round(leafCount * 2))
    if (totalLeaves <= 0) return { x: potCX, y: baseY - 30 }
    const stemX = potCX + 22 * 0.25

    const positions: { x: number, y: number }[] = []
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

      const rx = stemX + Math.cos(angle) * dist
      const ry = y

      const size = 30 + (1 - t) * 50
      const openness = clamp(1 - Math.abs(t - 0.5) * 0.6, 0.3, 1)
      const len = size * 0.55 * (openness * 0.8 + 0.2)
      const leafAngle = angle + (t - 0.5) * 35 / 180 * Math.PI

      positions.push({
        x: rx + Math.cos(leafAngle) * len * 0.5,
        y: ry + Math.sin(leafAngle) * len * 0.5
      })
    }

    return positions.length > 0
      ? positions[Math.floor(Math.random() * positions.length)]
      : { x: 0, y: 60 }
  }

  private _handleEntering(): void {
    let allSettled = true
    for (const f of this._fauna) {
      if (isLadybug(f)) {
        if (f.landed) continue
        const bob = Math.sin(this._swayTime * 3 + f.x * 2) * 2
        const targetX = f.leafTargetX ?? 0
        const dx = targetX - f.x
        const dz = 0 - f.z
        const distToTarget = Math.sqrt(dx * dx + dz * dz)
        if (distToTarget > 8) {
          const step = Math.max(5, distToTarget * 0.15)
          f.x += dx / distToTarget * step
          f.z += dz / distToTarget * step
          f.y += ((f.leafTargetY! + bob) - f.y) * 0.08
          allSettled = false
        } else {
          f.x = f.leafTargetX!
          f.y = f.leafTargetY!
          f.z = 0
          f.landed = true
          f.landTimer = 80 + Math.floor(Math.random() * 100)
        }
      } else if (isAnt(f)) {
        f.x += (f.direction ?? 1) * 60 * (1 / 60)
        f.y = f.groundY ?? 368
        f.life--
        if (f.life > 0) {
          allSettled = false
        }
      } else if (isBird(f)) {
        f.life--
      } else if (f.type === 'bee' && !this._plantAttractive) {
        f.x += (0 - f.x) * 0.05
        f.y += (80 - f.y) * 0.05
        f.z += (0 - f.z) * 0.05
        f.life--
        if (f.life > 0) allSettled = false
      } else {
        const tx = Math.cos(f.orbitPhase!) * f.orbitRadius!
        const ty = f.baseY!
        f.x += (tx - f.x) * 0.08
        f.y += (ty - f.y) * 0.08
        f.z += (0 - f.z) * 0.08
        f.life--
        if (f.life > 0) allSettled = false
      }
    }
    if (allSettled) {
      for (const f of this._fauna) f.life = 600
      this._visitDuration = 120 + Math.floor(Math.random() * 180)
      this._state = 'active'
    }
  }

  private _handleActive(_season: string): void {
    this._visitTimer++
for (const f of this._fauna) {
      if (isAnt(f)) {
        f.x += (f.direction ?? 1) * 60 * (1 / 60)
        f.y = f.groundY ?? 368
        if (f.x < -50 || f.x > 450) {
          f.life = 0
        }
      } else if (isBird(f)) {
        f.x += (f.direction ?? 1) * 4
        if (f.x < -200 || f.x > 400) {
          f.life = 0
        }
      } else if (isLadybug(f) && f.landed) {
        this._updateLadybugActive(f)
      } else {
        f.orbitPhase! += 0.02 * (f.type === 'bee' ? 1.5 : f.type === 'mosquito' ? 0.8 : 1)
        const tx = Math.cos(f.orbitPhase!) * f.orbitRadius!
        const bob = Math.sin(this._swayTime * 2 + f.orbitPhase!) * 3
        f.x += (tx - f.x) * 0.03
        f.y += ((f.baseY! + bob) - f.y) * 0.03
        f.z += (0 - f.z) * 0.03
      }
    }

    if (this._visitTimer >= this._visitDuration) {
      for (const f of this._fauna) f.life = EXIT_FRAMES
      this._state = 'leaving'
    }
  }

  private _updateLadybugActive(f: FaunaEntity): void {
    if (f.landed) {
      f.landTimer!--
      if (f.landTimer! <= 0) {
        this._state = 'leaving'
        for (const other of this._fauna) other.life = EXIT_FRAMES
      }
    } else {
      const bob = Math.sin(this._swayTime * 3 + f.x * 2) * 2
      const targetX = f.leafTargetX ?? 0
      const dx = targetX - f.x
      const dz = 0 - f.z
      const distToTarget = Math.sqrt(dx * dx + dz * dz)

      if (distToTarget > 8 && f.y >= 40) {
        const step = Math.max(5, distToTarget * 0.15)
        f.x += dx / distToTarget * step
        f.z += dz / distToTarget * step
        f.y += ((f.leafTargetY! + bob) - f.y) * 0.08
      } else if (distToTarget <= 8 && f.y >= 40) {
        f.landed = true
        f.x = f.leafTargetX!
        f.y = f.leafTargetY!
        f.z = 0
        f.landTimer = 80 + Math.floor(Math.random() * 100)
      }
    }
  }

  private _initLadybugOrbit(f: FaunaEntity): void {
    const dist = Math.sqrt(f.x * f.x + f.z * f.z)
    f.orbitRadius = Math.max(20, Math.min(60, dist || 30))
    f.orbitPhase = Math.atan2(f.z, f.x) || 0
    f.baseY = Math.max(20, Math.min(150, f.y))
  }

  private _handleLeaving(): void {
    for (const f of this._fauna) {
      if (isLadybug(f) && f.landed) {
        f.landed = false
        this._initLadybugOrbit(f)
      }
      const exitAngle = Math.atan2(f.y - 100, f.x)
      const dx = Math.cos(exitAngle)
      const dy = Math.sin(exitAngle)
      f.x += dx * 4 + (Math.random() - 0.5) * 2
      f.y += dy * 4 + (Math.random() - 0.5) * 1
      f.z += (Math.random() - 0.5) * 3
      f.life--
    }
    this._fauna = this._fauna.filter(f => f.life > 0 && Math.sqrt(f.x * f.x + f.y * f.y) < 300)

    if (this._fauna.length === 0) {
      this._state = 'idle'
      this._visitTimer = 0
      this._cooldownTimer = 0
      this._nextCooldown = 60 + Math.floor(Math.random() * 180)
    }
  }

  private _checkEvents(days: number, sunlight: number, temperature: number, humidity: number, hasFlowers: boolean): void {
    const currentDay = Math.floor(days)

    if (hasFlowers && sunlight > 40 && temperature > 16 && !this._hasRecentEvent('floracion', currentDay)) {
      this._addEvent('floracion', 'Floración en curso', currentDay)
    }

    if (temperature > 35 && !this._hasRecentEvent('calor', currentDay)) {
      this._addEvent('calor', 'Ola de calor', currentDay)
    }

    if (humidity > 80 && sunlight < 30 && !this._hasRecentEvent('lluvia', currentDay)) {
      this._addEvent('lluvia', 'Lluvia suave', currentDay)
    }

    if (temperature < 5 && !this._hasRecentEvent('frio', currentDay)) {
      this._addEvent('frio', 'Temperaturas bajas', currentDay)
    }

    if (humidity < 20 && sunlight > 70 && !this._hasRecentEvent('sequia', currentDay)) {
      this._addEvent('sequia', 'Ambiente seco', currentDay)
    }
  }

  private _hasRecentEvent(type: string, currentDay: number): boolean {
    return this._events.some(e => e.type === type && currentDay - e.day < 3)
  }

  private _addEvent(type: string, description: string, day: number): void {
    if (!this._hasRecentEvent(type, day)) {
      this._events.push({ type, description, day })
    }
  }

  restore(fauna: FaunaEntity[], events: EcosystemEvent[]): void {
    this._fauna = fauna
    this._events = events
  }
}
