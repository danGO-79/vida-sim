import type { FaunaEntity } from '@vida/ecosystem-engine'
import { colorFromRGB, darken, colorToCSS } from './math'

export function drawFauna(ctx: CanvasRenderingContext2D, fauna: FaunaEntity[], potCX: number, potTopY: number, swayTime: number): void {
  for (const f of fauna) {
    const lifeRatio = f.life / f.maxLife
    const bob = Math.sin(swayTime * 3 + f.x * 2) * 2
    const x = potCX + f.x * 1.5
    const y = potTopY - 40 - f.y * 1.2

    switch (f.type) {
      case 'bee':
        _drawBee(ctx, x, y + bob, lifeRatio, swayTime + f.x, f.x)
        break
      case 'butterfly':
        _drawButterfly(ctx, x, y + bob * 0.5, lifeRatio, swayTime + f.x)
        break
      case 'ladybug':
        _drawLadybug(ctx, x, y + (f.landed ? 0 : bob), lifeRatio, swayTime + f.x, f.landed ?? false)
        break
      case 'firefly':
        _drawFirefly(ctx, x, y + bob, lifeRatio, swayTime + f.x)
        break
      case 'mosquito':
        _drawMosquito(ctx, x, y + bob, lifeRatio, swayTime + f.x)
        break
      case 'ant':
        _drawAnt(ctx, f.x, f.y, lifeRatio, swayTime + f.x, f.direction ?? 1)
        break
      case 'bird':
        _drawBird(ctx, x, y, lifeRatio, swayTime + f.x)
        break
    }
  }
}

function _drawMosquito(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number): void {
  const bodyColor = colorFromRGB(0.12, 0.12, 0.13)
  const wingColor = colorFromRGB(0.7, 0.75, 0.8)
  const hover = Math.sin(t * 8) * 1.5
  const wingFlap = Math.pow(Math.abs(Math.sin(t * 12)), 2) * 2.5

  ctx.save()
  ctx.translate(x, y + hover)

  ctx.fillStyle = colorToCSS(bodyColor, life)
  ctx.beginPath()
  ctx.ellipse(0, 0, 1, 1.8, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorToCSS(colorFromRGB(0.25, 0.22, 0.2), life)
  ctx.beginPath()
  ctx.arc(0, -1.8, 0.6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorToCSS(wingColor, life * 0.5)
  ctx.beginPath()
  ctx.ellipse(-1.5, -0.5, 2, wingFlap * 0.3 + 0.3, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(1.5, -0.5, 2, wingFlap * 0.3 + 0.3, 0.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = colorToCSS(darken(bodyColor, 0.2), life * 0.5)
  ctx.lineWidth = 0.2
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      ctx.beginPath()
      ctx.moveTo(i * 0.5, j * 0.3)
      ctx.lineTo(i * 2, j * 1.5 + 1)
      ctx.stroke()
    }
  }

  ctx.restore()
}

function _drawBee(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number, idX: number): void {
  const bodyColor = colorFromRGB(0.9, 0.7, 0.1)
  const darkColor = colorFromRGB(0.15, 0.1, 0.05)
  const wingColor = colorFromRGB(0.85, 0.85, 0.9)
  const wingFlap = Math.pow(Math.abs(Math.sin(t * 8)), 1.5) * 3
  const zigzag = Math.sin(t * 1.7 + idX) * 4

  const bx = x + zigzag * 0.3
  const by = y

  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(Math.sin(t * 2) * 0.1)

  ctx.fillStyle = colorToCSS(bodyColor, life)
  ctx.beginPath()
  ctx.ellipse(0, 0, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorToCSS(darkColor, life)
  ctx.fillRect(-1.5, -1.8, 1, 0.8)
  ctx.fillRect(0.5, -1.8, 1, 0.8)
  ctx.fillRect(-1.5, 1, 1, 0.8)
  ctx.fillRect(0.5, 1, 1, 0.8)

  ctx.fillStyle = colorToCSS(darkColor, life)
  ctx.beginPath()
  ctx.arc(-1.8, -0.5, 0.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorToCSS(wingColor, life * 0.6)
  ctx.beginPath()
  ctx.ellipse(-2, -2 - wingFlap * 0.5, 2, wingFlap * 0.5 + 0.5, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(2, -2 - wingFlap * 0.5, 2, wingFlap * 0.5 + 0.5, 0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function _drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number): void {
  const wingPhase = t * 3
  const leftFlap = Math.abs(Math.sin(wingPhase)) * 4
  const rightFlap = Math.abs(Math.sin(wingPhase + 0.3)) * 4

  const upperWingColor = colorFromRGB(0.9, 0.5, 0.3)
  const lowerWingColor = colorFromRGB(0.8, 0.4, 0.2)
  const bodyColor = colorFromRGB(0.2, 0.15, 0.3)

  ctx.save()
  ctx.translate(x, y)

  ctx.fillStyle = colorToCSS(upperWingColor, life)
  ctx.beginPath()
  ctx.moveTo(-1, 0)
  ctx.bezierCurveTo(-3 - leftFlap, -3, -4 - leftFlap, -6, -1, -5)
  ctx.bezierCurveTo(0, -4, 0, -1, -1, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(1, 0)
  ctx.bezierCurveTo(3 + rightFlap, -3, 4 + rightFlap, -6, 1, -5)
  ctx.bezierCurveTo(0, -4, 0, -1, 1, 0)
  ctx.fill()

  ctx.fillStyle = colorToCSS(lowerWingColor, life)
  ctx.beginPath()
  ctx.moveTo(-1, 0)
  ctx.bezierCurveTo(-2 - leftFlap * 0.5, 1, -3 - leftFlap * 0.5, 3, -1, 3)
  ctx.bezierCurveTo(0, 2, 0, 1, -1, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(1, 0)
  ctx.bezierCurveTo(2 + rightFlap * 0.5, 1, 3 + rightFlap * 0.5, 3, 1, 3)
  ctx.bezierCurveTo(0, 2, 0, 1, 1, 0)
  ctx.fill()

  ctx.fillStyle = colorToCSS(bodyColor, life)
  ctx.beginPath()
  ctx.ellipse(0, -1, 0.6, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = colorToCSS(darken(bodyColor, 0.2), life)
  ctx.lineWidth = 0.3
  ctx.beginPath()
  ctx.arc(-0.5, -1.5, 0.3, 0, Math.PI)
  ctx.stroke()

  ctx.restore()
}

function _drawLadybug(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number, landed: boolean): void {
  const bodyBob = landed ? Math.sin(t * 2) * 0.3 : Math.sin(t * 3) * 1.5
  const bodyTilt = landed ? Math.sin(t * 1.5) * 0.04 : Math.sin(t * 2.5) * 0.15
  const bodyColor = colorFromRGB(0.9, 0.15, 0.1)
  const spotColor = colorFromRGB(0.05, 0.05, 0.05)
  const headColor = colorFromRGB(0.1, 0.1, 0.1)

  ctx.save()
  ctx.translate(x, y + bodyBob)
  ctx.rotate(bodyTilt)

  ctx.fillStyle = colorToCSS(bodyColor, life)
  ctx.beginPath()
  ctx.ellipse(0, 0, 3, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()

  if (!landed) {
    const wingFlap = Math.pow(Math.abs(Math.sin(t * 7)), 1.5) * 2.5
    ctx.fillStyle = colorToCSS(colorFromRGB(0.8, 0.8, 0.85), life * 0.35)
    ctx.beginPath()
    ctx.ellipse(-2.8, -0.5, wingFlap, 1.2, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(2.8, -0.5, wingFlap, 1.2, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = colorToCSS(headColor, life)
  ctx.beginPath()
  ctx.arc(-2, -0.5, 1, 0, Math.PI * 2)
  ctx.fill()

  if (landed) {
    ctx.strokeStyle = colorToCSS(headColor, life * 0.6)
    ctx.lineWidth = 0.2
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath()
      ctx.moveTo(-1.8 + side * 0.2, -1.2)
      ctx.quadraticCurveTo(-3 + side * 0.5, -3, -2 + side * 2 + Math.sin(t * 2.5 + side * 3) * 0.4, -3.5)
      ctx.stroke()
    }
  }

  ctx.fillStyle = colorToCSS(spotColor, life * 0.8)
  ctx.beginPath()
  ctx.arc(-0.5, -1, 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0.8, 0.5, 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-1, 1, 0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = colorToCSS(darken(bodyColor, 0.2), life)
  ctx.lineWidth = 0.3
  ctx.beginPath()
  ctx.moveTo(0, -2.5)
  ctx.lineTo(0, 2.5)
  ctx.stroke()

  ctx.strokeStyle = colorToCSS(headColor, life * 0.6)
  ctx.lineWidth = 0.3
  const legPhase = landed ? Math.sin(t * 4) : Math.sin(t * 2.5) * 0.4
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = -1; leg <= 1; leg += 2) {
      const ly = leg * 1.2 + legPhase * 0.3 * side * leg * (landed ? 1 : 0.3)
      ctx.beginPath()
      ctx.moveTo(side * 1.5, ly * 0.5)
      ctx.lineTo(side * 2.5, ly)
      ctx.stroke()
    }
  }

  ctx.restore()
}

function _drawFirefly(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number): void {
  const pulse = (Math.sin(t * 5) * 0.5 + 0.5)
  const glowIntensity = pulse * life
  const glowColor = colorFromRGB(1, 0.95, 0.7)

  const glowR = 10 + pulse * 6
  const gr = ctx.createRadialGradient(x, y, 0, x, y, glowR)
  gr.addColorStop(0, colorToCSS(glowColor, glowIntensity * 0.9))
  gr.addColorStop(0.3, colorToCSS(glowColor, glowIntensity * 0.35))
  gr.addColorStop(1, colorToCSS(glowColor, 0))
  ctx.fillStyle = gr
  ctx.beginPath()
  ctx.arc(x, y, glowR, 0, Math.PI * 2)
  ctx.fill()

  const bodyColor = colorFromRGB(0.15, 0.15, 0.12)
  ctx.fillStyle = colorToCSS(bodyColor, life)
  ctx.beginPath()
  ctx.ellipse(x, y, 1, 1.8, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorToCSS(glowColor, glowIntensity)
  ctx.beginPath()
  ctx.arc(x, y + 1.2, 0.8, 0, Math.PI * 2)
  ctx.fill()
}

function _drawAnt(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number, direction: number): void {
  const bodyColor = colorFromRGB(0.12, 0.08, 0.05)
  const legColor = darken(bodyColor, 0.1)

  ctx.save()
  ctx.translate(x, y)
  if (direction < 0) ctx.scale(-1, 1)

  const legWave = Math.sin(t * 12) * 0.5
  const bodyBob = Math.sin(t * 8) * 0.3

  ctx.fillStyle = colorToCSS(bodyColor, life)
  ctx.beginPath()
  ctx.ellipse(0, bodyBob, 1.5, 1, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(-1.5, bodyBob, 0.8, 0.6, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(1.5, bodyBob, 0.6, 0.5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = colorToCSS(legColor, life * 0.8)
  ctx.lineWidth = 0.3
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = 0; leg < 3; leg++) {
      const legPhase = leg + legWave * (leg % 2 === 0 ? 1 : -1)
      const lx = (leg - 1) * 1.2
      const ly = bodyBob + side * 0.5
      const footX = lx + Math.sin(legPhase) * 0.8
      const footY = ly + side * 1.5
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(footX, footY)
      ctx.stroke()
    }
  }

  ctx.strokeStyle = colorToCSS(bodyColor, life * 0.6)
  ctx.lineWidth = 0.2
  ctx.beginPath()
  ctx.moveTo(-2.5, bodyBob - 0.3)
  ctx.lineTo(-4, bodyBob - 1.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-2.5, bodyBob + 0.3)
  ctx.lineTo(-4, bodyBob + 1.5)
  ctx.stroke()

  ctx.restore()
}

function _drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, t: number): void {
  const bodyColor = colorFromRGB(0.12, 0.08, 0.05)
  const wingPhase = Math.sin(t * 4)
  const wingLift = Math.abs(wingPhase) * 4
  const lifeAlpha = life

  ctx.save()
  ctx.translate(x, y)

  ctx.fillStyle = colorToCSS(bodyColor, lifeAlpha)
  ctx.beginPath()
  ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(4, -0.5, 1.6, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.lineTo(-8, -2.5)
  ctx.lineTo(-7, 0)
  ctx.lineTo(-8, 2.5)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = colorToCSS(darken(bodyColor, 0.08), lifeAlpha * 0.9)
  ctx.beginPath()
  ctx.moveTo(-1, -1)
  ctx.quadraticCurveTo(0, -2 - wingLift, 3, -2 - wingLift * 0.8)
  ctx.quadraticCurveTo(2, -1, -1, -1)
  ctx.closePath()
  ctx.fill()

  const lowerLift = Math.abs(wingPhase) * 1.5
  ctx.beginPath()
  ctx.moveTo(-1, 1)
  ctx.quadraticCurveTo(0, 1 + lowerLift, 3, 1 + lowerLift * 0.6)
  ctx.quadraticCurveTo(2, 1, -1, 1)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}
