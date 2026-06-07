export type NarrativeContext = {
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
  season: string
  hour: number
  hasFauna: boolean
  isLatent: boolean
  biomass: number
  hydration: number
  nutrients: number
  activeAntCount: number
  deadLeafCount: number
  nutrientsRising: boolean
  vitalityRising: boolean
  energyRising: boolean
  atLowVitality: boolean
  atLowEnergy: boolean
  atLowNutrients: boolean
}

const NIGHT_PHRASES = [
  'La planta descansa en la oscuridad',
  'Silencio bajo la luna',
  'Las hojas se cierran con la noche',
  'El rocío comienza a formarse',
  'Todo está en calma',
]

const MORNING_PHRASES = [
  'Primera luz del día',
  'Las hojas reciben el amanecer',
  'El rocío brilla en las hojas',
  'Un nuevo día comienza',
  'La luz despierta la planta',
]

const DAY_PHRASES = [
  'Fotosíntesis activa',
  'La planta absorbe la luz del sol',
  'Las hojas se extienden hacia la luz',
  'Crecimiento constante',
  'La savia fluye con energía',
]

const WEAK_PHOTOSYNTHESIS_PHRASES = [
  'Fotosíntesis tenue, pero persistente',
  'Un hilo de luz basta para seguir adelante',
  'Las hojas aún captan algo de sol',
  'Energía mínima bajo la luz del día',
]

const HEALTHY_PHRASES = [
  'La planta se ve vigorosa',
  'Condiciones óptimas',
  'Verde intenso y saludable',
  'La planta respira con fuerza',
  'Todo en equilibrio',
]

const STRESSED_PHRASES = [
  'La planta muestra signos de estrés',
  'Las hojas pierden turgencia',
  'Recuperación lenta',
  'La planta necesita condiciones más favorables',
  'Ritmo pausado, recuperación en curso',
]

const RECOVERY_PHRASES = [
  'La vitalidad vuelve poco a poco',
  'Reservas en alza, ritmo más estable',
  'La planta se repone con calma',
  'Recuperación en curso',
  'El equilibrio regresa lentamente',
]

const LOW_VITALITY_PHRASES = [
  'Metabolismo al mínimo, aguardando mejores tiempos',
  'La savia apenas circula',
  'Resistencia en el límite',
  'Cada reserva cuenta',
]

const LOW_NUTRIENTS_PHRASES = [
  'La tierra pide nutrientes',
  'Las raíces buscan alimento en el sustrato',
  'El suelo está pobre',
]

const NUTRIENTS_RISING_PHRASES = [
  'Las raíces absorben nutrientes',
  'La tierra devuelve lo que la planta necesita',
  'El sustrato se enriquece',
  'Nutrientes en ascenso',
]

const ANT_PHRASES = [
  'Un grupo de hormigas enriquece la tierra',
  'Las hormigas cruzan la maceta',
  'Actividad en el suelo: las hormigas aportan materia orgánica',
  'Pequeñas visitantes trabajan la tierra',
]

const AUTUMN_PHRASES = [
  'Las hojas caídas abonan la maceta',
  'El otoño devuelve materia al suelo',
  'Hojas secas se convierten en abono',
  'La tierra se recarga con el otoño',
]

const WINTER_PHRASES = [
  'Absorción lenta invernal',
  'Las raíces siguen activas bajo el frío',
  'El invierno pide paciencia',
  'Nutrientes escasos, pero la raíz persiste',
]

const AUTUMN_RAIN_PHRASES = [
  'Lluvia otoñal que alimenta la tierra',
  'Gotas de otoño enriquecen el sustrato',
  'La lluvia y las hojas caídas renuevan el suelo',
]

const FLOWER_PHRASES = [
  'Floración inminente',
  'Pequeñas flores comienzan a abrirse',
  'El color de las flores alegra la escena',
  'Polinización en curso',
  'Las flores se mecen con el viento',
]

const FRUIT_PHRASES = [
  'Los frutos maduran lentamente',
  'Pequeños frutos se forman entre las hojas',
  'La planta ofrece sus frutos',
  'Frutos de un color vibrante',
]

const RAIN_PHRASES = [
  'Lluvia beneficiosa',
  'Gotas de lluvia en cada hoja',
  'La tierra absorbe la lluvia',
  'El agua limpia las hojas',
  'Lluvia suave y constante',
]

const HOT_PHRASES = [
  'El calor aprieta',
  'Las hojas se protegen del sol intenso',
  'La planta consume sus reservas de agua',
  'Ola de calor moderada',
  'La transpiración se acelera',
]

const COLD_PHRASES = [
  'El frío enlentece el metabolismo',
  'La planta se prepara para el frío',
  'Ritmo más lento con las bajas temperaturas',
  'El frío matinal se siente en las hojas',
]

const WIND_PHRASES = [
  'El viento mueve suavemente las hojas',
  'Las ramas se mecen con el aire',
  'Brisa constante',
  'El viento acaricia la planta',
]

const LATENT_PHRASES = [
  'Latencia: la planta espera tiempos mejores',
  'En estado de espera',
  'Metabolismo reducido al mínimo',
  'La planta sobrevive en pausa',
  'Recuperación latente',
]

const FIREFLY_PHRASES = [
  'Luciérnagas iluminan la noche',
  'Diminutas luces bailan alrededor',
  'La noche tiene sus propios visitantes',
]

const DEFAULT_PHRASE = 'Observando...'

export function generateNarrative(ctx: NarrativeContext): string {
  const { sunlight, temperature, rain, health, stress, flowers, fruits, hour, isLatent, season } = ctx
  const candidates: string[] = []

  if (isLatent) {
    candidates.push(...LATENT_PHRASES)
  }

  if (ctx.activeAntCount > 0) {
    candidates.push(...ANT_PHRASES)
  }

  if (season === 'autumn') {
    candidates.push(...AUTUMN_PHRASES)
    if (ctx.deadLeafCount > 0) {
      candidates.push('Hojas muertas nutren el suelo')
    }
  }

  if (season === 'winter') {
    candidates.push(...WINTER_PHRASES)
  }

  if (rain > 30) {
    candidates.push(...RAIN_PHRASES)
    if (season === 'autumn' || season === 'winter') {
      candidates.push(...AUTUMN_RAIN_PHRASES)
    }
  }

  if (ctx.nutrientsRising) {
    candidates.push(...NUTRIENTS_RISING_PHRASES)
  } else if (ctx.atLowNutrients) {
    candidates.push(...LOW_NUTRIENTS_PHRASES)
  }

  if (ctx.vitalityRising || ctx.energyRising) {
    candidates.push(...RECOVERY_PHRASES)
  }

  if (ctx.atLowVitality || ctx.atLowEnergy) {
    candidates.push(...WEAK_PHOTOSYNTHESIS_PHRASES)
    candidates.push(...LOW_VITALITY_PHRASES)
  }

  if (hour >= 5 && hour < 8) {
    candidates.push(...MORNING_PHRASES)
  } else if (hour >= 20 || hour < 5) {
    candidates.push(...NIGHT_PHRASES)
  } else if (hour >= 8 && hour < 18) {
    if (ctx.atLowVitality && sunlight > 20) {
      candidates.push(...WEAK_PHOTOSYNTHESIS_PHRASES)
    } else {
      candidates.push(...DAY_PHRASES)
    }
  }

  if (temperature > 32) {
    candidates.push(...HOT_PHRASES)
  } else if (temperature < 7) {
    candidates.push(...COLD_PHRASES)
  }

  if (health > 80 && stress < 20) {
    candidates.push(...HEALTHY_PHRASES)
  } else if (stress > 50) {
    candidates.push(...STRESSED_PHRASES)
  }

  if (flowers > 0) {
    candidates.push(...FLOWER_PHRASES)
  }

  if (fruits > 0) {
    candidates.push(...FRUIT_PHRASES)
  }

  if (ctx.wind > 40) {
    candidates.push(...WIND_PHRASES)
  }

  if (ctx.hasFauna && sunlight < 10) {
    candidates.push(...FIREFLY_PHRASES)
  }

  if (candidates.length === 0) {
    candidates.push(DEFAULT_PHRASE)
  }

  const seed = Math.floor(ctx.age * 10 + sunlight + temperature + ctx.nutrients)
  return candidates[seed % candidates.length]
}
