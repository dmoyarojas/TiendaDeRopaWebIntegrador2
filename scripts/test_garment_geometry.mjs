import assert from 'node:assert/strict'
import {
  Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3,
} from 'three'
import { sampleBodySurface } from '../src/lib/bodySurface.ts'
import { createGarmentPieces, garmentStyle } from '../src/lib/garmentModel.ts'

const material = new MeshBasicMaterial({ side: DoubleSide })
const measurements = { chestWidth: 38, waistWidth: 33, hipWidth: 42, shoulderWidth: 41, length: 73, stretchPercent: 0 }

function mannequin(height, width) {
  const model = new Group()
  function section(rings) {
    const vertices = []
    const indices = []
    for (const [y, cx, rx, rz, cz = 0] of rings) {
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2
        vertices.push((cx + Math.sin(a) * rx) * width, y * height, cz + Math.cos(a) * rz)
      }
    }
    for (let row = 0; row < rings.length - 1; row++) {
      for (let i = 0; i < 48; i++) {
        const a = row * 48 + i
        const b = row * 48 + (i + 1) % 48
        indices.push(a, b, a + 48, b, b + 48, a + 48)
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    model.add(new Mesh(geometry, material))
  }
  section([
    [0.49, 0, 0.19, 0.11], [0.53, 0, 0.19, 0.125], [0.615, 0, 0.137, 0.094],
    [0.735, 0, 0.172, 0.13, 0.016], [0.79, 0, 0.175, 0.097],
    [0.815, 0, 0.19, 0.079], [0.84, 0, 0.106, 0.065], [0.865, 0, 0.054, 0.053],
    [0.91, 0, 0.08, 0.075], [0.955, 0, 0.076, 0.074], [1, 0, 0.015, 0.015],
  ])
  for (const side of [-1, 1]) {
    section([
      [0, side * 0.12, 0.055, 0.086], [0.058, side * 0.12, 0.047, 0.06],
      [0.21, side * 0.117, 0.068, 0.066], [0.3, side * 0.107, 0.067, 0.067],
      [0.435, side * 0.106, 0.081, 0.09], [0.525, side * 0.093, 0.098, 0.119],
    ])
    section([
      [0.425, side * 0.33, 0.04, 0.029], [0.47, side * 0.32, 0.037, 0.038],
      [0.56, side * 0.285, 0.05, 0.054], [0.66, side * 0.25, 0.056, 0.054],
      [0.74, side * 0.221, 0.063, 0.061], [0.81, side * 0.181, 0.052, 0.069],
      [0.828, side * 0.17, 0.023, 0.045],
    ])
  }
  return model
}

// Rays start outside both meshes. At each covered cross section they must
// meet fabric first, even when the size data is narrower than the avatar.
function checkCoverage(body, piece, y, x = 0, z = 0, angles = 48) {
  const mesh = new Mesh(piece.geometry, material)
  let checked = 0
  for (let step = 0; step < angles; step++) {
    const angle = step * Math.PI * 2 / angles
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    const origin = new Vector3(x + dx * 0.13, y, z + dz * 0.13)
    const direction = new Vector3(-dx, 0, -dz)
    // Rebase outside the outermost body hit, then compare equivalent rays.
    const farOrigin = origin.clone().addScaledVector(direction, -0.45)
    const bodyHits = new Raycaster(farOrigin, direction).intersectObject(body)
      .filter(hit => hit.point.distanceTo(origin) < 0.22 && hit.distance <= 0.58)
    if (!bodyHits.length) continue
    const hits = new Raycaster(farOrigin, direction).intersectObject(mesh)
    if (!hits.length || hits[0].distance > bodyHits[0].distance - 0.002) continue
    checked++
  }
  return checked
}

for (const [height, width] of [[1.58, 0.9], [1.72, 1], [1.89, 1.17]]) {
  const model = mannequin(height, width)
  const body = sampleBodySurface(model)
  assert.ok(Math.abs(body.height - height) < 0.001)
  const blazer = createGarmentPieces(body, measurements, 'blazer')
  const fabric = blazer.filter(piece => piece.finish === 'fabric')
  assert.equal(fabric.length, 3, 'a blazer has a torso and two sleeves')
  assert.equal(blazer.filter(piece => piece.finish === 'button').length, 3)
  const americano = createGarmentPieces(body, measurements, 'americano')
  assert.equal(americano.filter(piece => piece.finish === 'fabric').length, 3)
  assert.equal(americano.filter(piece => piece.finish === 'button').length, 2)
  const poloGris = createGarmentPieces(body, measurements, 'poloGris')
  assert.equal(poloGris.filter(piece => piece.finish === 'fabric').length, 3)
  assert.equal(poloGris.filter(piece => piece.finish === 'lightButton').length, 2)
  for (const y of [0.52, 0.616, 0.705]) {
    const count = checkCoverage(model, fabric[0], height * y)
    // The hand or arm can be the outermost hit at the sides of a torso ray.
    assert.ok(count >= 32, `at least 32/48 torso rays are covered at ${y}, got ${count}`)
  }
  const pants = createGarmentPieces(body, { ...measurements, length: height * 56 }, 'wideLeg')
  const legs = pants.filter(piece => piece.finish === 'fabric')
  assert.equal(legs.length, 2, 'trousers have a separate mesh for each leg')
  for (const [index, side] of [-1, 1].entries()) {
    assert.ok(checkCoverage(model, legs[index], height * 0.26, side * 0.11 * width) >= 34)
  }
  for (const style of ['vest', 'tee', 'polo', 'puffer', 'coat', 'shirt', 'skirt', 'dress', 'tracksuit', 'jumpsuit', 'shorts', 'pants']) {
    const pieces = createGarmentPieces(body, measurements, style)
    assert.ok(pieces.length > 0, `expected a renderable ${style} at ${height} m`)
    for (const { geometry } of pieces) {
      const bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position'))
      assert.ok(Number.isFinite(bounds.min.length() + bounds.max.length()))
      geometry.dispose()
    }
  }
  for (const { geometry } of [...blazer, ...americano, ...poloGris, ...pants]) geometry.dispose()
}
assert.equal(garmentStyle('Polo camisero - gris', 'Blazers'), 'poloGris')
assert.equal(garmentStyle('Polo camisero', 'Blazers'), 'polo')
assert.equal(garmentStyle('Blazer Americano', 'Blazers'), 'americano')
assert.equal(garmentStyle('Chaleco sin Mangas', 'Abrigos'), 'vest')
assert.equal(garmentStyle('Bufanda', 'Accesorios'), null)
material.dispose()
console.log('Geometría de ropa: 16 cortes, tres cuerpos, mangas y piernas separadas, cobertura del torso y las piernas.')
