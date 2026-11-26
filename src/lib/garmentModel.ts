import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  SphereGeometry,
  Vector3,
} from "three"

import type { Object3D } from "three"

import type { BodyMeasurements, GarmentMeasurements } from "./fitting"

interface Ring {
  y: number

  width: number

  depth: number

  centerX?: number

  centerZ?: number
}

interface ProfileRingControl {
  yRatio: number

  scale: number

  depthScale?: number

  fallback: Ring
}

interface AvatarSection {
  centerX: number

  centerZ: number

  width: number

  depth: number
}

interface AvatarBodySlice {
  yRatio: number

  body: AvatarSection | null

  leftLeg: AvatarSection | null

  rightLeg: AvatarSection | null

  leftArm: AvatarSection | null

  rightArm: AvatarSection | null
}

export interface AvatarBodyProfile {
  minY: number

  height: number

  slices: AvatarBodySlice[]
}

export type GarmentSilhouette = "top" | "outerwear" | "trousers" | "wide-trousers" | "slim-trousers" | "bootcut-trousers" | "shorts" | "skirt" | "dress" | "set"

export type GarmentDesignId = "lirio" | "polo" | "red-mini-dress" | "anat" | "puffer" | "blazer-americano" | "blazer-essence" | "fur-boxy" | "blouse-long" | "blouse-casual" | "coat-plaid" | "blazer-perla" | "parka" | "puffer-vest" | "cargo-jean" | "drill" | "generic"

function percentile(values: number[], ratio: number) {
  if (!values.length) return null

  values.sort((a, b) => a - b)

  return values[Math.floor((values.length - 1) * ratio)]
}

function measureSection(
  points: Vector3[],
  side: "body" | "left" | "right",
  minimumPoints = 8,
): AvatarSection | null {
  const selected =
    side === "body"
      ? points
      : points.filter((point) => (side === "left" ? point.x < 0 : point.x > 0))

  if (selected.length < minimumPoints) return null

  const x = selected.map((point) => point.x)

  const z = selected.map((point) => point.z)

  const lowX = percentile(x, side === "body" ? 0.12 : 0.05)

  const highX = percentile(x, side === "body" ? 0.88 : 0.95)

  const lowZ = percentile(z, 0.05)

  const highZ = percentile(z, 0.95)

  const centerX = percentile(x, 0.5)

  const centerZ = percentile(z, 0.5)

  if (
    lowX === null ||
    highX === null ||
    lowZ === null ||
    highZ === null ||
    centerX === null ||
    centerZ === null
  )
    return null

  const width = highX - lowX

  const depth = highZ - lowZ

  if (width > (side === "body" ? 0.7 : 0.36) || depth > 0.55) return null

  return {
    centerX,

    centerZ,

    width: Math.max(width, 0.04),

    depth: Math.max(depth, 0.04),
  }
}

export function extractAvatarBodyProfile(
  root: Object3D,
): AvatarBodyProfile | null {
  root.updateMatrixWorld(true)

  const points: Vector3[] = []

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return

    const mesh = object

    const position = mesh.geometry.getAttribute("position")

    if (!position) return

    const stride = Math.max(1, Math.floor(position.count / 24000))

    for (let index = 0; index < position.count; index += stride) {
      const point = mesh.getVertexPosition(index, new Vector3())

      mesh.localToWorld(point)

      if (
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.z)
      )
        points.push(point)
    }
  })

  if (points.length < 24) return null

  let minY = Infinity

  let maxY = -Infinity

  for (const point of points) {
    minY = Math.min(minY, point.y)

    maxY = Math.max(maxY, point.y)
  }

  const height = maxY - minY

  if (!Number.isFinite(height) || height <= 0) return null

  const band = Math.max(height * 0.018, 0.012)

  const slices: AvatarBodySlice[] = []

  for (let step = 1; step < 40; step++) {
    const yRatio = step * 0.025

    const y = minY + height * yRatio

    const sample = points.filter((point) => Math.abs(point.y - y) <= band)

    const centerX =
      percentile(
        sample.map((point) => point.x),
        0.5,
      ) ?? 0

    // Evita que los brazos en pose A se midan como parte del torso.
    const torsoHalfWidth = Math.max(height * 0.15, 0.22)
    const torsoSample = sample.filter(
      (point) => Math.abs(point.x - centerX) <= torsoHalfWidth,
    )
    const armThreshold = Math.max(height * 0.12, 0.14)

    slices.push({
      yRatio,

      body: measureSection(torsoSample, "body"),

      leftLeg: measureSection(sample, "left"),

      rightLeg: measureSection(sample, "right"),

      leftArm: measureSection(
        sample.filter((point) => point.x < centerX - armThreshold),
        "body",
        4,
      ),

      rightArm: measureSection(
        sample.filter((point) => point.x > centerX + armThreshold),
        "body",
        4,
      ),
    })
  }

  return { minY, height, slices }
}

function bodySection(
  profile: AvatarBodyProfile | undefined,

  yRatio: number,

  side: "body" | "leftLeg" | "rightLeg" | "leftArm" | "rightArm" = "body",
) {
  const leg = side === "leftLeg" || side === "rightLeg"

  const arm = side === "leftArm" || side === "rightArm"
  const profileYRatio = leg ? Math.max(yRatio, 0.1) : yRatio

  if (
    !profile ||
    (side === "body" && yRatio < 0.44) ||
    (leg && yRatio > 0.42) ||
    (arm && (yRatio < 0.48 || yRatio > 0.9))
  )
    return null

  const sections = profile.slices

    .filter(
      (slice) => Math.abs(slice.yRatio - profileYRatio) <= 0.045 && slice[side],
    )

    .map((slice) => slice[side]!)

  if (!sections.length) return null

  const median = (values: number[]) => {
    values.sort((a, b) => a - b)

    return values[Math.floor(values.length / 2)]
  }

  return {
    centerX: median(sections.map((section) => section.centerX)),

    centerZ: median(sections.map((section) => section.centerZ)),

    width: median(sections.map((section) => section.width)),

    depth: median(sections.map((section) => section.depth)),
  }
}

function normalizedText(category: string, name: string) {
  return `${category} ${name}`

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .toLowerCase()
}

export function garmentSilhouette(
  category: string,
  name: string,
  cut = "",
): GarmentSilhouette {
  const text = normalizedText(category, `${name} ${cut}`)

  if (/conjunto|set\b|enterizo|jumpsuit|overall/.test(text)) return "set"

  if (/vestid|dress/.test(text)) return "dress"

  if (/falda|skirt/.test(text)) return "skirt"

  if (/short|bermuda/.test(text)) return "shorts"

  if (/lirio|boot.?cut|flare|acampan|pata de elefante/.test(text))
    return "bootcut-trousers"

  if (/anat|cargo/.test(text)) return "wide-trousers"

  if (/drill/.test(text)) return "slim-trousers"

  if (/pantal|trouser|jean|palazzo/.test(text)) {
    if (/wide|palazzo|ancho|oversized|baggy/.test(text)) return "wide-trousers"

    if (/skinny|slim|ajustad/.test(text)) return "slim-trousers"

    return "trousers"
  }

  if (
    /abrigo|blazer|chaqueta|gabardina|trench|coat|jacket|chaleco|vest/.test(
      text,
    )
  )
    return "outerwear"

  return "top"
}

export function garmentDesignId(
  category: string,
  name: string,
): GarmentDesignId {
  const text = normalizedText(category, name)

  if (text.includes("lirio")) return "lirio"

  if (/\bpolo\b/.test(text)) return "polo"

  if (text.includes("vestido rojo")) return "red-mini-dress"

  if (text.includes("anat")) return "anat"

  if (/plumas|puffer/.test(text)) return "puffer"

  if (text.includes("blazer americano")) return "blazer-americano"

  if (text.includes("essence")) return "blazer-essence"

  if (/felpa|borrego|faux fur/.test(text)) return "fur-boxy"

  if (/blusa manga larga/.test(text)) return "blouse-long"

  if (/blusa casual|solido/.test(text)) return "blouse-casual"

  if (/cachemir|cashmere|lana/.test(text)) return "coat-plaid"

  if (/blazer.*perla|perla/.test(text)) return "blazer-perla"

  if (/outdoor|parka/.test(text)) return "parka"

  if (/chaleco|vest sin mangas/.test(text)) return "puffer-vest"

  if (/cargo/.test(text)) return "cargo-jean"

  if (/drill/.test(text)) return "drill"

  return "generic"
}

export function garmentDisplayColor(
  category: string,
  name: string,
  colorHex: string,
) {
  const design = garmentDesignId(category, name)

  if (design === "red-mini-dress") return "#B51235"
  if (design === "lirio") return "#CBB58F"
  return /^#[\da-f]{6}$/i.test(colorHex) ? colorHex : "#C9A96E"
  BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, SphereGeometry, TubeGeometry, Vector3,
} from 'three'
import type { BodySurface, Point } from './bodySurface'
import type { GarmentMeasurements } from './fitting'

export type GarmentStyle = 'blazer' | 'americano' | 'coat' | 'puffer' | 'shirt' | 'polo' | 'poloGris' | 'tee' | 'vest'
  | 'pants' | 'wideLeg' | 'shorts' | 'skirt' | 'dress' | 'tracksuit' | 'jumpsuit'
type Finish = 'fabric' | 'trim' | 'thread' | 'button' | 'lightButton'
export interface GarmentPiece { geometry: BufferGeometry; finish: Finish }
const sides = 64
const turn = Math.PI * 2
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount

export function garmentStyle(name: string, category: string): GarmentStyle | null {
  // The product name takes priority over the catalogue category.
  const rules: [RegExp, GarmentStyle][] = [
    [/\bblazer americano\b/i, 'americano'],
    [/^polo camisero\s*-\s*gris$/i, 'poloGris'],
    [/chaleco|sin mangas/i, 'vest'], [/plumas|acolchad|puffer/i, 'puffer'],
    [/manga larga|blusa|camisa(?!rio)/i, 'shirt'], [/camisero|polo con cuello/i, 'polo'],
    [/polo|camiseta|t-?shirt/i, 'tee'], [/blazer|americana/i, 'blazer'],
    [/abrigo|gabardina|chaqueta|parka/i, 'coat'], [/wide leg|palazzo/i, 'wideLeg'],
    [/short|bermuda/i, 'shorts'], [/pantal|jean/i, 'pants'], [/falda/i, 'skirt'],
    [/vestido/i, 'dress'], [/conjunto|deportiv/i, 'tracksuit'], [/enterizo|mono de vestir/i, 'jumpsuit'],
  ]
  return rules.find(([pattern]) => pattern.test(name))?.[1]
    ?? rules.find(([pattern]) => pattern.test(category))?.[1] ?? null
}

function hull(points: Point[]) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.z - b.z)
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
  function half(values: Point[]) {
    const edge: Point[] = []
    for (const value of values) {
      while (edge.length >= 2 && cross(edge[edge.length - 2], edge[edge.length - 1], value) <= 0) edge.pop()
      edge.push(value)
    }
    edge.pop()
    return edge
  }
  return [...half(sorted), ...half(sorted.reverse())]
}

function subdivideRings(rings: Ring[], subdivisions = 5): Ring[] {
  if (rings.length < 2) return rings

  const result = [rings[0]]

  for (let index = 0; index < rings.length - 1; index++) {
    const first = rings[index]

    const second = rings[index + 1]

    for (let step = 1; step <= subdivisions; step++) {
      const progress = step / subdivisions

      const eased = progress * progress * (3 - 2 * progress)

      const interpolate = (a: number, b: number) => a + (b - a) * eased

      const interpolateOptional = (a?: number, b?: number) =>
        a === undefined && b === undefined
          ? undefined
          : interpolate(a ?? 0, b ?? 0)

      result.push({
        y: first.y + (second.y - first.y) * progress,

        width: interpolate(first.width, second.width),

        depth: interpolate(first.depth, second.depth),

        centerX: interpolateOptional(first.centerX, second.centerX),

        centerZ: interpolateOptional(first.centerZ, second.centerZ),
      })
    }
  }

  return result
}

function makeLoft(rings: Ring[], subdivide = true): BufferGeometry {
  const loftRings = subdivide ? subdivideRings(rings) : rings

  const sides = 40

  const vertices: number[] = []

  const indices: number[] = []

  loftRings.forEach((ring) => {
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2

      vertices.push(
        (ring.centerX ?? 0) + (Math.sin(angle) * ring.width) / 2,

        ring.y,

        (ring.centerZ ?? 0) + (Math.cos(angle) * ring.depth) / 2,
      )
    }
function clipAtX(polygon: Point[], x: number, side: number) {
  const points: Point[] = []
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const inside = (point.x - x) * side >= 0
    const nextInside = (next.x - x) * side >= 0
    if (inside) points.push(point)
    if (inside !== nextInside) points.push({ x, z: mix(point.z, next.z, (x - point.x) / (next.x - point.x)) })
  })
  return points
}

  for (let ring = 0; ring < loftRings.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides

      const first = ring * sides + side

      const second = ring * sides + next

      const third = (ring + 1) * sides + side
function sectionRing(points: Point[]) {
  const contour = hull(points)
  if (contour.length < 3) return null
  const center = { x: 0, z: 0 }
  let circumference = 0
  let twiceArea = 0
  contour.forEach((a, i) => {
    const b = contour[(i + 1) % contour.length]
    const cross = a.x * b.z - b.x * a.z
    twiceArea += cross
    center.x += (a.x + b.x) * cross
    center.z += (a.z + b.z) * cross
    circumference += Math.hypot(b.x - a.x, b.z - a.z)
  })
  if (twiceArea < 1e-8) return null
  center.x /= 3 * twiceArea
  center.z /= 3 * twiceArea
  return {
    center, circumference,
    radius(dx: number, dz: number) {
      // Each convex hull edge limits how far a ray can go from the interior.
      let radius = Infinity
      contour.forEach((a, i) => {
        const b = contour[(i + 1) % contour.length]
        const ex = b.x - a.x
        const ez = b.z - a.z
        const towardEdge = ez * dx - ex * dz
        if (towardEdge > 1e-9) radius = Math.min(radius, (ex * (center.z - a.z) - ez * (center.x - a.x)) / towardEdge)
      })
      return radius
    },
  }
}

type Ring = NonNullable<ReturnType<typeof sectionRing>>
type SurfacePoint = (height: number, around: number) => Vector3 | null

function shell(sample: SurfacePoint, rows: number) {
  const grid: Vector3[][] = []
  const positions: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row++) {
    const ring: Vector3[] = []
    for (let col = 0; col < sides; col++) {
      const point = sample(row / rows, col / sides)
      if (!point) return null
      ring.push(point)
      positions.push(point.x, point.y, point.z)
      if (row < rows) {
        const a = row * sides + col
        const b = row * sides + (col + 1) % sides
        indices.push(a, b, a + sides, b, b + sides, a + sides)
      }
    }
    grid.push(ring)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return {
    geometry,
    point(t: number, around: number) {
      // Details follow the actual mesh, including the same triangle diagonal.
      const row = clamp(t, 0, 1) * rows
      const col = ((around % 1 + 1) % 1) * sides
      const low = Math.min(rows - 1, Math.floor(row))
      const left = Math.floor(col) % sides
      const right = (left + 1) % sides
      const u = col - Math.floor(col)
      const v = row - low
      const a = grid[low][left]
      const b = grid[low][right]
      const c = grid[low + 1][left]
      const d = grid[low + 1][right]
      return u + v <= 1
        ? a.clone().multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v)
        : d.clone().multiplyScalar(u + v - 1).addScaledVector(b, 1 - v).addScaledVector(c, 1 - u)
    },
  }
}
type Shell = NonNullable<ReturnType<typeof shell>>

function makeOrientedLoft(rings: Ring[]): BufferGeometry {
  const loftRings = subdivideRings(rings)
  const sides = 24
  const vertices: number[] = []
  const indices: number[] = []

  loftRings.forEach((ring, index) => {
    const previous = loftRings[Math.max(0, index - 1)]
    const next = loftRings[Math.min(loftRings.length - 1, index + 1)]
    const tangent = new Vector3(
      (next.centerX ?? 0) - (previous.centerX ?? 0),
      next.y - previous.y,
      (next.centerZ ?? 0) - (previous.centerZ ?? 0),
    ).normalize()
    const reference =
      Math.abs(tangent.z) < 0.95 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
    const across = new Vector3().crossVectors(tangent, reference).normalize()
    const depthAxis = new Vector3().crossVectors(tangent, across).normalize()

    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2
      const acrossOffset = (Math.sin(angle) * ring.width) / 2
      const depthOffset = (Math.cos(angle) * ring.depth) / 2

      vertices.push(
        (ring.centerX ?? 0) +
          across.x * acrossOffset +
          depthAxis.x * depthOffset,
        ring.y + across.y * acrossOffset + depthAxis.y * depthOffset,
        (ring.centerZ ?? 0) +
          across.z * acrossOffset +
          depthAxis.z * depthOffset,
      )
    }
  })

  for (let ring = 0; ring < loftRings.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      const first = ring * sides + side
      const second = ring * sides + next
      const third = (ring + 1) * sides + side
      const fourth = (ring + 1) * sides + next

      indices.push(first, second, third, second, fourth, third)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

function contour(value: number | null, bodyValue: number) {
  return circumferenceWidth(value === null ? bodyValue + 8 : value * 2)
}

function measuredContour(value: number | null | undefined) {
  return value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value > 0
    ? circumferenceWidth(value * 2)
    : null
}

function dimensions(
  body: BodyMeasurements,
  garment: GarmentMeasurements,
  profile?: AvatarBodyProfile,
) {
  const height = profile?.height ?? body.height / 100

  const minY = profile?.minY ?? 0

  const yAt = (ratio: number) => minY + height * ratio

  const chestWidth = contour(garment.chestWidth, body.chest)

  const waistWidth = contour(garment.waistWidth, body.waist)

  const hipWidth = contour(garment.hipWidth, body.hips)

  const chestScale = easeRatio(
    garment.chestWidth,
    body.chest,
    garment.stretchPercent,
  )

  const waistScale = easeRatio(
    garment.waistWidth,
    body.waist,
    garment.stretchPercent,
  )

  const hipScale = easeRatio(
    garment.hipWidth,
    body.hips,
    garment.stretchPercent,
  )

  const shoulderScale = (garment.shoulderWidth ?? body.shoulder) / body.shoulder

  const depth = (width: number) => width * 0.68

  const shoulderWidth = Math.max(
    ((garment.shoulderWidth ?? body.shoulder) / 100) * 1.08,

    chestWidth * 0.72,
  )

  return {
    height,

    yAt,

    profile,

    chestWidth,

    waistWidth,

    hipWidth,

    chestScale,

    waistScale,

    hipScale,

    shoulderScale,

    depth,

    shoulderWidth,

    shoulderY: yAt(0.82),

    waistY: yAt(0.6),

    hipY: yAt(0.51),
function addStitch(pieces: GarmentPiece[], shell: Shell, start: [number, number], end: [number, number], finish: Finish, radius: number) {
  const points = Array.from({ length: 37 }, (_, i) => {
    const step = i / 36
    return shell.point(mix(start[0], end[0], step), mix(start[1], end[1], step))
  })
  const closed = points[0].distanceToSquared(points[points.length - 1]) < 1e-10
  if (closed) points.pop()
  pieces.push({ geometry: new TubeGeometry(new CatmullRomCurve3(points, closed), 56, radius, 5, closed), finish })
}

function addButton(pieces: GarmentPiece[], point: Vector3, size: number, finish: 'button' | 'lightButton' = 'button') {
  const geometry = new SphereGeometry(size, 12, 8)
  geometry.scale(1, 1, 0.42)
  geometry.translate(point.x, point.y, point.z + 0.002)
  pieces.push({ geometry, finish })
}

function addPoloCollar(pieces: GarmentPiece[], surface: Shell) {
  for (const side of [-1, 1]) {
    const positions: number[] = []
    const indices: number[] = []
    for (let col = 0; col <= 32; col++) {
      const t = col / 32
      const around = side * mix(0.018, 0.5, t)
      const point = Math.max(0, 1 - Math.abs(t - 0.16) / 0.16)
      for (const outer of [0, 1]) {
        const vertex = surface.point(0.996 - outer * (0.042 + 0.095 * point), around)
        const angle = around * turn
        vertex.x += Math.sin(angle) * 0.003
        vertex.z += Math.cos(angle) * 0.004
        vertex.y += outer ? 0 : 0.003
        positions.push(vertex.x, vertex.y, vertex.z)
      }
      if (col < 32) {
        const a = col * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    pieces.push({ geometry, finish: 'trim' })
  }
}

function addLapels(pieces: GarmentPiece[], surface: Shell, americano: boolean) {
  for (const side of [-1, 1]) {
    const positions: number[] = []
    const indices: number[] = []
    for (let row = 0; row <= 12; row++) {
      const t = row / 12
      const inset = 0.02 + (americano ? 0.145 : 0.17) * Math.sin(t * Math.PI / 2)
      const notch = americano ? (t > 0.76 ? 0.022 : 0) : (t > 0.72 ? 0.035 : 0)
      const width = 0.007 + (americano ? 0.083 : 0.062) * Math.sin(t * Math.PI) + notch
      for (const edge of [0, 1]) {
        const point = surface.point(mix(americano ? 0.49 : 0.56, 0.99, t), side * (inset + width * edge))
        point.z += 0.004 + 0.003 * edge
        positions.push(point.x, point.y, point.z)
      }
      if (row < 12) {
        const a = row * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    pieces.push({ geometry, finish: 'trim' })
  }
}

function addPocketFlaps(pieces: GarmentPiece[], surface: Shell) {
  for (const side of [-1, 1]) {
    const positions: number[] = []
    const indices: number[] = []
    for (let col = 0; col <= 16; col++) {
      const across = col / 16
      const rise = 0.025 * across
      const around = side * mix(0.065, 0.188, across)
      for (const bottom of [0, 1]) {
        const point = surface.point(0.32 + rise - 0.075 * bottom, around)
        point.z += 0.004 + 0.002 * bottom
        positions.push(point.x, point.y, point.z)
      }
      if (col < 16) {
        const a = col * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    pieces.push({ geometry, finish: 'trim' })
  }
}

function drawPoint(ring: Ring | null, y: number, around: number, margin: number, extra = 0) {
  if (!ring) return null
  const dx = Math.sin(around * turn)
  const dz = Math.cos(around * turn)
  const radius = (ring.radius(dx, dz) + margin) / Math.cos(Math.PI / sides) + extra
  return new Vector3(ring.center.x + radius * dx, y, ring.center.z + radius * dz)
}

function allowance(flatWidth: number | null, circumference: number) {
  return flatWidth !== null && Number.isFinite(flatWidth)
    ? clamp((flatWidth / 50 - circumference) / turn, 0, 0.055)
    : 0
}

function cachedRings(section: (y: number) => Point[]) {
  const cache = new Map<number, Ring | null>()
  const step = 0.005
  function at(row: number) {
    if (!cache.has(row)) cache.set(row, sectionRing(section(row * step)))
    return cache.get(row) ?? null
  }
  return (y: number): Ring | null => {
    const row = Math.floor(y / step)
    const fraction = y / step - row
    const low = at(row)
    const high = at(row + 1)
    if (!low || !high) return low ?? high
    return {
      center: { x: mix(low.center.x, high.center.x, fraction), z: mix(low.center.z, high.center.z, fraction) },
      circumference: mix(low.circumference, high.circumference, fraction),
      radius: (dx, dz) => mix(low.radius(dx, dz), high.radius(dx, dz), fraction),
    }
  }
}

function rowCount(length: number) {
  return Math.max(8, Math.ceil(length / 0.007))
}

function drapeAllowance(ring: Ring, minimumPerimeter: number, around: number) {
  const outer = Math.abs(Math.sin(around * turn))
  return clamp((minimumPerimeter - ring.circumference) / turn, 0, 0.105) * (0.72 + outer * 0.28)
}

export function createGarmentPieces(body: BodySurface, measurements: GarmentMeasurements, style: GarmentStyle) {
  const { height, at, central } = body
  const pieces: GarmentPiece[] = []
  if (height < 0.8 || height > 2.6) return pieces
  const lower = ['pants', 'wideLeg', 'shorts', 'skirt', 'tracksuit', 'jumpsuit'].includes(style)
  const upper = !lower || style === 'tracksuit' || style === 'jumpsuit'
  const americano = style === 'americano'
  const poloGris = style === 'poloGris'
  const jacket = americano || style === 'blazer' || style === 'coat' || style === 'puffer'
  const shortSleeve = poloGris || style === 'tee' || style === 'polo' || style === 'tracksuit'
  const shirt = style === 'shirt' || style === 'polo'
  const margin = jacket ? 0.019 : 0.012
  const waistY = height * 0.615
  const shoulderY = height * 0.83
  const necklineY = height * 0.865

  const armJoin = Array.from({ length: 33 }, (_, index) => height * (0.82 - index * 0.005))
    .find(y => {
      const torso = central(y)
      const sections = at(y)
      return torso && sections.length >= 3 && sections[0].maxX < torso.minX && sections[sections.length - 1].minX > torso.maxX
    })
  const torsoAtArmJoin = armJoin ? central(armJoin) : undefined
  const torsoRings = cachedRings(y => {
    const torso = central(y)
    // At the hips keep the upper skirt or jacket continuous across the point
    // where the body's cross section splits into two legs.
    if (y <= height * 0.55) {
      const centerParts = at(y).filter(group => group.maxX > -0.16 && group.minX < 0.16)
      if (centerParts.length) return centerParts.flatMap(group => group.points)
    }
    if (!torso) return []
    if (!armJoin || !torsoAtArmJoin || y <= armJoin) return torso.points
    // Keep the shirt body from suddenly widening when a slice includes the
    // upper arms. The sleeves bridge this section to the outer shoulders.
    const shoulderExtension = 0.027 * clamp((y - armJoin) / 0.09, 0, 1)
    return clipAtX(clipAtX(hull(torso.points), torsoAtArmJoin.minX - shoulderExtension, 1),
      torsoAtArmJoin.maxX + shoulderExtension, -1)
  })

  if (upper) {
    const dress = style === 'dress'
    const defaultLength = height * (dress ? 0.53 : style === 'coat' ? 0.49 : style === 'tracksuit' ? 0.24 : 0.37)
    const length = style === 'jumpsuit' || style === 'tracksuit'
      ? defaultLength
      : (measurements.length ?? defaultLength * 100) / 100
    const hem = style === 'jumpsuit' ? waistY - 0.018
      : style === 'tracksuit' ? waistY - 0.025
      : clamp(shoulderY - length, height * (dress || style === 'coat' ? 0.16 : 0.42), shoulderY - 0.15)
    const hipRing = torsoRings(height * 0.52)
    const waistRing = torsoRings(waistY)
    const chestRing = torsoRings(height * 0.733)
    const hipEase = allowance(measurements.hipWidth, hipRing?.circumference ?? 0.95)
    const waistEase = allowance(measurements.waistWidth, waistRing?.circumference ?? 0.8)
    const chestEase = allowance(measurements.chestWidth, chestRing?.circumference ?? 0.95)
    const shoulderRing = torsoRings(shoulderY)
    const shoulderSpan = shoulderRing ? shoulderRing.radius(1, 0) + shoulderRing.radius(-1, 0) : 0.4
    const shoulderEase = clamp(((measurements.shoulderWidth ?? shoulderSpan * 100) / 100 - shoulderSpan) / 2, 0, 0.032)
    const torso = shell((t, around) => {
      const front = Math.max(0, Math.cos(around * turn))
      const back = Math.max(0, -Math.cos(around * turn))
      const neckDrop = (americano ? 0.225 : jacket && style !== 'puffer' ? 0.13 : dress ? 0.081 : 0.043) * (height / 1.7)
      const neck = necklineY - neckDrop * front ** (americano ? 12 : 6) - 0.022 * back ** 5
      const curvedHem = americano ? 0.022 * Math.sin(around * turn) ** 2 : 0
      const y = mix(hem + curvedHem, neck, t)
      const ring = torsoRings(y)
      const hipsToWaist = clamp((y / height - 0.51) / 0.105, 0, 1)
      const waistToChest = clamp((y / height - 0.615) / 0.118, 0, 1)
      const tailoredWaist = americano || poloGris ? waistEase * 0.5 : waistEase
      const ease = mix(mix(hipEase, tailoredWaist, hipsToWaist), chestEase, waistToChest)
      const shoulderShape = Math.max(0, 1 - Math.abs(y - shoulderY) / 0.07) * Math.abs(Math.sin(around * turn))
      const flare = dress || style === 'coat'
        ? clamp((height * 0.52 - y) / 0.3, 0, 1) * (dress ? 0.085 : 0.047)
        : 0
      const quilting = style === 'puffer' ? 0.014 * Math.sin(t * Math.PI * 8) ** 2 : 0
      return drawPoint(ring, y, around, margin, ease * (1 - 0.72 * t ** 6) + flare + quilting + shoulderShape * shoulderEase)
    }, rowCount(necklineY - hem))
    if (!torso) return []
    pieces.push({ geometry: torso.geometry, finish: 'fabric' })
    addStitch(pieces, torso, [0, 0], [0, 1], 'trim', 0.003)
    addStitch(pieces, torso, [1, 0], [1, 1], 'trim', 0.004)
    if (poloGris) {
      addPoloCollar(pieces, torso)
      for (const side of [-1, 1]) addStitch(pieces, torso, [0.76, side * 0.015], [0.98, side * 0.015], 'trim', 0.0017)
      for (const t of [0.84, 0.91]) addButton(pieces, torso.point(t, 0), 0.0045, 'lightButton')
      addStitch(pieces, torso, [0.021, 0], [0.021, 1], 'thread', 0.0015)
    } else if (jacket || shirt) {
      addStitch(pieces, torso, [0.025, 0.014], [americano ? 0.92 : 0.88, 0.014], 'thread', 0.0018)
      if (americano || style === 'blazer' || style === 'coat' || shirt) addLapels(pieces, torso, americano)
      const buttons = americano ? [0.59, 0.84] : style === 'blazer' ? [0.33, 0.48, 0.62]
        : style === 'polo' ? [0.73, 0.83] : [0.19, 0.32, 0.45, 0.58, 0.71, 0.84]
      for (const t of buttons) addButton(pieces, torso.point(t, 0.014), jacket ? 0.008 : 0.005)
    }
    if (americano) {
      addPocketFlaps(pieces, torso)
      addStitch(pieces, torso, [0.77, -0.138], [0.774, -0.2], 'trim', 0.0026)
    } else if (jacket) {
      for (const side of [-1, 1]) {
        addStitch(pieces, torso, [0.29, side * 0.092], [0.31, side * 0.19], 'trim', 0.005)
        addStitch(pieces, torso, [0.27, side * 0.093], [0.29, side * 0.189], 'thread', 0.0015)
      }
    }
    if (style === 'puffer') {
      for (let row = 1; row < 8; row++) addStitch(pieces, torso, [row / 8, 0], [row / 8, 1], 'thread', 0.002)
    }
    if (dress) addStitch(pieces, torso, [0.72, 0], [0.72, 1], 'thread', 0.002)

    if (style !== 'vest' && style !== 'dress' && armJoin && torsoAtArmJoin) {
      const join = armJoin
      for (const side of [-1, 1]) {
        const arm = (y: number) => {
          const groups = at(y)
          const outside = side > 0 ? groups[groups.length - 1] : groups[0]
          const hasSeparateArm = groups.length >= (central(y) ? 3 : 4)
          if (hasSeparateArm && outside && (side > 0 ? outside.minX > 0 : outside.maxX < 0)) return outside
        }
        let armEnd = join
        while (armEnd > height * 0.38 && arm(armEnd - 0.008)) armEnd -= 0.008
        const range = join - armEnd
        if (range < 0.045) continue
        const cuff = join - range * (poloGris ? 0.24 : shortSleeve ? 0.47 : 0.9)
        const top = Math.min(join + height * 0.09, shoulderY + 0.012)
        const innerX = side > 0 ? torsoAtArmJoin.maxX : torsoAtArmJoin.minX
        const rings = cachedRings(y => {
          const limb = arm(y)
          const torso = central(y)
          if (y < join - 0.035 || !torso) return limb?.points ?? []
          const joinDepth = clamp((y - join + 0.035) / 0.08, 0, 1) * 0.078
          return clipAtX(hull([...torso.points, ...(limb?.points ?? [])]), innerX - side * joinDepth, side)
        })
        const sleeve = shell((t, around) => {
          const outside = (1 + side * Math.sin(around * turn)) / 2
          const edge = top - (1 - outside) * 0.025
          const y = mix(cuff, edge, Math.min(1, t / 0.84))
          const point = drawPoint(rings(y), y, around, margin * 0.72, 0.005 + (jacket ? 0.005 : 0))
          if (!point || t <= 0.84) return point
          // Stitch the sleeve cap underneath the shoulder panel. An open
          // ring here exposed skin from the side, even with radial clearance.
          const frontToBack = (1 - Math.cos(around * turn)) / 2
          const shoulder = torso.point(mix(0.92, 0.995, outside), side * mix(0.165, 0.335, frontToBack))
          shoulder.x -= side * 0.008
          return point.lerp(shoulder, (t - 0.84) / 0.16)
        }, rowCount(top - cuff))
        if (!sleeve) continue
        pieces.push({ geometry: sleeve.geometry, finish: 'fabric' })
        addStitch(pieces, sleeve, [0, 0], [0, 1], 'trim', 0.0035)
        if (poloGris) addStitch(pieces, sleeve, [0.045, 0], [0.045, 1], 'thread', 0.0015)
        if (style === 'puffer') for (const t of [0.23, 0.46, 0.69]) addStitch(pieces, sleeve, [t, 0], [t, 1], 'thread', 0.002)
      }
    }
  }
}

function easeRatio(
  flatWidth: number | null,
  bodyCircumference: number,
  stretchPercent = 0,
) {
  const garmentCircumference =
    flatWidth !== null && Number.isFinite(flatWidth) && flatWidth > 0
      ? flatWidth * 2
      : bodyCircumference + 8

  const rawRatio = garmentCircumference / bodyCircumference

  const stretch = Math.min(Math.max(stretchPercent, 0), 30) / 100

  return 1 + (rawRatio - 1) * (1 - stretch)
}

function profileRing(
  shape: ReturnType<typeof dimensions>,

  yRatio: number,

  scale: number,

  fallback: Ring,

  side: "body" | "leftLeg" | "rightLeg" = "body",

  depthScale = 1,
): Ring {
  const section = bodySection(shape.profile, yRatio, side)

  if (!section)
    return {
      ...fallback,
      depth: fallback.depth * depthScale,
      y: shape.yAt(yRatio),
    }

  const safeScale = Math.min(
    Math.max(Number.isFinite(scale) ? scale : 1.08, 1.015),
    1.4,
  )

  return {
    y: shape.yAt(yRatio),

    width: section.width * safeScale,

    depth: section.depth * safeScale * depthScale,

    centerX: section.centerX,

    centerZ: section.centerZ,
  }
}

function profileScaleForWidth(
  shape: ReturnType<typeof dimensions>,

  yRatio: number,

  width: number,

  side: "body" | "leftLeg" | "rightLeg",

  fallback: number,
) {
  const section = bodySection(shape.profile, yRatio, side)

  return section ? Math.max(fallback, width / section.width) : fallback
}

function smoothProfileRings(
  shape: ReturnType<typeof dimensions>,

  controls: ProfileRingControl[],

  side: "body" | "leftLeg" | "rightLeg" = "body",

  subdivisions = 4,
) {
  if (controls.length < 2)
    return controls.map((control) =>
      profileRing(shape, control.yRatio, control.scale, control.fallback, side),
    )

  const result: Ring[] = [
    profileRing(
      shape,
      controls[0].yRatio,
      controls[0].scale,
      controls[0].fallback,
      side,
    ),
  ]

  for (let index = 0; index < controls.length - 1; index++) {
    const first = controls[index]

    const second = controls[index + 1]

    for (let step = 1; step <= subdivisions; step++) {
      const progress = step / subdivisions

      const eased = progress * progress * (3 - 2 * progress)

      const yRatio = first.yRatio + (second.yRatio - first.yRatio) * progress

      const interpolate = (a: number, b: number) => a + (b - a) * eased

      const interpolateOptional = (a?: number, b?: number) =>
        a === undefined && b === undefined
          ? undefined
          : interpolate(a ?? 0, b ?? 0)

      const fallback: Ring = {
        y: shape.yAt(yRatio),

        width: interpolate(first.fallback.width, second.fallback.width),

        depth: interpolate(first.fallback.depth, second.fallback.depth),

        centerX: interpolateOptional(
          first.fallback.centerX,
          second.fallback.centerX,
        ),

        centerZ: interpolateOptional(
          first.fallback.centerZ,
          second.fallback.centerZ,
        ),
      }

      result.push(
        profileRing(
          shape,

          yRatio,

          interpolate(first.scale, second.scale),

          fallback,

          side,

          interpolate(first.depthScale ?? 1, second.depthScale ?? 1),
        ),
      )
    }
  }

  return result
}

function createTorso(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  length: number,

  hemWidth: number,

  profile?: AvatarBodyProfile,
) {
  const shape = dimensions(body, garment, profile)

  const bottomRatio = Math.max(0.35, 0.82 - length / 100 / shape.height)

  const measuredHemWidth = measuredContour(garment.hemWidth)

  const waistRatio = easeRatio(
    garment.waistWidth,
    body.waist,
    garment.stretchPercent,
  )

  const chestRatio = easeRatio(
    garment.chestWidth,
    body.chest,
    garment.stretchPercent,
  )

  const hipRatio = easeRatio(
    garment.hipWidth,
    body.hips,
    garment.stretchPercent,
  )

  const shoulderRatio = (garment.shoulderWidth ?? body.shoulder) / body.shoulder

  const depthClearance = 1.08

  const hemProfileScale =
    measuredHemWidth === null
      ? hipRatio
      : profileScaleForWidth(shape, bottomRatio, hemWidth, "body", hipRatio)

  return makeLoft(
    smoothProfileRings(shape, [
      {
        yRatio: bottomRatio,
        scale: hemProfileScale,
        depthScale: depthClearance,
        fallback: { y: 0, width: hemWidth, depth: shape.depth(hemWidth) },
      },

      {
        yRatio: 0.61,
        scale: waistRatio,
        depthScale: depthClearance,
        fallback: {
          y: 0,
          width: shape.waistWidth,
          depth: shape.depth(shape.waistWidth),
        },
      },

      {
        yRatio: 0.72,
        scale: chestRatio,
        depthScale: depthClearance,
        fallback: {
          y: 0,
          width: shape.chestWidth,
          depth: shape.depth(shape.chestWidth),
        },
      },

      {
        yRatio: 0.82,
        scale: shoulderRatio,
        depthScale: depthClearance,
        fallback: {
          y: 0,
          width: shape.shoulderWidth,
          depth: shape.depth(shape.chestWidth) * 0.85,
        },
      },
      {
        yRatio: 0.84,
        scale: 1,
        depthScale: depthClearance,
        fallback: {
          y: shape.yAt(0.84),
          width: shape.shoulderWidth * 0.72,
          depth: shape.depth(shape.shoulderWidth) * 0.72,
        },
      },
    ]),
    false,
  )
}

function createSleeves(
  body: BodyMeasurements,
  garment: GarmentMeasurements,
  shape: ReturnType<typeof dimensions>,
  lengthRatio: number,
) {
  if (lengthRatio === 0) return []

  const height = shape.height

  const measuredLengthRatio =
    garment.sleeveLength !== null &&
    garment.sleeveLength !== undefined &&
    garment.sleeveLength > 0
      ? garment.sleeveLength / 100 / height
      : lengthRatio

  const sleeveLength =
    height * Math.min(Math.max(measuredLengthRatio, 0.02), 0.48)

  const actualLengthRatio = sleeveLength / height

  const upperWidth =
    measuredContour(garment.armWidth) ??
    Math.max((body.shoulder / 100) * 0.4, 0.12)

  const cuffWidth =
    measuredContour(garment.cuffWidth) ??
    upperWidth * (lengthRatio > 0.2 ? 0.72 : 0.84)

  const shoulderTopRatio = 0.84
  const shoulder = bodySection(shape.profile, 0.82)

  const centerX = shoulder?.centerX ?? 0

  const centerZ = shoulder?.centerZ ?? 0

  const shoulderWidth = shape.shoulderWidth

  return [-1, 1].map((side) => {
    const armSide = side < 0 ? "leftArm" : "rightArm"

    const controls = [
      {
        yRatio: shoulderTopRatio - actualLengthRatio,
        width: cuffWidth,
        depth: cuffWidth * 0.8,
        offset: 0.9,
      },

      {
        yRatio: shoulderTopRatio - actualLengthRatio * 0.48,
        width: upperWidth * 0.9,
        depth: upperWidth * 0.78,
        offset: 0.72,
      },

      {
        yRatio: shoulderTopRatio,
        width: upperWidth,
        depth: upperWidth * 0.84,
        offset: 0.52,
      },
    ]

    return makeOrientedLoft(
      controls.map((control) => {
        const arm = bodySection(shape.profile, control.yRatio, armSide)

        const width = Math.max(
          control.width,
          Math.min((arm?.width ?? 0) * 1.08, control.width * 1.35),
        )

        const depth = Math.max(
          control.depth,
          Math.min((arm?.depth ?? 0) * 1.12, control.depth * 1.35),
        )

        return {
          y: shape.yAt(control.yRatio),

          width,

          depth,

          centerX:
            arm?.centerX ?? centerX + side * shoulderWidth * control.offset,

          centerZ: arm?.centerZ ?? centerZ,
        }
      }),
    )
  })
}

function sleeveLengthRatio(
  style: GarmentSilhouette,
  category: string,
  name: string,
) {
  const text = normalizedText(category, name)

  if (/sin mangas|sleeveless|strapless/.test(text)) return 0

  if (/manga corta|short sleeve|polo|t-shirt|\btee\b/.test(text)) return 0.14

  if (/blusa casual|casual/.test(text) && /blusa|sleeve/.test(text)) return 0.24

  if (/manga larga|long sleeve|blusa|camisa|shirt/.test(text)) return 0.32

  if (style === "outerwear") return 0.32

  return 0.14
}

function measurementsForDesign(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  design: GarmentDesignId,
) {
  const padded =
    design === "puffer" || design === "puffer-vest" || design === "fur-boxy"

  const structured =
    design === "blazer-americano" ||
    design === "blazer-perla" ||
    design === "coat-plaid"

  const widen = (value: number | null, bodyValue: number, factor: number) =>
    (value ?? (bodyValue + 8) / 2) * factor

  return {
    ...garment,

    chestWidth: padded
      ? widen(garment.chestWidth, body.chest, 1.08)
      : garment.chestWidth,

    waistWidth: padded
      ? widen(
          garment.waistWidth,
          body.waist,
          design === "fur-boxy" ? 1.12 : 1.08,
        )
      : garment.waistWidth,

    hipWidth: padded
      ? widen(garment.hipWidth, body.hips, 1.08)
      : garment.hipWidth,

    shoulderWidth: structured
      ? (garment.shoulderWidth ?? body.shoulder) * 1.04
      : garment.shoulderWidth,
  }
}

function createUpperGarment(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  style: GarmentSilhouette,

  category: string,

  name: string,

  length?: number,

  profile?: AvatarBodyProfile,

  design = garmentDesignId(category, name),
) {
  const modelGarment = measurementsForDesign(body, garment, design)

  const shape = dimensions(body, modelGarment, profile)

  const text = normalizedText(category, name)

  const polo = /polo|camiseta|t-shirt|\btee\b/.test(text)

  const defaultLength =
    style === "outerwear"
      ? body.height * 0.48
      : polo
        ? body.height * 0.32
        : body.height * 0.35

  const requestedLength = length ?? defaultLength

  const designLength: Partial<Record<GarmentDesignId, number>> = {
    "blazer-americano": 0.48,

    "blazer-essence": 0.35,

    "blazer-perla": 0.46,

    puffer: 0.46,

    "fur-boxy": 0.39,

    "blouse-long": 0.39,

    "blouse-casual": 0.39,

    "coat-plaid": 0.62,

    parka: 0.62,

    "puffer-vest": 0.43,
  }

  const targetLength = designLength[design]

  const shortDesign = design === "blazer-essence" || design === "fur-boxy"

  const garmentLength = targetLength
    ? shortDesign
      ? Math.min(requestedLength, body.height * targetLength)
      : Math.max(requestedLength, body.height * targetLength)
    : polo && !/oversize|longline|tunic/.test(text)
      ? Math.min(requestedLength, body.height * 0.36)
      : requestedLength

  const hemWidth =
    measuredContour(modelGarment.hemWidth) ??
    (style === "outerwear" && /trench|gabardina|oversized|oversize/.test(text)
      ? shape.hipWidth * 1.12
      : shape.hipWidth)

  return [
    createTorso(body, modelGarment, garmentLength, hemWidth, profile),

    ...createSleeves(
      body,
      garment,
      shape,
      sleeveLengthRatio(style, category, name),
    ),
  ]
}

function createTrousers(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  style: "trousers" | "wide-trousers" | "slim-trousers" | "bootcut-trousers" | "shorts",

  profile?: AvatarBodyProfile,
) {
  const shape = dimensions(body, garment, profile)

  const rise =
    garment.rise !== null &&
    garment.rise !== undefined &&
    Number.isFinite(garment.rise) &&
    garment.rise > 0
      ? garment.rise
      : body.height * 0.14

  const crotchRatio = Math.min(
    0.5,
    Math.max(0.4, body.inseam / 100 / shape.height),
  )

  const waistYRatio = Math.min(
    0.72,
    Math.max(0.52, crotchRatio + rise / 100 / shape.height),
  )

  const legTopRatio = Math.min(0.55, crotchRatio + 0.075)

  const crotchY = shape.yAt(crotchRatio)

  const legCircumference =
    (garment.hipWidth === null ? body.hips + 8 : garment.hipWidth * 2) *
    (style === "wide-trousers"
      ? 0.48
      : style === "slim-trousers"
        ? 0.3
        : style === "shorts"
          ? 0.36
          : style === "bootcut-trousers"
            ? 0.37
            : 0.34)

  const defaultLegWidth = circumferenceWidth(legCircumference)

  const thighWidth = measuredContour(garment.thighWidth) ?? defaultLegWidth

  const kneeWidth =
    measuredContour(garment.kneeWidth) ??
    thighWidth *
      (style === "wide-trousers"
        ? 0.95
        : style === "bootcut-trousers"
          ? 0.84
          : 0.82)

  const hemWidth =
    measuredContour(garment.legHemWidth) ??
    measuredContour(garment.hemWidth) ??
    thighWidth *
      (style === "wide-trousers"
        ? 1.16
        : style === "slim-trousers"
          ? 0.68
          : style === "shorts"
            ? 0.92
            : style === "bootcut-trousers"
              ? 1.04
              : 0.78)

  const legDepth = (width: number) => shape.depth(width)

  const legCenter = shape.hipWidth * 0.2

  const garmentLength = garment.length ?? body.inseam + 25

  const hemRatio =
    style === "shorts"
      ? Math.min(
          0.435,
          Math.max(0.3, waistYRatio - garmentLength / 100 / shape.height),
        )
      : Math.max(0.015, waistYRatio - garmentLength / 100 / shape.height)

  const kneeRatio = hemRatio + (legTopRatio - hemRatio) * 0.48

  const hipRatio = easeRatio(
    garment.hipWidth,
    body.hips,
    garment.stretchPercent,
  )

  const waistRatio = easeRatio(
    garment.waistWidth,
    body.waist,
    garment.stretchPercent,
  )

  const legSide = (side: number) => (side < 0 ? "leftLeg" : "rightLeg")
  const seatCrotchScale = style === "bootcut-trousers" ? 0.52 : 0.62
  const crotchTaperHeight = shape.height * 0.04
  const seatRings = smoothProfileRings(shape, [
    {
      yRatio: crotchRatio,
      scale: hipRatio,
      depthScale: 1.08,
      fallback: {
        y: crotchY,
        width: shape.hipWidth * 0.9,
        depth: shape.depth(shape.hipWidth * 0.9),
      },
    },

    {
      yRatio: 0.51,
      scale: hipRatio,
      depthScale: 1.08,
      fallback: {
        y: shape.hipY,
        width: shape.hipWidth,
        depth: shape.depth(shape.hipWidth),
      },
    },

    {
      yRatio: waistYRatio,
      scale: waistRatio,
      depthScale: 1.08,
      fallback: {
        y: shape.yAt(waistYRatio),
        width: shape.waistWidth,
        depth: shape.depth(shape.waistWidth),
      },
    },
  ]).map((ring) => {
    const progress = Math.min(
      1,
      Math.max(0, (ring.y - crotchY) / crotchTaperHeight),
    )
    const scale = seatCrotchScale + (1 - seatCrotchScale) * progress

    return { ...ring, width: ring.width * scale, depth: ring.depth * scale }
  })

  const defaultProfileScale =
    hipRatio *
    (style === "wide-trousers"
      ? 1.2
      : style === "slim-trousers"
        ? 0.95
        : style === "shorts"
          ? 1.05
          : style === "bootcut-trousers"
            ? 1.08
            : 1.03)

  return [
    makeLoft(seatRings, false),

    ...[-1, 1].map((side) => {
      const bodySide = legSide(side)

      const ratios = [hemRatio, kneeRatio, legTopRatio]

      const widths = [hemWidth, kneeWidth, thighWidth]

      return makeLoft(
        smoothProfileRings(
          shape,
          ratios.map((yRatio, index) => {
            const width = widths[index]

            const fallback = {
              y: shape.yAt(yRatio),

              width,

              depth: legDepth(width),

              centerX: side * legCenter,
            }

            return {
              yRatio,

              scale: profileScaleForWidth(
                shape,
                yRatio,
                width,
                bodySide,
                defaultProfileScale,
              ),
              depthScale: 1.08,

              fallback,
            }
          }),
          bodySide,
        ),
        false,
      )
    }),
  ]
}

function createSkirt(
  body: BodyMeasurements,
  garment: GarmentMeasurements,
  name: string,
  profile?: AvatarBodyProfile,
) {
  const shape = dimensions(body, garment, profile)

  const text = normalizedText("", name)

  const length = garment.length ?? body.height * 0.42

  const hemRatio = Math.max(0.2, 0.6 - length / 100 / shape.height)

  const measuredHemWidth = measuredContour(garment.hemWidth)

  const hemWidth =
    measuredHemWidth ??
    shape.hipWidth * (/fluida|fluid|wide|plisad/.test(text) ? 1.55 : 1.28)

  const waistRatio = easeRatio(
    garment.waistWidth,
    body.waist,
    garment.stretchPercent,
  )

  const hipRatio = easeRatio(
    garment.hipWidth,
    body.hips,
    garment.stretchPercent,
  )

  return makeLoft(
    smoothProfileRings(shape, [
      {
        yRatio: hemRatio,

        scale:
          measuredHemWidth === null
            ? hipRatio
            : profileScaleForWidth(shape, hemRatio, hemWidth, "body", hipRatio),

        fallback: { y: 0, width: hemWidth, depth: shape.depth(hemWidth) },
      },

      {
        yRatio: 0.51,
        scale: hipRatio,
        fallback: {
          y: shape.hipY,
          width: shape.hipWidth * 1.04,
          depth: shape.depth(shape.hipWidth),
        },
      },

      {
        yRatio: 0.6,
        scale: waistRatio,
        fallback: {
          y: shape.waistY,
          width: shape.waistWidth,
          depth: shape.depth(shape.waistWidth),
        },
      },
    ]),
    false,
  )
}

function createDress(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  category: string,

  name: string,

  profile?: AvatarBodyProfile,

  design = garmentDesignId(category, name),
) {
  const shape = dimensions(body, garment, profile)

  const text = normalizedText(category, name)

  const requestedLength = garment.length ?? body.height * 0.66

  const length =
    design === "red-mini-dress"
      ? Math.min(requestedLength, body.height * 0.52)
      : requestedLength

  const necklineRatio = design === "red-mini-dress" ? 0.76 : 0.82

  const hemRatio = Math.max(0.12, necklineRatio - length / 100 / shape.height)

  const depthClearance = design === "red-mini-dress" ? 1.08 : 1

  const measuredHemWidth = measuredContour(garment.hemWidth)

  const hemWidth =
    measuredHemWidth ??
    shape.hipWidth * (/fluido|fluid|evas|maxi/.test(text) ? 1.5 : 1.18)

  const waistRatio = easeRatio(
    garment.waistWidth,
    body.waist,
    garment.stretchPercent,
  )

  const chestRatio = easeRatio(
    garment.chestWidth,
    body.chest,
    garment.stretchPercent,
  )

  const hipRatio = easeRatio(
    garment.hipWidth,
    body.hips,
    garment.stretchPercent,
  )

  const shoulderRatio = (garment.shoulderWidth ?? body.shoulder) / body.shoulder

  const bodiceControls: ProfileRingControl[] = [
    {
      yRatio: 0.6,
      scale: waistRatio,
      depthScale: depthClearance,
      fallback: {
        y: shape.waistY,
        width: shape.waistWidth,
        depth: shape.depth(shape.waistWidth),
      },
    },
    {
      yRatio: 0.72,
      scale: chestRatio,
      depthScale: depthClearance,
      fallback: {
        y: shape.yAt(0.72),
        width: shape.chestWidth,
        depth: shape.depth(shape.chestWidth),
      },
    },
  ]

  bodiceControls.push(
    design === "red-mini-dress"
      ? {
          yRatio: necklineRatio,
          scale: chestRatio,
          depthScale: depthClearance,
          fallback: {
            y: shape.yAt(necklineRatio),
            width: shape.chestWidth,
            depth: shape.depth(shape.chestWidth),
          },
        }
      : {
          yRatio: 0.82,
          scale: shoulderRatio,
          depthScale: depthClearance,
          fallback: {
            y: shape.shoulderY,
            width: shape.shoulderWidth,
            depth: shape.depth(shape.chestWidth) * 0.85,
          },
        },
  )

  const bodice = makeLoft(smoothProfileRings(shape, bodiceControls), false)

  const skirt = makeLoft(
    smoothProfileRings(shape, [
      {
        yRatio: hemRatio,

        scale:
          measuredHemWidth === null
            ? hipRatio
            : profileScaleForWidth(shape, hemRatio, hemWidth, "body", hipRatio),
        depthScale: depthClearance,

        fallback: { y: 0, width: hemWidth, depth: shape.depth(hemWidth) },
      },

      {
        yRatio: 0.51,
        scale: hipRatio,
        depthScale: depthClearance,
        fallback: {
          y: shape.hipY,
          width: shape.hipWidth,
          depth: shape.depth(shape.hipWidth),
        },
      },

      {
        yRatio: 0.6,
        scale: waistRatio,
        depthScale: depthClearance,
        fallback: {
          y: shape.waistY,
          width: shape.waistWidth,
          depth: shape.depth(shape.waistWidth),
        },
      },
    ]),
    false,
  )

  return [
    bodice,

    skirt,

    ...createSleeves(
      body,
      garment,
      shape,
      design === "red-mini-dress"
        ? 0
        : sleeveLengthRatio("dress", category, name),
    ),
  ]
}

export function createGarmentGeometries(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  category: string,

  name: string,

  profile?: AvatarBodyProfile,
): BufferGeometry[] {
  const design = garmentDesignId(category, name)

  let style = garmentSilhouette(category, name, garment.cut ?? "")

  if (design === "lirio") style = "bootcut-trousers"

  if (design === "anat" || design === "cargo-jean") style = "wide-trousers"

  if (design === "drill") style = "slim-trousers"

  if (design === "puffer-vest") style = "outerwear"

  const nameWithCut = `${name} ${garment.cut ?? ""}`

  if (
    style === "trousers" ||
    style === "wide-trousers" ||
    style === "slim-trousers" ||
    style === "bootcut-trousers" ||
    style === "shorts"
  ) {
    return createTrousers(body, garment, style, profile)
  }

  if (style === "skirt")
    return [createSkirt(body, garment, nameWithCut, profile)]

  if (style === "dress")
    return createDress(body, garment, category, nameWithCut, profile, design)

  if (style === "set") {
    return [
      ...createUpperGarment(
        body,
        garment,
        "top",
        category,
        nameWithCut,
        body.height * 0.34,
        profile,
        design,
      ),

      ...createTrousers(body, garment, "trousers", profile),
    ]
  }

  return createUpperGarment(
    body,
    garment,
    style,
    category,
    nameWithCut,
    undefined,
    profile,
    design,
  )
}

export interface GarmentDetailGeometry {
  geometry: BufferGeometry

  color: string

  roughness: number

  metalness?: number
}

interface GarmentSurfacePoint {
  yRatio: number

  xRatio: number
}

type SurfaceSide = "body" | "leftLeg" | "rightLeg"

function frontPoint(
  shape: ReturnType<typeof dimensions>,

  point: GarmentSurfacePoint,

  side: SurfaceSide = "body",

  clearance = 1.025,
) {
  const xRatio = Math.min(0.94, Math.max(-0.94, point.xRatio))

  const section = bodySection(shape.profile, point.yRatio, side)

  const fitScale =
    point.yRatio >= 0.78
      ? shape.shoulderScale
      : point.yRatio >= 0.68
        ? shape.chestScale
        : point.yRatio >= 0.57
          ? shape.waistScale
          : shape.hipScale

  const shellScale = Math.min(
    1.4,
    Math.max(1.015, side === "body" ? fitScale : shape.hipScale * 1.12),
  )

  const fallbackWidth =
    point.yRatio > 0.68
      ? shape.chestWidth
      : point.yRatio > 0.49
        ? shape.waistWidth
        : shape.hipWidth

  const width =
    (section?.width ??
      (side === "body" ? fallbackWidth : shape.hipWidth * 0.42)) *
    shellScale *
    clearance

  const depth = (section?.depth ?? shape.depth(width)) * shellScale * clearance

  const centerX =
    section?.centerX ??
    (side === "leftLeg"
      ? -shape.hipWidth * 0.2
      : side === "rightLeg"
        ? shape.hipWidth * 0.2
        : 0)

  const centerZ = section?.centerZ ?? 0

  const frontCurve = Math.sqrt(Math.max(0.08, 1 - xRatio * xRatio))

  return new Vector3(
    centerX + (width * xRatio) / 2,

    shape.yAt(point.yRatio),

    centerZ + (depth * frontCurve) / 2 + 0.008,
  )
}

function polygonGeometry(points: Vector3[]) {
  const geometry = new BufferGeometry()

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      points.flatMap((point) => [point.x, point.y, point.z]),
      3,
    ),
  )

  const indices: number[] = []

  for (let index = 1; index < points.length - 1; index++)
    indices.push(0, index, index + 1)

  geometry.setIndex(indices)

  geometry.computeVertexNormals()

  return geometry
}

function frontPolygonGeometry(
  shape: ReturnType<typeof dimensions>,

  points: GarmentSurfacePoint[],

  side: SurfaceSide = "body",
) {
  return polygonGeometry(points.map((point) => frontPoint(shape, point, side)))
}

function frontRibbonGeometry(
  shape: ReturnType<typeof dimensions>,

  path: GarmentSurfacePoint[],

  halfWidth: number,

  side: SurfaceSide = "body",
) {
  const geometry = new BufferGeometry()

  const positions: number[] = []

  const indices: number[] = []

  for (let index = 0; index < path.length - 1; index++) {
    const first = path[index]

    const second = path[index + 1]

    const offset = positions.length / 3

    for (const point of [
      { yRatio: first.yRatio, xRatio: first.xRatio - halfWidth },

      { yRatio: first.yRatio, xRatio: first.xRatio + halfWidth },

      { yRatio: second.yRatio, xRatio: second.xRatio + halfWidth },

      { yRatio: second.yRatio, xRatio: second.xRatio - halfWidth },
    ]) {
      const position = frontPoint(shape, point, side, 1.03)

      positions.push(position.x, position.y, position.z)
    }

    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3)
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))

  geometry.setIndex(indices)

  geometry.computeVertexNormals()

  return geometry
}

function shadeColor(color: string, amount: number) {
  const normalized = /^#[\da-f]{6}$/i.test(color) ? color.slice(1) : "C9A96E"

  const channels = [0, 2, 4].map((offset) =>
    parseInt(normalized.slice(offset, offset + 2), 16),
  )

  const shaded = channels.map((channel) =>
    Math.min(
      255,
      Math.max(
        0,
        Math.round(channel + (amount >= 0 ? 255 - channel : channel) * amount),
      ),
    ),
  )

  return `#${shaded.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function addButton(
  result: GarmentDetailGeometry[],

  shape: ReturnType<typeof dimensions>,

  yRatio: number,

  xRatio: number,

  color: string,

  radius = 0.012,
) {
  const position = frontPoint(shape, { yRatio, xRatio })

  const geometry = new SphereGeometry(radius, 10, 8)

  geometry.translate(position.x, position.y, position.z + 0.008)

  result.push({ geometry, color, roughness: 0.42, metalness: 0.38 })
}

function addBand(
  result: GarmentDetailGeometry[],

  shape: ReturnType<typeof dimensions>,

  yRatio: number,

  color: string,
) {
  const section = bodySection(shape.profile, yRatio)

  const width = section?.width ?? shape.chestWidth

  const depth = section?.depth ?? shape.depth(width)

  const centerX = section?.centerX ?? 0

  const centerZ = section?.centerZ ?? 0

  const fitScale =
    yRatio >= 0.78
      ? shape.shoulderScale
      : yRatio >= 0.68
        ? shape.chestScale
        : yRatio >= 0.57
          ? shape.waistScale
          : shape.hipScale

  const rings = [-0.004, 0.004].map((offset) => ({
    y: shape.yAt(yRatio + offset),

    width: width * fitScale * 1.03,

    depth: depth * fitScale * 1.04,

    centerX,

    centerZ,
  }))

  result.push({ geometry: makeLoft(rings, false), color, roughness: 0.9 })
}

function addCrewNeckline(
  result: GarmentDetailGeometry[],

  shape: ReturnType<typeof dimensions>,

  color: string,
) {
  const center = bodySection(shape.profile, 0.84)

  const centerX = center?.centerX ?? 0

  const centerZ = center?.centerZ ?? 0
  const width = Math.min(Math.max(center?.width ?? 0.15, 0.12), 0.18)
  const depth = Math.min(Math.max(center?.depth ?? 0.12, 0.1), 0.15)

  result.push({
    geometry: makeLoft(
      [
        {
          y: shape.yAt(0.835),
          width: width * 1.06,
          depth: depth * 1.06,
          centerX,
          centerZ,
        },
        { y: shape.yAt(0.843), width, depth, centerX, centerZ },
      ],
      false,
    ),

    color,

    roughness: 0.84,
  })
}

function addCollar(
  result: GarmentDetailGeometry[],
  shape: ReturnType<typeof dimensions>,
  color: string,
) {
  const center = bodySection(shape.profile, 0.82)
  const centerX = center?.centerX ?? 0
  const centerZ = center?.centerZ ?? 0

  result.push({
    geometry: makeLoft(
      [
        { y: shape.yAt(0.815), width: 0.19, depth: 0.15, centerX, centerZ },
        { y: shape.yAt(0.835), width: 0.18, depth: 0.14, centerX, centerZ },
        { y: shape.yAt(0.855), width: 0.16, depth: 0.13, centerX, centerZ },
      ],
      false,
    ),
    color,
    roughness: 0.84,
  })
}

function addShirtCollar(
  result: GarmentDetailGeometry[],
  shape: ReturnType<typeof dimensions>,
  color: string,
) {
  addCrewNeckline(result, shape, color)

  for (const side of [-1, 1]) {
    result.push({
      geometry: frontPolygonGeometry(shape, [
        { yRatio: 0.84, xRatio: side * 0.08 },
        { yRatio: 0.84, xRatio: side * 0.42 },
        { yRatio: 0.8, xRatio: side * 0.55 },
        { yRatio: 0.81, xRatio: side * 0.16 },
      ]),
      color,
      roughness: 0.78,
    })
  }

  result.push({
    geometry: frontRibbonGeometry(
      shape,
      [
        { yRatio: 0.84, xRatio: 0 },
        { yRatio: 0.68, xRatio: 0 },
      ],
      0.012,
    ),
    color: shadeColor(color, -0.08),
    roughness: 0.86,
  })

  for (const yRatio of [0.8, 0.76, 0.72])
    addButton(result, shape, yRatio, 0, shadeColor(color, -0.3), 0.006)
}

function addSleeveCuffs(
  result: GarmentDetailGeometry[],

  body: BodyMeasurements,

  garment: GarmentMeasurements,

  shape: ReturnType<typeof dimensions>,

  design: GarmentDesignId,

  color: string,
) {
  const defaultLength = design === "blouse-casual" ? 0.24 : 0.32

  const measuredLength =
    garment.sleeveLength && garment.sleeveLength > 0
      ? garment.sleeveLength / 100 / shape.height
      : defaultLength

  const yRatio = Math.max(0.48, 0.82 - Math.min(measuredLength, 0.48))

  const measuredCuff = measuredContour(garment.cuffWidth)

  for (const side of [-1, 1]) {
    const bodySide = side < 0 ? "leftArm" : "rightArm"

    const section = bodySection(shape.profile, yRatio, bodySide)

    const width =
      measuredCuff ??
      (section?.width ?? Math.max((body.shoulder / 100) * 0.14, 0.06)) * 1.08

    const depth = section?.depth ?? width * 0.78

    const centerX = section?.centerX ?? side * shape.shoulderWidth * 0.76

    const centerZ = section?.centerZ ?? 0

    result.push({
      geometry: makeLoft(
        [-0.005, 0.005].map((offset) => ({
          y: shape.yAt(yRatio + offset),

          width: width * 1.04,

          depth: depth * 1.04,

          centerX,

          centerZ,
        })),
        false,
      ),

      color,

      roughness: 0.86,
    })
  }
}

function addFrontPockets(
  result: GarmentDetailGeometry[],

  shape: ReturnType<typeof dimensions>,

  color: string,

  yRatio: number,

  scale = 1,
) {
  for (const side of [-1, 1]) {
    result.push({
      geometry: frontPolygonGeometry(shape, [
        { yRatio: yRatio + 0.035 * scale, xRatio: side * 0.72 },

        { yRatio: yRatio + 0.035 * scale, xRatio: side * 0.39 },

        { yRatio: yRatio - 0.035 * scale, xRatio: side * 0.39 },

        { yRatio: yRatio - 0.035 * scale, xRatio: side * 0.72 },
      ]),

      color,

      roughness: 0.92,
    })
  }
}

function addLapels(
  result: GarmentDetailGeometry[],
  shape: ReturnType<typeof dimensions>,
  color: string,
) {
  for (const side of [-1, 1]) {
    result.push({
      geometry: frontPolygonGeometry(shape, [
        { yRatio: 0.815, xRatio: side * 0.14 },

        { yRatio: 0.795, xRatio: side * 0.68 },

        { yRatio: 0.715, xRatio: side * 0.35 },

        { yRatio: 0.765, xRatio: side * 0.045 },
      ]),

      color,

      roughness: 0.82,
    })
  }
}

function addButtonRow(
  result: GarmentDetailGeometry[],

  shape: ReturnType<typeof dimensions>,

  color: string,

  ratios: number[],

  radius = 0.011,
) {
  ratios.forEach((yRatio) =>
    addButton(result, shape, yRatio, 0.035, color, radius),
  )
}

export function createGarmentDetails(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  category: string,

  name: string,

  color: string,

  profile?: AvatarBodyProfile,
): GarmentDetailGeometry[] {
  const design = garmentDesignId(category, name)

  const shapeGarment = measurementsForDesign(body, garment, design)

  const shape = dimensions(body, shapeGarment, profile)

  const details: GarmentDetailGeometry[] = []

  const seam = shadeColor(color, -0.22)

  const highlight = shadeColor(color, 0.18)

  const trouserDesigns = ["lirio", "anat", "cargo-jean", "drill"]

  if (trouserDesigns.includes(design)) {
    for (const side of ["leftLeg", "rightLeg"] as const) {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.49, xRatio: 0 },

            { yRatio: 0.31, xRatio: 0 },

            { yRatio: 0.08, xRatio: 0 },
          ],
          0.008,
          side,
        ),

        color: design === "cargo-jean" ? shadeColor(color, 0.12) : seam,

        roughness: 0.9,
      })
    }
  }

  if (design === "lirio") {
    return details
  }

  if (design === "anat") {
    for (const side of [-1, 1]) {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.585, xRatio: side * 0.14 },

            { yRatio: 0.54, xRatio: side * 0.2 },

            { yRatio: 0.49, xRatio: side * 0.25 },
          ],
          0.009,
        ),

        color: seam,

        roughness: 0.88,
      })
    }

    addFrontPockets(details, shape, seam, 0.53, 0.7)
  }

  if (design === "cargo-jean") {
    for (const side of [-1, 1]) {
      details.push({
        geometry: frontPolygonGeometry(
          shape,
          [
            { yRatio: 0.42, xRatio: side * 0.9 },

            { yRatio: 0.42, xRatio: side * 0.48 },

            { yRatio: 0.32, xRatio: side * 0.48 },

            { yRatio: 0.32, xRatio: side * 0.9 },
          ],
          side < 0 ? "leftLeg" : "rightLeg",
        ),

        color: shadeColor(color, 0.08),

        roughness: 0.94,
      })

      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.33, xRatio: 0 },

            { yRatio: 0.33, xRatio: side * 0.42 },
          ],
          0.012,
          side < 0 ? "leftLeg" : "rightLeg",
        ),

        color: seam,

        roughness: 0.9,
      })
    }
  }

  if (design === "drill") {
    for (const side of [-1, 1]) {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.49, xRatio: side * 0.75 },

            { yRatio: 0.28, xRatio: side * 0.72 },

            { yRatio: 0.08, xRatio: side * 0.68 },
          ],
          0.006,
          side < 0 ? "leftLeg" : "rightLeg",
        ),

        color: seam,

        roughness: 0.9,
      })
    }
  }

  if (design === "polo") {
    if (/camisero|button[- ]?down/.test(normalizedText(category, name)))
      addShirtCollar(details, shape, seam)
    else addCrewNeckline(details, shape, seam)

    details.push({
      geometry: frontPolygonGeometry(shape, [
        { yRatio: 0.745, xRatio: 0.61 },

        { yRatio: 0.745, xRatio: 0.49 },

        { yRatio: 0.705, xRatio: 0.49 },

        { yRatio: 0.705, xRatio: 0.61 },
      ]),

      color: "#B62832",

      roughness: 0.72,
    })
  }

  if (design === "red-mini-dress") {
    const gatheringRows = [
      0.62, 0.65, 0.68, 0.71, 0.74, 0.55, 0.52, 0.49, 0.46, 0.43,
    ]

    gatheringRows.forEach((yRatio, index) => {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio, xRatio: -0.78 },
            { yRatio, xRatio: 0.78 },
          ],
          0.0035,
        ),

        color: shadeColor(color, index % 2 === 0 ? -0.12 : 0.1),

        roughness: 0.28,
      })
    })

    details.push(
      {
        geometry: frontPolygonGeometry(shape, [
          { yRatio: 0.555, xRatio: -0.58 },

          { yRatio: 0.585, xRatio: -0.82 },

          { yRatio: 0.54, xRatio: -0.76 },

          { yRatio: 0.515, xRatio: -0.58 },
        ]),
        color: highlight,
        roughness: 0.25,
      },

      {
        geometry: frontPolygonGeometry(shape, [
          { yRatio: 0.555, xRatio: -0.58 },

          { yRatio: 0.585, xRatio: -0.34 },

          { yRatio: 0.54, xRatio: -0.4 },

          { yRatio: 0.515, xRatio: -0.58 },
        ]),
        color: shadeColor(color, 0.22),
        roughness: 0.25,
      },
    )

    addButton(details, shape, 0.55, -0.58, "#E4C16B", 0.018)
  }

  if (design === "puffer" || design === "puffer-vest") {
    const seamColor = shadeColor(color, -0.12)

    for (const yRatio of [0.56, 0.62, 0.68, 0.74, 0.8])
      addBand(details, shape, yRatio, seamColor)

    details.push({
      geometry: frontRibbonGeometry(
        shape,
        [
          { yRatio: 0.81, xRatio: 0 },

          { yRatio: 0.67, xRatio: 0 },

          { yRatio: 0.52, xRatio: 0 },
        ],
        0.009,
      ),

      color: seam,

      roughness: 0.8,
    })

    addCollar(details, shape, shadeColor(color, -0.08))

    addFrontPockets(details, shape, seamColor, 0.59, 0.9)

    if (design === "puffer")
      addSleeveCuffs(details, body, garment, shape, design, seamColor)
  }

  if (
    design === "blazer-americano" ||
    design === "blazer-essence" ||
    design === "blazer-perla"
  ) {
    addLapels(details, shape, design === "blazer-perla" ? highlight : seam)

    const buttonColor =
      design === "blazer-perla" ? "#C6A15B" : shadeColor(color, 0.5)

    addButtonRow(
      details,
      shape,
      buttonColor,
      design === "blazer-americano" ? [0.66, 0.59] : [0.62],
      0.014,
    )

    addFrontPockets(details, shape, seam, 0.55, 0.75)

    if (design === "blazer-essence") {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.55, xRatio: -0.94 },

            { yRatio: 0.55, xRatio: 0.94 },
          ],
          0.006,
        ),

        color: seam,

        roughness: 0.9,
      })
    }
  }

  if (design === "fur-boxy") {
    addCollar(details, shape, "#E9E4D9")

    addFrontPockets(details, shape, "#D9D4CA", 0.56, 0.9)

    addButtonRow(details, shape, "#9A8064", [0.7, 0.61, 0.52], 0.014)
  }

  if (design === "blouse-long" || design === "blouse-casual") {
    const collarColor = design === "blouse-casual" ? highlight : seam

    details.push(
      {
        geometry: frontPolygonGeometry(shape, [
          { yRatio: 0.82, xRatio: -0.22 },

          { yRatio: 0.75, xRatio: -0.08 },

          { yRatio: 0.68, xRatio: -0.03 },

          { yRatio: 0.76, xRatio: -0.42 },
        ]),

        color: collarColor,

        roughness: 0.75,
      },
      {
        geometry: frontPolygonGeometry(shape, [
          { yRatio: 0.82, xRatio: 0.22 },

          { yRatio: 0.75, xRatio: 0.08 },

          { yRatio: 0.68, xRatio: 0.03 },

          { yRatio: 0.76, xRatio: 0.42 },
        ]),

        color: collarColor,

        roughness: 0.75,
      },
    )

    addButtonRow(
      details,
      shape,
      shadeColor(color, -0.45),
      [0.72, 0.66, 0.6, 0.54],
      0.008,
    )

    addSleeveCuffs(details, body, garment, shape, design, seam)

    if (design === "blouse-casual") {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.765, xRatio: -0.08 },

            { yRatio: 0.69, xRatio: 0 },
          ],
          0.012,
        ),

        color: seam,

        roughness: 0.72,
      })
    }
  }

  if (design === "coat-plaid") {
    addLapels(details, shape, "#24211F")

    addButtonRow(details, shape, "#382F28", [0.68, 0.59, 0.5], 0.014)

    for (const yRatio of [0.46, 0.54, 0.62, 0.7, 0.78]) {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio, xRatio: -0.92 },

            { yRatio, xRatio: 0.92 },
          ],
          0.007,
        ),

        color: "#9B7955",

        roughness: 0.96,
      })
    }

    for (const xRatio of [-0.7, -0.35, 0, 0.35, 0.7]) {
      details.push({
        geometry: frontRibbonGeometry(
          shape,
          [
            { yRatio: 0.79, xRatio },

            { yRatio: 0.61, xRatio },

            { yRatio: 0.43, xRatio },
          ],
          0.007,
        ),

        color: "#46382F",

        roughness: 0.96,
      })
    }
  }

  if (design === "parka") {
    addCollar(details, shape, shadeColor(color, -0.12))

    details.push({
      geometry: frontRibbonGeometry(
        shape,
        [
          { yRatio: 0.81, xRatio: 0 },

          { yRatio: 0.63, xRatio: 0 },

          { yRatio: 0.44, xRatio: 0 },
        ],
        0.012,
      ),

      color: seam,

      roughness: 0.9,
    })

    addFrontPockets(details, shape, shadeColor(color, -0.1), 0.55, 1.15)

    const center = bodySection(shape.profile, 0.83)

    const hood = new SphereGeometry(0.16, 14, 10)

    hood.scale(1.05, 0.86, 0.78)

    hood.translate(
      center?.centerX ?? 0,
      shape.yAt(0.86),
      (center?.centerZ ?? 0) - 0.13,
    )

    details.push({
      geometry: hood,
      color: shadeColor(color, -0.06),
      roughness: 0.96,
    })
  }

  return details
  if (lower) {
    const skirt = style === 'skirt'
    const pantsTop = waistY
    // A set or jumpsuit uses the overall length for the top, so legs follow the body.
    const length = style === 'tracksuit' || style === 'jumpsuit' ? height * 0.57
      : (measurements.length ?? height * (style === 'shorts' || skirt ? 24 : 57)) / 100
    const cuff = clamp(pantsTop - length, height * 0.045, height * 0.54)
    const hip = torsoRings(height * 0.525)
    const waist = torsoRings(waistY)
    const hipEase = allowance(measurements.hipWidth, hip?.circumference ?? 0.95)
    const waistEase = allowance(measurements.waistWidth, waist?.circumference ?? 0.8)
    const crotchY = Array.from({ length: 31 }, (_, i) => height * (0.44 + i * 0.004))
      .find(y => !!central(y)) ?? height * 0.51
    const pelvisRings = cachedRings(y => at(y)
      .filter(group => group.maxX > -0.16 && group.minX < 0.16)
      .flatMap(group => group.points))
    // Above the fork both legs share the same perimeter at the hips. Their
    // inner arcs collapse into the hidden dividing plane of the two panels.
    for (const side of skirt ? [0] : [-1, 1]) {
      const rings = cachedRings(y => {
        const sections = at(y)
        if (side === 0) return sections.filter(group => group.maxX > -0.18 && group.minX < 0.18).flatMap(group => group.points)
        const middle = central(y)
        if (middle) return clipAtX(hull(middle.points), -side * 0.004, side)
        // At wrist height, the hands are the outermost sections. The leg
        // is the section closest to the centre on this side.
        const leg = side > 0
          ? sections.find(group => group.minX >= 0)
          : sections.slice().reverse().find(group => group.maxX <= 0)
        return leg?.points ?? []
      })
      const leg = shell((t, around) => {
        const y = mix(cuff, pantsTop, t)
        const ring = rings(y)
        if (!ring) return null
        const axis = Math.sin(around * turn) * side
        const medial = side !== 0 && axis < 0
        const ease = mix(hipEase, waistEase, clamp((y / height - 0.52) * 10, 0, 1))
        const drape = drapeAllowance(ring, style === 'wideLeg' ? 0.48 : 0.33, around)
        const flare = skirt ? 0.065 * (1 - t) : (1 - t) * drape
        const point = drawPoint(ring, y, around, medial ? 0.008 : 0.013, (medial ? 0 : ease * 0.65) + flare)
        if (point && side !== 0 && y > crotchY - 0.045) {
          const pelvis = pelvisRings(y)
          const blend = clamp((y - crotchY + 0.045) / 0.085, 0, 1)
          const hipPoint = drawPoint(pelvis, y, around, 0.015, ease * 0.65)
          if (hipPoint && pelvis && blend > 0) {
            if (medial) {
              const front = drawPoint(pelvis, y, 0, 0.015, ease * 0.65)!
              const back = drawPoint(pelvis, y, 0.5, 0.015, ease * 0.65)!
              hipPoint.copy(back).lerp(front, (Math.cos(around * turn) + 1) / 2)
              hipPoint.x -= side * 0.005
            }
            if (central(y) && medial) point.x = side * Math.max(-0.008, side * point.x)
            point.lerp(hipPoint, blend ** 2 * (3 - 2 * blend))
          }
        }
        return point
      }, rowCount(pantsTop - cuff))
      if (!leg) {
        pieces.forEach(piece => piece.geometry.dispose())
        return []
      }
      pieces.push({ geometry: leg.geometry, finish: 'fabric' })
      addStitch(pieces, leg, [0, 0], [0, 1], 'trim', 0.003)
      addStitch(pieces, leg, [0.97, 0], [0.97, 1], 'trim', 0.004)
      if (!skirt) {
        addStitch(pieces, leg, [0.04, side * 0.24], [0.96, side * 0.24], 'thread', 0.0018)
        addStitch(pieces, leg, [0.97, side * 0.055], [0.82, side * 0.20], 'trim', 0.0027)
      }
    }
  }

  return pieces
}
