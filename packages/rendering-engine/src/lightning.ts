export type LightningPoint = { x: number; y: number }

export type LightningBranch = {
  fromIndex: number
  points: LightningPoint[]
}

export type LightningBolt = {
  main: LightningPoint[]
  branches: LightningBranch[]
}

function drawBoltPath(ctx: CanvasRenderingContext2D, points: LightningPoint[]): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
}

function resetCanvasShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

export function generateLightningBolt(w: number, h: number): LightningBolt {
  const startX = 60 + Math.random() * (w - 120)
  const startY = 25 + Math.random() * 55
  const endY = startY + 90 + Math.random() * Math.min(220, h * 0.55 - startY - 20)
  const segments = 9 + Math.floor(Math.random() * 4)

  const main: LightningPoint[] = [{ x: startX, y: startY }]
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const y = startY + (endY - startY) * t
    const spread = 18 + t * 28
    const x = startX + (Math.random() - 0.5) * spread * 2
    main.push({ x, y })
  }

  const branches: LightningBranch[] = []
  const branchCount = 1 + Math.floor(Math.random() * 2)
  for (let b = 0; b < branchCount; b++) {
    const fromIndex = 2 + Math.floor(Math.random() * Math.max(1, main.length - 4))
    const origin = main[fromIndex]
    const dir = Math.random() < 0.5 ? -1 : 1
    const branchPts: LightningPoint[] = [origin]
    const branchSegs = 2 + Math.floor(Math.random() * 2)
    for (let j = 1; j <= branchSegs; j++) {
      branchPts.push({
        x: origin.x + dir * (12 + j * 14 + Math.random() * 10),
        y: origin.y + 18 + j * 22 + Math.random() * 12
      })
    }
    branches.push({ fromIndex, points: branchPts })
  }

  return { main, branches }
}

export function drawLightningBolt(ctx: CanvasRenderingContext2D, bolt: LightningBolt, intensity: number): void {
  if (intensity <= 0.02) return

  const alpha = Math.min(1, intensity)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  resetCanvasShadow(ctx)

  const paths = [bolt.main, ...bolt.branches.map(b => b.points)]

  ctx.strokeStyle = `rgba(160, 190, 255, ${0.18 * alpha})`
  ctx.lineWidth = 6
  for (const pts of paths) drawBoltPath(ctx, pts)

  ctx.strokeStyle = `rgba(210, 225, 255, ${0.45 * alpha})`
  ctx.lineWidth = 2.8
  for (const pts of paths) drawBoltPath(ctx, pts)

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.92 * alpha})`
  ctx.lineWidth = 1.2
  for (const pts of paths) drawBoltPath(ctx, pts)

  resetCanvasShadow(ctx)
  ctx.restore()
}
