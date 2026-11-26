import { Box3, Group, Mesh, type Object3D } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

export function prepareCladScene(scene: Object3D) {
  // Clad exporta en Z-up y mira hacia -Y; esta conversión deja el frente en +Z.
  const oriented = new Group()
  const zUp = new Group()
  zUp.rotation.x = -Math.PI / 2
  const model = clone(scene)
  model.traverse(object => {
    if (!(object instanceof Mesh)) return
    object.geometry = object.geometry.clone()
    if (!object.geometry.getAttribute('normal')) object.geometry.computeVertexNormals()
  })
  zUp.add(model)
  oriented.add(zUp)
  oriented.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(oriented)
  if (!Number.isFinite(bounds.max.y - bounds.min.y) || bounds.max.y <= bounds.min.y) throw new Error('Modelo corporal inválido')
  oriented.position.set(-(bounds.max.x + bounds.min.x) / 2, -bounds.min.y, -(bounds.max.z + bounds.min.z) / 2)
  return oriented
}
