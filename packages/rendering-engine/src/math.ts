export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function colorFromRGB(r: number, g: number, b: number): number {
  const ri = Math.round(clamp(r, 0, 1) * 255)
  const gi = Math.round(clamp(g, 0, 1) * 255)
  const bi = Math.round(clamp(b, 0, 1) * 255)
  return (ri << 16) | (gi << 8) | bi
}

export function darken(color: number, factor: number): number {
  const r = ((color >> 16) & 0xff) * (1 - factor)
  const g = ((color >> 8) & 0xff) * (1 - factor)
  const b = (color & 0xff) * (1 - factor)
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

export function lighten(color: number, factor: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + factor * 255)
  const g = Math.min(255, ((color >> 8) & 0xff) + factor * 255)
  const b = Math.min(255, (color & 0xff) + factor * 255)
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}

export function colorToCSS(color: number, alpha: number = 1): string {
  return `rgba(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff},${alpha})`
}
