import { Mesh, Vector3, type Object3D } from 'three'

export interface Point { x: number; z: number }
export interface Section { minX: number; maxX: number; points: Point[] }
type Triangle = [Vector3, Vector3, Vector3]

// Sample the actual GLB in the coordinate system used by the viewer.
export function sampleBodySurface(model: Object3D) {
  const step = 0.005
  const buckets: Triangle[][] = []
  const sections = new Map<number, Section[]>()
  let height = 0
  model.updateMatrixWorld(true)
  model.traverse(object => {
    if (!(object instanceof Mesh)) return
    const { index } = object.geometry
    const position = object.geometry.getAttribute('position')
    if (!position) return
    const vertices = Array.from({ length: position.count }, (_, i) => {
      const point = object.getVertexPosition(i, new Vector3()).applyMatrix4(object.matrixWorld)
      height = Math.max(height, point.y)
      return point
    })
    const count = index?.count ?? position.count
    for (let i = 0; i + 2 < count; i += 3) {
      const a = vertices[index ? index.getX(i) : i]
      const b = vertices[index ? index.getX(i + 1) : i + 1]
      const c = vertices[index ? index.getX(i + 2) : i + 2]
      const first = Math.max(0, Math.ceil(Math.min(a.y, b.y, c.y) / step))
      const last = Math.floor(Math.max(a.y, b.y, c.y) / step)
      for (let row = first; row <= last; row++) (buckets[row] ??= []).push([a, b, c])
    }
  })

  function at(y: number) {
    const row = Math.round(y / step)
    const cached = sections.get(row)
    if (cached) return cached
    const plane = row * step
    const spans: Section[] = []
    for (const [a, b, c] of buckets[row] ?? []) {
      const points: Point[] = []
      for (const [first, last] of [[a, b], [b, c], [c, a]]) {
        if ((first.y <= plane) === (last.y <= plane)) continue
        const fraction = (plane - first.y) / (last.y - first.y)
        points.push({
          x: first.x + (last.x - first.x) * fraction,
          z: first.z + (last.z - first.z) * fraction,
        })
      }
      if (points.length === 2) spans.push({
        minX: Math.min(points[0].x, points[1].x),
        maxX: Math.max(points[0].x, points[1].x),
        points,
      })
    }
    spans.sort((a, b) => a.minX - b.minX)
    const groups: Section[] = []
    for (const span of spans) {
      const previous = groups.at(-1)
      if (previous && span.minX <= previous.maxX + 0.0005) {
        previous.maxX = Math.max(previous.maxX, span.maxX)
        previous.points.push(...span.points)
      } else {
        groups.push(span)
      }
    }
    sections.set(row, groups)
    return groups
  }

  const central = (y: number) => at(y).find(group => group.minX <= 0 && group.maxX >= 0)
  return { height, at, central }
}

export type BodySurface = ReturnType<typeof sampleBodySurface>
