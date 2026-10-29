export interface BodyMeasurements {
  gender: 'F' | 'M'
  height: number
  weight: number
  chest: number
  waist: number
  hips: number
  shoulder: number
  inseam: number
}

export interface GarmentMeasurements {
  chestWidth: number | null
  waistWidth: number | null
  hipWidth: number | null
  shoulderWidth: number | null
  length: number | null
  stretchPercent: number
}

export interface FittingVariant {
  id: string
  productId: string
  size: string
  color: string
  colorHex: string
  price: number
  measurements: GarmentMeasurements | null
  modelUrl: string | null
}

export function isReferenceMeasurements(name: string, category: string, size: string, garment: GarmentMeasurements): boolean {
  const lowerName = name.toLowerCase()
  const lowerCategory = category.toLowerCase()
  const type = /jean|pantal|falda|short/.test(lowerName) || /pantal|falda|short/.test(lowerCategory) ? 'pants'
    : /abrigo|coat/.test(lowerName) || /abrigo/.test(lowerCategory) ? 'coat'
    : /polo|camisa/.test(lowerName) ? 'top'
    : /blazer/.test(lowerName) || /blazer/.test(lowerCategory) ? 'blazer' : 'top'
  const template = reference[type][size.toUpperCase() as 'S' | 'M' | 'L' | 'XL']
  if (!template) return false
  const values: Record<string, number | null> = {
    ancho_pecho_cm: garment.chestWidth,
    ancho_cintura_cm: garment.waistWidth,
    ancho_cadera_cm: garment.hipWidth,
    ancho_hombros_cm: garment.shoulderWidth,
    largo_total_cm: garment.length,
  }
  return Object.entries(template).every(([key, value]) => key === 'largo_tiro_cm' || values[key] === value)
    && garment.stretchPercent === 0
}

export type FitStatus = 'ajustado' | 'adecuado' | 'holgado'

export interface FitZone {
  key: 'chest' | 'waist' | 'hips' | 'shoulder'
  label: string
  bodyCm: number
  garmentCm: number
  easeCm: number
  status: FitStatus
}

export interface FitAssessment {
  zones: FitZone[]
  overall: FitStatus
  score: number
}

const BODY_LIMITS: Record<Exclude<keyof BodyMeasurements, 'gender'>, [number, number]> = {
  height: [100, 250], weight: [25, 300], chest: [40, 200], waist: [40, 200],
  hips: [40, 220], shoulder: [20, 100], inseam: [30, 150],
}

export function validateBody(body: BodyMeasurements): string | null {
  for (const [key, [min, max]] of Object.entries(BODY_LIMITS)) {
    const value = body[key as keyof typeof BODY_LIMITS]
    if (!Number.isFinite(value) || value < min || value > max) return key
  }
  return null
}

export function garmentKind(category: string): 'upper' | 'lower' | 'full' {
  const name = category.toLowerCase()
  if (name.includes('pantal') || name.includes('falda') || name.includes('short')) return 'lower'
  if (name.includes('vestid') || name.includes('conjunto') || name.includes('enterizo')) return 'full'
  return 'upper'
}

// Los anchos de prenda del esquema se consideran medidas en plano; se duplican
// para compararlos con los contornos del cuerpo. Hombros ya es un ancho lineal.
export function assessFit(body: BodyMeasurements, garment: GarmentMeasurements, category: string): FitAssessment | null {
  const kind = garmentKind(category)
  const outerwear = /abrigo|blazer|chaqueta|gabardina/i.test(category)
  const stretchAllowance = Math.min(Math.max(garment.stretchPercent, 0), 30) / 5
  const candidates = [
    { key: 'chest' as const, label: 'Pecho', bodyCm: body.chest, width: garment.chestWidth, min: outerwear ? 8 : 4, max: outerwear ? 20 : 16, include: kind !== 'lower', multiplier: 2 },
    { key: 'waist' as const, label: 'Cintura', bodyCm: body.waist, width: garment.waistWidth, min: outerwear ? 6 : 2, max: outerwear ? 18 : 14, include: true, multiplier: 2 },
    { key: 'hips' as const, label: 'Cadera', bodyCm: body.hips, width: garment.hipWidth, min: 4, max: 16, include: kind !== 'upper', multiplier: 2 },
    { key: 'shoulder' as const, label: 'Hombros', bodyCm: body.shoulder, width: garment.shoulderWidth, min: -1, max: 3, include: kind !== 'lower', multiplier: 1 },
  ]

  let score = 0
  const zones: FitZone[] = []
  for (const item of candidates) {
    if (!item.include || item.width === null || !Number.isFinite(item.width) || item.width <= 0) continue
    const garmentCm = item.width * item.multiplier
    const easeCm = garmentCm - item.bodyCm
    const min = item.min - (item.key === 'shoulder' ? 0 : stretchAllowance)
    const status: FitStatus = easeCm < min ? 'ajustado' : easeCm > item.max ? 'holgado' : 'adecuado'
    score += status === 'adecuado' ? Math.abs(easeCm - (min + item.max) / 2) : 20 + Math.abs(easeCm - (status === 'ajustado' ? min : item.max)) * 2
    zones.push({ key: item.key, label: item.label, bodyCm: item.bodyCm, garmentCm, easeCm, status })
  }

  if (!zones.length) return null
  return {
    zones,
    overall: zones.some(zone => zone.status === 'ajustado') ? 'ajustado' : zones.some(zone => zone.status === 'holgado') ? 'holgado' : 'adecuado',
    score: score / zones.length,
  }
}

export const BODY_STORAGE_KEY = 'velour-body-measurements-v1'

export function readSavedBody(): BodyMeasurements | null {
  try {
    const saved = sessionStorage.getItem(BODY_STORAGE_KEY) ?? localStorage.getItem('velour-temp-measurements')
    if (!saved) return null
    const parsed = JSON.parse(saved) as Record<string, unknown>
    const body: BodyMeasurements = {
      gender: parsed.gender === 'M' ? 'M' : 'F',
      height: Number(parsed.height), weight: Number(parsed.weight), chest: Number(parsed.chest),
      waist: Number(parsed.waist), hips: Number(parsed.hips), shoulder: Number(parsed.shoulder),
      inseam: Number(parsed.inseam),
    }
    if (validateBody(body) !== null) return null
    sessionStorage.setItem(BODY_STORAGE_KEY, JSON.stringify(body))
    localStorage.removeItem('velour-temp-measurements')
    return body
  } catch {
    return null
  }
}
import reference from '../data/medidasReferencia.json'

