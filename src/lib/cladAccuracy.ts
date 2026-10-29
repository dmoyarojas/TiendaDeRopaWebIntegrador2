import type { BodyMeasurements } from './fitting'

// Criterio del proyecto, no una garantía de exactitud del proveedor.
export const AVATAR_TOLERANCE_CM = 1
const fields = [
  ['height', 'height_cm', 'Estatura'], ['chest', 'bust_cm', 'Pecho'],
  ['waist', 'waist_cm', 'Cintura'], ['hips', 'hip_cm', 'Cadera'],
  ['shoulder', 'shoulder_width_cm', 'Hombros'], ['inseam', 'inseam_cm', 'Entrepierna'],
] as const

export function assessAvatarAccuracy(body: BodyMeasurements, measurements: Record<string, unknown> | null | undefined) {
  const zones = fields.map(([key, apiKey, label]) => {
    const value = measurements?.[apiKey]
    const actual = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
    const difference = actual === null ? null : actual - body[key]
    return { key, label, target: body[key], actual, difference,
      withinTolerance: difference !== null && Math.abs(difference) <= AVATAR_TOLERANCE_CM }
  })
  return { zones, withinTolerance: zones.every(zone => zone.withinTolerance) }
}

export type AvatarAccuracy = ReturnType<typeof assessAvatarAccuracy>
