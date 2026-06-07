import { colorFromRGB, colorToCSS } from './math'

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function drawLightingOverlay(ctx: CanvasRenderingContext2D, sunlight: number, hour: number, w: number, h: number, lightningIntensity: number = 0): void {
  const dayFactor = sunlight / 100

  const nightAlpha = hour < 5 ? 0.45
    : hour < 7.5 ? 0.45 * (1 - smoothstep(5, 7.5, hour))
    : hour > 21 ? 0.45
    : hour > 19 ? 0.45 * smoothstep(19, 21, hour)
    : 0

  if (nightAlpha > 0.01) {
    const nightProgress = hour < 6
      ? (6 - hour) / 6
      : (hour - 20) / 4
    const nc = colorFromRGB(0.05, 0.05, 0.15 + nightProgress * 0.1)
    ctx.fillStyle = colorToCSS(nc, nightAlpha * 0.65)
    ctx.fillRect(0, 0, w, h)
  }

  const sunGlow = Math.max(0, dayFactor - 0.3) * 0.3
  if (sunGlow > 0.001) {
    const cx = Math.cos((hour - 6) / 14 * Math.PI) * 80 + w / 2
    const cy = Math.sin((hour - 6) / 14 * Math.PI) * 80 + h * 0.3
    const glowSize = 60

    const warmColor = colorFromRGB(1, 0.9, 0.6)
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize)
    gr.addColorStop(0, colorToCSS(warmColor, sunGlow * 0.15))
    gr.addColorStop(1, colorToCSS(warmColor, 0))
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(cx, cy, glowSize, 0, Math.PI * 2)
    ctx.fill()
  }

  if (lightningIntensity > 0.01) {
    const alpha = lightningIntensity * 0.28
    ctx.fillStyle = `rgba(220,230,255,${alpha})`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

export { drawLightningBolt, generateLightningBolt } from './lightning'
export type { LightningBolt } from './lightning'
