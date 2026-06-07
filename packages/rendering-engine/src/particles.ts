import { colorFromRGB, colorToCSS, clamp } from './math'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  type: 'rain' | 'pollen' | 'leaf' | 'glow' | 'snow'
  color: number
  rotation: number
  rotSpeed: number
}

const MAX_PARTICLES = 100

export class ParticleSystem {
  private _particles: Particle[] = []

  update(deltaS: number, sunlight: number, rain: number, hasFlowers: boolean, health: number, wind: number, season: string, swayTime: number, w: number, h: number, ctx: CanvasRenderingContext2D): void {
    this._spawn(deltaS, sunlight, rain, hasFlowers, health, wind, season, w, h)
    this._simulate(deltaS, wind, swayTime)
    this._render(ctx, w, h)
  }

  spawnLeafDrops(sites: { x: number; y: number }[], wind: number, season: string): void {
    const leafCount = this._particles.filter(p => p.type === 'leaf').length
    const maxNew = Math.min(sites.length, Math.max(0, 15 - leafCount))
    for (let i = 0; i < maxNew; i++) {
      const site = sites[i % sites.length]
      const autumn = season === 'autumn'
      this._particles.push({
        x: site.x + (Math.random() - 0.5) * 8,
        y: site.y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 10 - wind * 0.08,
        vy: 2 + Math.random() * 5,
        life: 4 + Math.random() * 5,
        maxLife: 9,
        size: 2.5 + Math.random() * 2,
        type: 'leaf',
        color: colorFromRGB(
          0.65 + Math.random() * 0.25,
          autumn ? 0.35 + Math.random() * 0.25 : 0.45 + Math.random() * 0.2,
          autumn ? 0.08 + Math.random() * 0.1 : 0.12 + Math.random() * 0.12
        ),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3
      })
    }
  }

  private _spawn(deltaS: number, sunlight: number, rain: number, hasFlowers: boolean, health: number, wind: number, season: string, w: number, h: number): void {
    const snowActive = season === 'winter' && rain > 15 && sunlight < 75
    if (snowActive && this._particles.filter(p => p.type === 'snow').length < 25) {
      const intensity = clamp((rain / 100) * (1 - sunlight / 90), 0.05, 0.8)
      const count = Math.floor(deltaS * 6 * intensity)
      for (let i = 0; i < count && this._particles.length < MAX_PARTICLES; i++) {
        this._particles.push({
          x: Math.random() * w * 1.5 - w * 0.25,
          y: -10 - Math.random() * 30,
          vx: -3 + Math.random() * 5 - wind * 0.2,
          vy: 10 + Math.random() * 15,
          life: 5 + Math.random() * 8,
          maxLife: 13,
          size: 2 + Math.random() * 2,
          type: 'snow',
          color: colorFromRGB(0.95, 0.96, 1),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 1.5
        })
      }
    }

    if (season !== 'winter' && rain > 5 && this._particles.filter(p => p.type === 'rain').length < 50) {
      const rate = season === 'autumn' ? 1.5 : season === 'summer' ? 0.3 : 1
      const count = Math.floor(rain / 20 * deltaS * 8 * rate)
      for (let i = 0; i < count && this._particles.length < MAX_PARTICLES; i++) {
        const vy = 100 + Math.random() * 80
        const fallDist = h + 20
        const life = fallDist / vy
        this._particles.push({
          x: Math.random() * w,
          y: -10,
          vx: -2 + Math.random() * 3 - wind,
          vy,
          life,
          maxLife: life,
          size: 1 + Math.random() * 0.8,
          type: 'rain',
          color: colorFromRGB(0.6, 0.7, 0.9),
          rotation: 0,
          rotSpeed: 0
        })
      }
    }

    if (hasFlowers && sunlight > 30 && this._particles.filter(p => p.type === 'pollen').length < 25) {
      if (Math.random() < deltaS * 0.5) {
        const count = 1 + Math.floor(Math.random() * 3)
        for (let i = 0; i < count && this._particles.length < MAX_PARTICLES; i++) {
          this._particles.push({
            x: w * 0.3 + Math.random() * w * 0.4,
            y: h * 0.3 + Math.random() * h * 0.3,
            vx: (Math.random() - 0.5) * 5,
            vy: -1 - Math.random() * 3,
            life: 3 + Math.random() * 4,
            maxLife: 7,
            size: 1.5 + Math.random() * 1.5,
            type: 'pollen',
            color: colorFromRGB(0.92 + Math.random() * 0.06, 0.8 + Math.random() * 0.1, 0.2 + Math.random() * 0.15),
            rotation: 0,
            rotSpeed: 0
          })
        }
      }
    }

    if (season === 'autumn' && this._particles.filter(p => p.type === 'leaf').length < 8) {
      if (Math.random() < deltaS * 0.15) {
        this._particles.push({
          x: w * 0.1 + Math.random() * w * 0.8,
          y: h * 0.15 + Math.random() * h * 0.2,
          vx: (Math.random() - 0.5) * 12,
          vy: 3 + Math.random() * 6,
          life: 5 + Math.random() * 6,
          maxLife: 11,
          size: 3 + Math.random() * 2,
          type: 'leaf',
          color: colorFromRGB(0.75 + Math.random() * 0.2, 0.35 + Math.random() * 0.25, 0.08 + Math.random() * 0.1),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 3
        })
      }
    }

    if (health < 50 && season !== 'winter' && this._particles.filter(p => p.type === 'leaf').length < 8) {
      if (Math.random() < deltaS * (1 - health / 50) * 0.3) {
        this._particles.push({
          x: w * 0.2 + Math.random() * w * 0.6,
          y: h * 0.2 + Math.random() * h * 0.3,
          vx: (Math.random() - 0.5) * 15,
          vy: 4 + Math.random() * 8,
          life: 4 + Math.random() * 5,
          maxLife: 9,
          size: 3 + Math.random() * 2.5,
          type: 'leaf',
          color: colorFromRGB(0.6 + Math.random() * 0.3, 0.3 + Math.random() * 0.25, 0.08 + Math.random() * 0.1),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 4
        })
      }
    }
  }

private _simulate(deltaS: number, wind: number, swayTime: number): void {
    const windFactor = clamp(wind / 33.33, 0, 1) * 0.5
    for (const p of this._particles) {
      p.x += p.vx * deltaS
      p.y += p.vy * deltaS
      p.life -= deltaS
      p.rotation += p.rotSpeed * deltaS

      if (p.type === 'rain') {
        p.vx += windFactor * deltaS * 30
        if (wind > 20) {
          p.vx += (wind - 20) * 0.5 * deltaS
        }
      }

      if (p.type === 'snow') {
        p.vx += Math.sin(swayTime * 0.5 + p.life * 2) * deltaS * 4
        p.vx += windFactor * deltaS * 8
        p.vy += Math.sin(p.life * 3 + swayTime) * deltaS * 2
        if (wind > 20) {
          p.vx += (wind - 20) * 0.3 * deltaS
        }
      }

      if (p.type === 'leaf') {
        p.vx += Math.sin(p.life * 3 + swayTime * 2) * deltaS * 8
        p.vx += windFactor * deltaS * 30
        p.rotSpeed += (Math.random() - 0.5) * deltaS * 2
      }

      if (p.type === 'pollen') {
        p.vx += Math.sin(swayTime * 0.5 + p.life * 0.5) * deltaS * 2
        p.vy += Math.cos(swayTime * 0.4 + p.life * 0.7) * deltaS * 2
      }
    }

    this._particles = this._particles.filter(p => p.life > 0 && p.y < 450)
  }

  private _render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const p of this._particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3))
      if (alpha < 0.01 || p.y < -20 || p.y > h + 20) continue

      if (p.type === 'rain') {
        ctx.strokeStyle = colorToCSS(p.color, alpha * 0.5)
        ctx.lineWidth = p.size * 0.3
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x + p.vx * 0.04, p.y + 5)
        ctx.stroke()
      } else if (p.type === 'snow') {
        ctx.fillStyle = colorToCSS(p.color, alpha * (0.5 + Math.sin(p.rotation + p.x) * 0.15))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = colorToCSS(p.color, alpha * 0.3)
        ctx.beginPath()
        ctx.arc(p.x + 0.5, p.y + 0.3, p.size * 0.15, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.type === 'pollen') {
        ctx.fillStyle = colorToCSS(p.color, alpha * 0.6)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.type === 'leaf') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = colorToCSS(p.color, alpha)
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      } else if (p.type === 'glow') {
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        gr.addColorStop(0, colorToCSS(p.color, alpha * 0.5))
        gr.addColorStop(1, colorToCSS(p.color, 0))
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  clear(): void {
    this._particles = []
  }
}
