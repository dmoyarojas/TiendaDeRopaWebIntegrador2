import { Box3, Group, type Object3D } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

export function prepareCladScene(scene: Object3D) {
  // Solo rotación y traslación; las dimensiones en metros deben conservarse.
  const oriented = new Group()
  const zUp = new Group()
  zUp.rotation.x = -Math.PI / 2
  zUp.add(clone(scene))
  oriented.rotation.y = Math.PI
  oriented.add(zUp)
  oriented.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(oriented)
  if (!Number.isFinite(bounds.max.y - bounds.min.y) || bounds.max.y <= bounds.min.y) throw new Error('Modelo corporal inválido')
  oriented.position.set(-(bounds.max.x + bounds.min.x) / 2, -bounds.min.y, -(bounds.max.z + bounds.min.z) / 2)
  return oriented
}
