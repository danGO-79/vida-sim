import { generateNarrative } from './narrator'
import type { NarrativeContext } from './narrator'
import { STAT_FLOOR } from '@vida/simulation-engine'

export type UIState = {
  sunlight: number
  temperature: number
  humidity: number
  wind: number
  rain: number
  health: number
  vitality: number
  energy: number
  stress: number
  age: number
  flowers: number
  fruits: number
  leaves: number
  biomass: number
  hydration: number
  nutrients: number
  season: string
  hour: number
  hasFauna: boolean
  isLatent: boolean
  personality: string
  totalDaysObserved: number
  activeAntCount: number
  deadLeafCount: number
}

export type EcosystemEventInput = {
  type: string
  description: string
  day: number
}

export type HistoryEntry = {
  day: number
  text: string
  timestamp: number
}

const SEASON_ICON: Record<string, string> = { spring: '🌸', summer: '🌻', autumn: '🍂', winter: '❄' }

interface IndicatorDef {
  title: string
  getText: (s: UIState) => string
  visible?: (s: UIState) => boolean
}

function makeIndicators(group: HTMLDivElement, defs: IndicatorDef[]): { el: HTMLDivElement; visible: (s: UIState) => boolean; update: (s: UIState) => void }[] {
  return defs.map(def => {
    const el = document.createElement('div')
    el.title = def.title
    group.appendChild(el)
    return {
      el,
      visible: def.visible ?? (() => true),
      update: (s: UIState) => { el.textContent = def.getText(s) }
    }
  })
}

export class UIEngine {
  private _narrativeEl: HTMLDivElement
  private _container: HTMLDivElement
  private _envIndicators: ReturnType<typeof makeIndicators>
  private _plantIndicators: ReturnType<typeof makeIndicators>
  private _narrative = ''
  private _phraseTimer = 0
  private _history: HistoryEntry[] = []
  private _lastNotableDay = -1
  private _prevHealth = 0
  private _prevVitality = 0
  private _prevEnergy = 0
  private _prevStress = 0
  private _prevHydration = 0
  private _prevNutrients = 0
  private _prevLeaves = 0
  private _prevSeason = ''
  private _prevIsLatent = false
  private _hadAnts = false
  private _seenEventKeys = new Set<string>()
  private _lowVitalityNoted = false
  private _lowNutrientsNoted = false

  constructor(containerEl: HTMLElement, sidebarEl: HTMLElement) {
    const titleEl = document.createElement('div')
    titleEl.style.cssText = `
      font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
      opacity: 0.5; margin-bottom: 4px;
      color: rgba(255,255,255,0.85);
      text-shadow: 0 0 6px rgba(0,0,0,0.9);
    `
    titleEl.textContent = 'vida - 0.6 a'
    sidebarEl.appendChild(titleEl)

    const envGroup = document.createElement('div')
    envGroup.className = 'sidebar-group'
    sidebarEl.appendChild(envGroup)

    this._envIndicators = makeIndicators(envGroup, [
      { title: 'Estación', getText: (s) => `${SEASON_ICON[s.season] || ''} ${s.season.charAt(0).toUpperCase() + s.season.slice(1)}` },
      { title: 'Hora', getText: (s) => {
        const h = Math.floor(s.hour)
        const m = Math.floor((s.hour - h) * 60)
        return `🕐 ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      }},
      { title: 'Luz solar', getText: (s) => `☀ ${Math.round(s.sunlight)}%` },
      { title: 'Temperatura', getText: (s) => `🌡 ${Math.round(s.temperature)}°C` },
      { title: 'Humedad', getText: (s) => `💧 ${Math.round(s.humidity)}%` },
      { title: 'Viento', getText: (s) => `🌬 ${Math.round(s.wind * 3.6)} km/h` },
      { title: 'Lluvia', getText: (s) => `🌧 ${Math.round(s.rain)}%` },
    ])

    const sep = document.createElement('hr')
    sep.className = 'sidebar-sep'
    sidebarEl.appendChild(sep)

    const plantGroup = document.createElement('div')
    plantGroup.className = 'sidebar-group'
    sidebarEl.appendChild(plantGroup)

    this._plantIndicators = makeIndicators(plantGroup, [
      { title: 'Salud', getText: (s) => `❤ ${Math.round(s.health)}%` },
      { title: 'Vitalidad', getText: (s) => `⚡${Math.round(s.vitality)}%` },
      { title: 'Energía', getText: (s) => `🔋 ${Math.round(s.energy)}%` },
      { title: 'Estrés', getText: (s) => `💢 ${Math.round(s.stress)}%` },
      { title: 'Nutrientes', getText: (s) => `🧪 ${Math.round(s.nutrients)}%` },
      { title: 'Edad', getText: (s) => `📅 ${s.age.toFixed(1)} días` },
      { title: 'Hojas', getText: (s) => `🍃 ${Math.round(s.leaves * 2)}` },
      { title: 'Flores', getText: (s) => `🌸 ${Math.round(s.flowers)}`, visible: (s) => s.flowers > 0 },
      { title: 'Frutos', getText: (s) => `🍎 ${Math.round(s.fruits)}`, visible: (s) => s.fruits > 0 },
      { title: 'Estado', getText: (s) => s.isLatent ? '💤 Latente' : '🌱 Activo' },
      { title: 'Personalidad', getText: (s) => `🌿 ${s.personality}`, visible: (s) => !!s.personality },
    ])

    this._container = document.createElement('div')
    this._container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 400px; height: 100%;
      pointer-events: none; overflow: hidden;
    `

    this._narrativeEl = document.createElement('div')
    this._narrativeEl.style.cssText = `
      position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
      font-size: 10px; text-align: center; opacity: 0.8;
      white-space: nowrap; transition: opacity 0.8s ease;
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    this._container.appendChild(this._narrativeEl)

    containerEl.appendChild(this._container)
  }

  update(state: UIState, deltaMs: number): void {
    this._updateInfo(state)
    this._updateNarrative(state, deltaMs)
    this._checkTransitions(state)
    this._checkDailyHistory(state)

    this._prevHealth = state.health
    this._prevVitality = state.vitality
    this._prevEnergy = state.energy
    this._prevStress = state.stress
    this._prevHydration = state.hydration
    this._prevNutrients = state.nutrients
    this._prevLeaves = state.leaves
    this._prevSeason = state.season
    this._prevIsLatent = state.isLatent
    if (state.activeAntCount > 0) this._hadAnts = true
  }

  ingestEcosystemEvents(events: EcosystemEventInput[]): void {
    for (const event of events) {
      const key = `${event.type}:${event.day}:${event.description}`
      if (this._seenEventKeys.has(key)) continue
      this._seenEventKeys.add(key)
      this._addHistory(event.day, event.description)
    }
  }

  getHistory(): HistoryEntry[] {
    return [...this._history]
  }

  addHistoryEntry(entry: HistoryEntry): void {
    this._history.push(entry)
  }

  restoreHistory(entries: HistoryEntry[]): void {
    this._history = entries
    if (entries.length > 0) {
      this._lastNotableDay = entries[entries.length - 1].day
    }
    for (const entry of entries) {
      this._seenEventKeys.add(`restored:${entry.day}:${entry.text}`)
      if (entry.text.includes('hormigas') || entry.text.includes('Hormigas')) {
        this._hadAnts = true
      }
      if (entry.text.includes('vitalidad mínima')) this._lowVitalityNoted = true
      if (entry.text.includes('nutrientes al límite')) this._lowNutrientsNoted = true
    }
  }

  private _updateInfo(state: UIState): void {
    for (const ind of this._envIndicators) {
      const show = ind.visible(state)
      ind.el.style.display = show ? '' : 'none'
      if (show) ind.update(state)
    }
    for (const ind of this._plantIndicators) {
      const show = ind.visible(state)
      ind.el.style.display = show ? '' : 'none'
      if (show) ind.update(state)
    }

    const h = this._plantIndicators[0].el
    h.className = `indicator ${state.health > this._prevHealth + 1 ? 'up' : state.health < this._prevHealth - 1 ? 'down' : ''}`

    const v = this._plantIndicators[1].el
    v.className = `indicator ${state.vitality > this._prevVitality + 1 ? 'up' : state.vitality < this._prevVitality - 1 ? 'down' : ''}`

    const e = this._plantIndicators[2].el
    e.className = `indicator ${state.energy > this._prevEnergy + 1 ? 'up' : state.energy < this._prevEnergy - 1 ? 'down' : ''}`

    const st = this._plantIndicators[3].el
    st.className = `indicator ${state.stress > this._prevStress + 1 ? 'up' : state.stress < this._prevStress - 1 ? 'down' : ''}`

    const n = this._plantIndicators[4].el
    n.className = `indicator ${state.nutrients > this._prevNutrients + 1 ? 'up' : state.nutrients < this._prevNutrients - 1 ? 'down' : ''}`

    const l = this._plantIndicators[6].el
    l.className = `indicator ${state.leaves > this._prevLeaves + 0.5 ? 'up' : state.leaves < this._prevLeaves - 0.5 ? 'down' : ''}`
  }

  private _updateNarrative(state: UIState, deltaMs: number): void {
    this._phraseTimer += deltaMs

    if (this._phraseTimer > 6000 || this._narrative === '') {
      this._phraseTimer = 0

      const ctx: NarrativeContext = {
        sunlight: state.sunlight,
        temperature: state.temperature,
        humidity: state.humidity,
        wind: state.wind,
        rain: state.rain,
        health: state.health,
        vitality: state.vitality,
        energy: state.energy,
        stress: state.stress,
        age: state.age,
        flowers: state.flowers,
        fruits: state.fruits,
        leaves: state.leaves,
        season: state.season,
        hour: state.hour,
        hasFauna: state.hasFauna,
        isLatent: state.isLatent,
        biomass: state.biomass,
        hydration: state.hydration,
        nutrients: state.nutrients,
        activeAntCount: state.activeAntCount,
        deadLeafCount: state.deadLeafCount,
        nutrientsRising: state.nutrients > this._prevNutrients + 0.5,
        vitalityRising: state.vitality > this._prevVitality + 0.5,
        energyRising: state.energy > this._prevEnergy + 0.5,
        atLowVitality: state.vitality <= STAT_FLOOR + 6,
        atLowEnergy: state.energy <= STAT_FLOOR + 6,
        atLowNutrients: state.nutrients <= STAT_FLOOR + 6,
      }

      const newNarrative = generateNarrative(ctx)
      if (newNarrative !== this._narrative) {
        this._narrativeEl.style.opacity = '0'
        setTimeout(() => {
          this._narrative = newNarrative
          this._narrativeEl.textContent = this._narrative
          this._narrativeEl.style.opacity = '0.8'
        }, 400)
      }
    }
  }

  private _checkTransitions(state: UIState): void {
    const day = Math.floor(state.age)
    const floor = STAT_FLOOR + 1

    if (state.activeAntCount > 0 && !this._hadAnts) {
      this._addHistory(day, 'Primeras hormigas en la maceta')
    }

    if (state.vitality <= floor && !this._lowVitalityNoted) {
      this._addHistory(day, 'Vitalidad en el mínimo')
      this._lowVitalityNoted = true
    }
    if (state.vitality > 15 && this._lowVitalityNoted && this._prevVitality <= floor + 2) {
      this._addHistory(day, 'La vitalidad despierta de nuevo')
      this._lowVitalityNoted = false
    }

    if (state.nutrients <= floor && !this._lowNutrientsNoted) {
      this._addHistory(day, 'Nutrientes al límite')
      this._lowNutrientsNoted = true
    }
    if (state.nutrients > 20 && this._lowNutrientsNoted && this._prevNutrients <= floor + 2) {
      this._addHistory(day, 'El suelo vuelve a nutrir la planta')
      this._lowNutrientsNoted = false
    }

    if (this._prevVitality <= 10 && state.vitality > 10 && !this._hasRecentText('Vitalidad supera el umbral bajo', day)) {
      this._addHistory(day, 'Vitalidad supera el umbral bajo')
    }
    if (this._prevVitality <= 35 && state.vitality > 35 && !this._hasRecentText('Vitalidad en recuperación', day)) {
      this._addHistory(day, 'Vitalidad en recuperación')
    }
    if (this._prevVitality <= 60 && state.vitality > 60 && !this._hasRecentText('Vitalidad plena', day)) {
      this._addHistory(day, 'Vitalidad plena: lista para florecer')
    }

    if (this._prevSeason && this._prevSeason !== state.season) {
      const seasonNames: Record<string, string> = {
        spring: 'Primavera',
        summer: 'Verano',
        autumn: 'Otoño',
        winter: 'Invierno',
      }
      const name = seasonNames[state.season] ?? state.season
      this._addHistory(day, `Llega el ${name.toLowerCase()}`)
      if (state.season === 'autumn') {
        this._addHistory(day, 'Las hojas caídas abonan la maceta')
      }
      if (state.season === 'winter') {
        this._addHistory(day, 'Absorción lenta invernal')
      }
    }

    if (this._prevIsLatent && !state.isLatent && !this._hasRecentText('Recuperación tras latencia', day)) {
      this._addHistory(day, 'Recuperación tras latencia')
    }

    if (state.season === 'autumn' && state.deadLeafCount > 0 && state.nutrients > this._prevNutrients + 0.3) {
      if (!this._hasRecentText('Abono otoñal', day)) {
        this._addHistory(day, 'Abono otoñal enriquece el suelo')
      }
    }

    if (state.activeAntCount > 0 && state.nutrients > this._prevNutrients + 0.3) {
      if (!this._hasRecentText('Hormigas aportan nutrientes', day)) {
        this._addHistory(day, 'Hormigas aportan nutrientes al suelo')
      }
    }
  }

  private _hasRecentText(text: string, day: number, withinDays = 3): boolean {
    return this._history.some(e => e.text.includes(text) && day - e.day <= withinDays)
  }

  private _checkDailyHistory(state: UIState): void {
    const currentDay = Math.floor(state.age)
    if (currentDay <= this._lastNotableDay) return

    if (currentDay === 1 && !this._history.some(e => e.day === 1)) {
      this._addHistory(currentDay, 'Primer brote')
    } else if (state.leaves >= 4 && !this._history.some(e => e.text.includes('Primeras hojas'))) {
      this._addHistory(currentDay, 'Primeras hojas verdaderas')
    } else if (state.flowers >= 1 && !this._history.some(e => e.text.includes('Primera flor'))) {
      this._addHistory(currentDay, 'Primera flor')
    } else if (state.fruits >= 1 && !this._history.some(e => e.text.includes('Primer fruto'))) {
      this._addHistory(currentDay, 'Primer fruto')
    } else if (state.isLatent && !this._history.some(e => e.text.includes('estado latente') && currentDay - e.day < 5)) {
      this._addHistory(currentDay, 'Entró en estado latente')
    }

    this._lastNotableDay = currentDay
  }

  private _addHistory(day: number, text: string): void {
    const entry: HistoryEntry = { day, text, timestamp: Date.now() }
    this._history.push(entry)
  }

  destroy(): void {
    this._container.remove()
  }
}
