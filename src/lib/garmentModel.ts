import {
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
