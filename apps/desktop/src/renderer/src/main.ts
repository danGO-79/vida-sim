import { Canvas2DRenderer } from '@vida/rendering-engine'
import type { EngineState, DNAColors } from '@vida/rendering-engine'
import { SimulationEngine } from '@vida/simulation-engine'
import type { ArchitectureSnapshot } from '@vida/simulation-engine'
import { GeneticsEngine } from '@vida/genetics-engine'
import { EnvironmentEngine } from '@vida/environment-engine'
import { EcosystemEngine } from '@vida/ecosystem-engine'
import { UIEngine } from '@vida/ui-engine'
import type { UIState } from '@vida/ui-engine'
import { PersistenceEngine } from '@vida/persistence-engine'
import type { SavePayload } from '@vida/persistence-engine'

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`${id} not found`)
  return el
}

const appEl = requireElement('app')
const sidebarContentEl = requireElement('sidebar-content')

let canvas: HTMLCanvasElement
let renderer: Canvas2DRenderer
let genetics: GeneticsEngine
let environment: EnvironmentEngine
let ecosystem: EcosystemEngine
let simulation: SimulationEngine
let ui: UIEngine
let persistence: PersistenceEngine

let saveTimer: ReturnType<typeof setTimeout> | null = null
let isRunning = false
let _frameCount = 0
let _lastTickTime = 0
const TICK_INTERVAL = 200
const MAX_DELTA = 5000
const SIM_TIME_SCALE = 7
const REAL_MS_PER_DAY = 86400000

async function init(): Promise<void> {
  persistence = new PersistenceEngine()
  if (window.electronAPI) {
    persistence.setAPI({
      saveVida: window.electronAPI.saveVida,
      loadVida: window.electronAPI.loadVida,
      clearVida: window.electronAPI.clearVida
    })
  }

  genetics = new GeneticsEngine()
  environment = new EnvironmentEngine()
  ecosystem = new EcosystemEngine()
  simulation = new SimulationEngine(genetics.dna, environment.state, {
    timeScale: SIM_TIME_SCALE
  })

  const savedData = await persistence.load()
  let loadedSimDays = 0
  if (savedData) {
    try {
      loadedSimDays = savedData.totalDaysObserved
      if (savedData.version >= 2 && savedData.architecture) {
        genetics = new GeneticsEngine(savedData.createdAt)
        simulation.restore(savedData.state, savedData.totalDaysObserved)
        simulation.restoreArchitecture(savedData.architecture)
        environment.restore(savedData.environment)
      } else if (savedData.version === 1) {
        genetics = new GeneticsEngine(savedData.createdAt)
        simulation.restore(savedData.state, savedData.totalDaysObserved)
        environment.restore(savedData.environment)
      } else {
        genetics = new GeneticsEngine(savedData.createdAt)
        simulation.restore(savedData.state, savedData.totalDaysObserved)
        environment.restore(savedData.environment)
      }
      environment.syncClock(loadedSimDays)
    } catch {
      console.warn('Save data corrupt, starting fresh')
    }
  }

  canvas = document.createElement('canvas')
  appEl.appendChild(canvas)
  renderer = new Canvas2DRenderer(canvas)
  ui = new UIEngine(appEl, sidebarContentEl)

  if (savedData?.history) {
    ui.restoreHistory(savedData.history)
  }

  isRunning = true
  _lastTickTime = performance.now()
  setTimeout(gameLoop, TICK_INTERVAL)
  setupButtons()
}

function gameLoop(): void {
  if (!isRunning) return
  try {
    const now = performance.now()
    const deltaMs = Math.min(now - _lastTickTime, MAX_DELTA)
    _lastTickTime = now
    const isVisible = !document.hidden
    _frameCount++

    const dayDelta = (deltaMs / REAL_MS_PER_DAY) * SIM_TIME_SCALE
    const nextDays = simulation.simulatedDays + dayDelta

    environment.update(nextDays)
    const env = environment.state

    const preState = simulation.state
    const preArch = simulation.architecture
    const preTotalLeaves = preArch.getTotalLeaves()
    const height = preArch.getHeight()
    ecosystem.update(
      simulation.simulatedDays,
      env.sunlight,
      env.temperature,
      env.humidity,
      preState.flowers > 0,
      preState.fruits > 0,
      env.season,
      env.hour,
      env.rain,
      env.wind,
      Math.max(0, height * 0.8),
      preTotalLeaves
    )

    simulation.setEnvironment(env)
    simulation.setAntCount(ecosystem.activeAntCount)
    simulation.update(deltaMs)

    const state = simulation.state
    const arch = simulation.architecture
    const days = simulation.simulatedDays
    const totalLeaves = arch.getTotalLeaves()
    const totalNodes = arch.getTotalNodes()
    renderer.setFauna(ecosystem.fauna)

    const dnaColors: DNAColors = genetics.dna.colorPalette

    if (isVisible) {
      const engineState: EngineState = {
        flowerCount: state.flowers,
        fruitCount: state.fruits,
        health: state.health,
        vitality: state.vitality,
        sunlight: env.sunlight,
        wind: env.wind,
        rain: env.rain,
        rainProbability: env.rainProbability,
        cloudCover: env.cloudCover,
        hour: env.hour,
        season: env.season,
        humidity: env.humidity,
        day: env.day ?? 0
      }

      renderer.update(engineState, dnaColors, deltaMs, arch.snapshot(), {
        leafSize: genetics.dna.leafSize
      }, simulation.architecture.consumeLeafDrops())
    }

    if (_frameCount % 3 === 0 && isVisible) {
      const uiState: UIState = {
        sunlight: env.sunlight,
        temperature: env.temperature,
        humidity: env.humidity,
        wind: env.wind,
        rain: env.rain,
        health: state.health,
        vitality: state.vitality,
        energy: state.energy,
        stress: state.stress,
        age: state.age,
        flowers: state.flowers,
        fruits: state.fruits,
        leaves: totalLeaves,
        biomass: height,
        hydration: state.hydration,
        nutrients: state.nutrients,
        season: env.season,
        hour: env.hour,
        hasFauna: ecosystem.fauna.length > 0,
        isLatent: state.isLatent,
        personality: genetics.personality,
        totalDaysObserved: state.age,
        activeAntCount: ecosystem.activeAntCount,
        deadLeafCount: arch.getDeadLeafCount(),
      }
      ui.update(uiState, deltaMs)
      ui.ingestEcosystemEvents(ecosystem.events)
    }

    debouncedSave({
      version: 2,
      dna: genetics.dna,
      state: {
        age: state.age, health: state.health, vitality: state.vitality,
        energy: state.energy, hydration: state.hydration, nutrients: state.nutrients,
        stress: state.stress, flowers: state.flowers,
        fruits: state.fruits
      },
      architecture: arch.snapshot(),
      environment: environment.getPersistedState(),
      history: ui.getHistory(),
      createdAt: genetics.createdAt,
      lastSavedAt: Date.now(),
      totalDaysObserved: days,
      personality: genetics.personality
    })
  } catch (e) {
    console.error('[loop]', e)
  }

  setTimeout(gameLoop, TICK_INTERVAL)
}

function setupButtons(): void {
  console.log('[setupButtons]')
  document.getElementById('min-btn')?.addEventListener('click', () => {
    window.electronAPI?.minimizeVida()
  })

  let _sidebarVisible = true
  const sidebarEl = document.getElementById('sidebar')
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn')
  toggleSidebarBtn?.addEventListener('click', () => {
    _sidebarVisible = !_sidebarVisible
    if (sidebarEl) sidebarEl.style.display = _sidebarVisible ? '' : 'none'
    toggleSidebarBtn.textContent = _sidebarVisible ? '◀' : '▶'
    window.electronAPI?.setSidebar(_sidebarVisible)
  })

  const historyBtn = document.getElementById('history-btn')
  const historyModal = document.getElementById('history-modal')
  const historyClose = document.getElementById('history-close')
  const historyList = document.getElementById('history-list')

  const resetBtn = document.getElementById('reset-btn')
  const resetModal = document.getElementById('reset-modal')
  const resetCancel = document.getElementById('reset-cancel')
  const resetConfirm = document.getElementById('reset-confirm')
  const resetSummary = document.getElementById('reset-summary')

  historyBtn?.addEventListener('click', () => {
    console.log('[ui] history btn click')
    if (historyModal && historyList) {
      const entries = ui.getHistory()
      historyList.innerHTML = entries.length
        ? entries.map(e =>
          `<div class="history-entry"><span class="history-day">Día ${e.day}</span><span class="history-text">${e.text}</span></div>`
        ).join('')
        : '<div style="opacity:0.4;text-align:center;padding:12px;">Aún no hay eventos destacados</div>'
      historyModal.classList.add('open')
    }
  })

  historyClose?.addEventListener('click', () => {
    historyModal?.classList.remove('open')
  })
  historyModal?.addEventListener('click', (e) => {
    if (e.target === historyModal) historyModal.classList.remove('open')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      historyModal?.classList.remove('open')
      resetModal?.classList.remove('open')
    }
  })

  resetBtn?.addEventListener('click', () => {
    console.log('[ui] reset btn click')
    if (resetModal && resetSummary) {
      const entries = ui.getHistory()
      const s = simulation.state
      const arch = simulation.architecture
      resetSummary.innerHTML = `
        <div class="summary-grid">
          <span class="summary-label">Edad</span>
          <span class="summary-value">${Math.floor(s.age)} días</span>
          <span class="summary-label">Salud final</span>
          <span class="summary-value">${Math.round(s.health)}%</span>
          <span class="summary-label">Altura</span>
          <span class="summary-value">${Math.round(arch.getHeight())} cm</span>
          <span class="summary-label">Hojas</span>
          <span class="summary-value">${arch.getTotalLeaves()}</span>
          <span class="summary-label">Ramas</span>
          <span class="summary-value">${arch.getBranchCount()}</span>
          <span class="summary-label">Flores</span>
          <span class="summary-value">${Math.round(s.flowers)}</span>
          <span class="summary-label">Frutos</span>
          <span class="summary-value">${Math.round(s.fruits)}</span>
          <span class="summary-label">Personalidad</span>
          <span class="summary-value">${genetics.personality}</span>
          <span class="summary-label">Eventos</span>
          <span class="summary-value">${entries.length}</span>
        </div>`
      resetModal.classList.add('open')
    }
  })

  resetCancel?.addEventListener('click', () => resetModal?.classList.remove('open'))
  resetModal?.addEventListener('click', (e) => {
    if (e.target === resetModal) resetModal.classList.remove('open')
  })

  resetConfirm?.addEventListener('click', async () => {
    resetModal?.classList.remove('open')
    await doReset()
  })

  const quitBtn = document.getElementById('quit-btn')
  quitBtn?.addEventListener('click', () => {
    window.electronAPI?.quitVida()
  })

  const saveBtn = document.getElementById('save-btn')
  const saveFeedback = document.getElementById('save-feedback')
  saveBtn?.addEventListener('click', async () => {
    await saveImmediate()
    if (saveFeedback) {
      saveFeedback.style.opacity = '1'
      setTimeout(() => { saveFeedback.style.opacity = '0' }, 1500)
    }
  })
}

async function doReset(): Promise<void> {
  console.log('[doReset]')
  isRunning = false

  await persistence.clear()

  ui.destroy()
  sidebarContentEl.innerHTML = ''

  genetics = new GeneticsEngine()
  environment = new EnvironmentEngine()
  ecosystem = new EcosystemEngine()
  simulation.reset(genetics.dna, environment.state)
  ui = new UIEngine(appEl, sidebarContentEl)

  isRunning = true
}

async function saveImmediate(): Promise<void> {
  if (!persistence || !simulation) return
  const s = simulation.state
  const arch = simulation.architecture
  const env = environment?.state
  const data: SavePayload = {
    version: 2,
    dna: genetics.dna,
    state: {
      age: s.age, health: s.health, vitality: s.vitality,
      energy: s.energy, hydration: s.hydration, nutrients: s.nutrients,
      stress: s.stress, flowers: s.flowers,
      fruits: s.fruits
    },
    architecture: arch.snapshot(),
    environment: env,
    history: ui?.getHistory() || [],
    createdAt: genetics.createdAt,
    lastSavedAt: Date.now(),
    totalDaysObserved: simulation.simulatedDays,
    personality: genetics.personality
  }
  await persistence.save(data)
}

function debouncedSave(data: SavePayload): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistence.save(data)
  }, 5000)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveImmediate()
})

window.addEventListener('beforeunload', () => {
  saveImmediate()
})

init().catch(console.error)
