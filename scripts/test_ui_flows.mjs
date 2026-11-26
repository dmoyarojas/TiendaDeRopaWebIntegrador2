import assert from "node:assert/strict"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildAdminOrderRows } from '../src/lib/adminOrders.ts'
import * as garmentModel from '../src/lib/garmentModel.ts'

import { readFileSync } from "node:fs"

import { createRequire } from "node:module"

import { resolve } from "node:path"

import { pathToFileURL } from "node:url"

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three"

import ts from "typescript"

import React from "react"

import { renderToStaticMarkup } from "react-dom/server"

import { buildAdminOrderRows } from "../src/lib/adminOrders.ts"
import { prepareCladScene } from "../src/lib/cladModel.ts"

import {
  createGarmentDetails,
  createGarmentGeometries,
  extractAvatarBodyProfile,
  garmentDesignId,
  garmentDisplayColor,
  garmentSilhouette,
} from "../src/lib/garmentModel.ts"

function loadModule(file, mocks = {}) {
  const filename = resolve(file)

  const require = createRequire(pathToFileURL(filename))

  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  const module = { exports: {} }

  new Function("require", "module", "exports", output)(
    (name) => (name in mocks ? mocks[name] : require(name)),
    module,
    module.exports,
  )

  return module.exports
}

function loadComponent(file, mocks = {}) {
  return loadModule(file, mocks).default
}

const OrdersPanel = loadComponent("src/components/AdminOrdersPanel.tsx")

const order = {
  id: "order-1",
  numero_orden: "VL-TEST",
  monto_total: 200000,
  creado_el: "2026-10-28T12:00:00Z",
  perfiles: { nombre: "Cliente", apellido: "Prueba" },
}

const rows = buildAdminOrderRows(
  [
    {
      ...order,
      pedido_productos: [
        {
          id: "item-1",
          codigo_producto: "ART-TEST",
          nombre_producto: "Blazer",
          talla: "M",
          estado: "pendiente",
        },
      ],
    },

    { ...order, id: "legacy", numero_orden: null, pedido_productos: null },

    {
      id: null,
      creado_el: "invalid",
      monto_total: "invalid",
      perfiles: [],
      pedido_productos: [null, { estado: {} }],
    },
  ],
  1000,
)

const html = renderToStaticMarkup(
  React.createElement(OrdersPanel, {
    rows,
    loading: false,
    onRefresh: async () => {},
    onStatusChange: async () => {},
  }),
)

assert.ok(html.includes("Pedidos recientes"))

assert.ok(html.includes("ART-TEST"))

assert.ok(html.includes("Pedido antiguo sin detalle"))

assert.ok(html.includes("Fecha no disponible"))

assert.equal(html.includes("[object Object]"), false)

assert.equal(rows.length, 3)

for (const loading of [true, false]) {
  const empty = renderToStaticMarkup(
    React.createElement(OrdersPanel, {
      rows: [],
      loading,
      onRefresh: async () => {},
      onStatusChange: async () => {},
    }),
  )

  assert.ok(
    empty.includes(loading ? "Cargando pedidos" : "No hay pedidos registrados"),
  )
}

const body = {
  gender: "F",
  height: 170,
  weight: 65,
  chest: 92,
  waist: 74,
  hips: 98,
  shoulder: 40,
  inseam: 78,
}

const avatar = {
  modelUrl: "https://private.test/avatar.glb",
  busy: false,
  loading: false,
  accuracy: null,
  savedBody: body,
}

const Fitting = loadComponent("src/components/FittingExperience.tsx", {
  "../lib/supabase": { supabase: {} },

  "../lib/fitting": {
    readSavedBody: () => body,
    assessFit: () => null,
    isReferenceMeasurements: () => false,
  },

  "../lib/clad": { useCladAvatar: () => avatar },

  "./FittingAvatar3D": {
    default: ({ bodyModelUrl }) =>
      React.createElement("div", { "data-avatar": bodyModelUrl }),
  },

  "./ImageWithFallback": {
    default: (props) => React.createElement("img", props),
  },

  "./CladAvatarControls": { default: () => null },
  "./AvatarAccuracyReport": { default: () => null },
  const empty = renderToStaticMarkup(React.createElement(OrdersPanel, { rows: [], loading, onRefresh: async () => {}, onStatusChange: async () => {} }))
  assert.ok(empty.includes(loading ? 'Cargando pedidos' : 'No hay pedidos registrados'))
}

const body = { gender: 'F', height: 170, weight: 65, chest: 92, waist: 74, hips: 98, shoulder: 40, inseam: 78 }
const avatar = { modelUrl: 'https://private.test/avatar.glb', busy: false, loading: false, accuracy: null, savedBody: body }
const Fitting = loadComponent('src/components/FittingExperience.tsx', {
  '../lib/supabase': { supabase: {} },
  '../lib/fitting': { readSavedBody: () => body, assessFit: () => null, isReferenceMeasurements: () => false },
  '../lib/clad': { useCladAvatar: () => avatar },
  '../lib/garmentModel': garmentModel,
  './FittingAvatar3D': { default: ({ bodyModelUrl }) => React.createElement('div', { 'data-avatar': bodyModelUrl }) },
  './CladAvatarControls': { default: () => null }, './AvatarAccuracyReport': { default: () => null },
})

const products = [
  {
    id: "first",
    name: "Primera prenda",
    category: "Camisas",
    price: 50,
    img: "first.jpg",
  },

  {
    id: "chosen",
    name: "Prenda elegida",
    category: "Pantalones",
    price: 90,
    img: "chosen.jpg",
  },
]

const fittingHtml = renderToStaticMarkup(
  React.createElement(Fitting, {
    mode: "tryon",
    products,
    initialProductId: "chosen",
    setPage: () => {},
  }),
)

assert.ok(fittingHtml.includes('data-avatar="https://private.test/avatar.glb"'))

assert.ok(fittingHtml.includes('aria-label="Prenda seleccionada"'))

assert.ok(
  fittingHtml.includes('<h2 class="font-display text-xl">Prenda elegida</h2>'),
)

assert.ok(fittingHtml.includes('aria-pressed="true"'))

assert.ok(
  fittingHtml.includes(
    "Representación 3D aproximada basada en las medidas registradas.",
  ),
)

const profileHtml = renderToStaticMarkup(
  React.createElement(Fitting, {
    mode: "profile",
    products,
    setPage: () => {},
  }),
)

assert.ok(profileHtml.includes("Prueba una prenda"))

assert.ok(profileHtml.includes("Selecciona una prenda para tu avatar"))

const fittingBody = {
  gender: "F",
  height: 170,
  weight: 65,
  chest: 92,
  waist: 74,
  hips: 98,
  shoulder: 40,
  inseam: 78,
}

const garmentMeasurements = {
  chestWidth: 53,
  waistWidth: 51,
  hipWidth: 52,
  shoulderWidth: 45,
  length: 102,
  stretchPercent: 0,
}

assert.equal(garmentSilhouette("Vestidos", "Vestido Fluido"), "dress")

assert.equal(garmentSilhouette("Conjuntos", "Conjunto Neutro"), "set")

assert.equal(
  garmentSilhouette("Pantalones", "Pantalón Wide Leg"),
  "wide-trousers",
)

assert.equal(
  garmentSilhouette("Pantalones", "Pantalón", "skinny"),
  "slim-trousers",
)

assert.equal(
  garmentSilhouette("Pantalones", "Pantalón Lirio Beige"),
  "bootcut-trousers",
)

assert.equal(
  garmentSilhouette("Pantalones", "Pantalón Anat Marrón Pecana"),
  "wide-trousers",
)

assert.equal(garmentSilhouette("Pantalones", "Pantalón Drill"), "slim-trousers")

assert.equal(
  garmentDisplayColor("Vestidos", "Vestido Rojo corto", "#808080"),
  "#B51235",
)
assert.equal(
  garmentDisplayColor("Pantalones", "Pantalón Lirio Beige", "#808080"),
  "#CBB58F",
)

const describedGarments = [
  ["Pantalones", "Pantalón Lirio Beige", "lirio"],

  ["Polos", "Polo (Negro)", "polo"],

  ["Vestidos", "Vestido Rojo corto", "red-mini-dress"],

  ["Pantalones", "Pantalón Anat Marrón Pecana", "anat"],

  ["Abrigos", "Abrigo de Plumas", "puffer"],

  ["Blazers", "Blazer Americano", "blazer-americano"],

  ["Blazers", "Blazer Essence", "blazer-essence"],

  ["Abrigos", "Abrigo Felpa", "fur-boxy"],

  ["Blusas", "Blusa Manga Larga", "blouse-long"],

  ["Blusas", "Blusa Casual Sólido", "blouse-casual"],

  ["Abrigos", "Abrigo de lana y cachemir", "coat-plaid"],

  ["Blazers", "Blazer - Perla", "blazer-perla"],

  ["Abrigos", "Abrigo Outdoor", "parka"],

  ["Chalecos", "Chaleco sin Mangas", "puffer-vest"],

  ["Jeans", "Jean cargo", "cargo-jean"],

  ["Pantalones", "Pantalón Drill", "drill"],
]

for (const [category, name, expectedDesign] of describedGarments) {
  assert.equal(garmentDesignId(category, name), expectedDesign)

  const details = createGarmentDetails(
    fittingBody,
    garmentMeasurements,
    category,
    name,
    "#657A51",
  )

  assert.ok(
    details.length > 0,
    `${name} should include design-specific mesh details`,
  )

  for (const detail of details) {
    assert.ok(
      detail.geometry.getAttribute("position").count > 0,
      `${name} detail geometry should have vertices`,
    )

    detail.geometry.dispose()
  }
}

const poloDetails = createGarmentDetails(
  fittingBody,
  garmentMeasurements,
  "Polos",
  "Polo (Negro)",
  "#111111",
)
poloDetails[1].geometry.computeBoundingBox()
assert.ok(
  poloDetails[1].geometry.boundingBox.min.z > 0,
  "The polo emblem should face the avatar front",
)
poloDetails.forEach((detail) => detail.geometry.dispose())

const collaredPoloDetails = createGarmentDetails(
  fittingBody,
  garmentMeasurements,
  "Camisas",
  "Polo camisero - gris",
  "#777777",
)
collaredPoloDetails[0].geometry.computeBoundingBox()
collaredPoloDetails[1].geometry.computeBoundingBox()
assert.ok(
  collaredPoloDetails[0].geometry.boundingBox.max.y -
    collaredPoloDetails[0].geometry.boundingBox.min.y <
    0.03,
  "A polo collar band should stay short",
)
assert.ok(
  collaredPoloDetails[1].geometry.boundingBox.max.y -
    collaredPoloDetails[1].geometry.boundingBox.min.y <
    0.08,
  "Polo collar points should fold down over the chest",
)
assert.ok(
  collaredPoloDetails.length >= 8,
  "A collared polo should include collar points and a button placket",
)
collaredPoloDetails.forEach((detail) => detail.geometry.dispose())

const parkaDetails = createGarmentDetails(
  fittingBody,
  garmentMeasurements,
  "Abrigos",
  "Abrigo Outdoor",
  "#657A51",
)
parkaDetails.at(-1).geometry.computeBoundingBox()
assert.ok(
  parkaDetails.at(-1).geometry.boundingBox.max.z < 0,
  "The parka hood should sit behind the avatar",
)
parkaDetails.forEach((detail) => detail.geometry.dispose())

const lirioLeg = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón Lirio Beige",
)[1]

const drillLeg = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón Drill",
)[1]

const miniDressMeasurements = {
  ...garmentMeasurements,
  length: 65,
  hemWidth: 65,
}
const miniDressGeometries = createGarmentGeometries(
  fittingBody,
  miniDressMeasurements,
  "Vestidos",
  "Vestido Rojo corto",
)
const miniDressSkirt = miniDressGeometries[1]
const miniDressBodice = miniDressGeometries[0]

const longDressSkirt = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Vestidos",
  "Vestido largo",
)[1]

lirioLeg.computeBoundingBox()

drillLeg.computeBoundingBox()

miniDressSkirt.computeBoundingBox()
miniDressBodice.computeBoundingBox()

longDressSkirt.computeBoundingBox()

assert.ok(
  lirioLeg.boundingBox.max.x - lirioLeg.boundingBox.min.x >
    drillLeg.boundingBox.max.x - drillLeg.boundingBox.min.x,
)

assert.ok(miniDressSkirt.boundingBox.min.y > longDressSkirt.boundingBox.min.y)

assert.ok(
  miniDressBodice.boundingBox.max.y < (fittingBody.height / 100) * 0.8,
  "The strapless bodice should stop below the shoulders",
)
assert.ok(
  Math.abs(
    miniDressSkirt.boundingBox.min.y -
      ((fittingBody.height / 100) * 0.76 - 0.65),
  ) < 0.00001,
  "The mini skirt length should be measured from the strapless neckline",
)

lirioLeg.dispose()

drillLeg.dispose()

miniDressSkirt.dispose()
miniDressBodice.dispose()
longDressSkirt.dispose()

const miniDressDetails = createGarmentDetails(
  fittingBody,
  miniDressMeasurements,
  "Vestidos",
  "Vestido Rojo corto",
  "#808080",
)
const firstRuchingLine = miniDressDetails[0].geometry
firstRuchingLine.computeBoundingBox()
assert.ok(
  firstRuchingLine.boundingBox.max.x - firstRuchingLine.boundingBox.min.x >
    firstRuchingLine.boundingBox.max.y - firstRuchingLine.boundingBox.min.y,
  "Dress ruching should run horizontally",
)
miniDressDetails.forEach((detail) => detail.geometry.dispose())

const legWidth = (name) => {
  const leg = createGarmentGeometries(
    fittingBody,
    garmentMeasurements,
    "Pantalones",
    name,
  )[1]

  leg.computeBoundingBox()

  return leg.boundingBox.getSize(new Vector3()).x
}

assert.ok(legWidth("Pantalón Wide Leg") > legWidth("Pantalón recto"))

const pantLeg = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón recto",
)[1]

const measuredThigh = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, thighWidth: 32 },
  "Pantalones",
  "Pantalón recto",
)[1]

const measuredHem = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, hemWidth: 28 },
  "Pantalones",
  "Pantalón recto",
)[1]

const measuredLegHem = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, legHemWidth: 28 },
  "Pantalones",
  "Pantalón recto",
)[1]

const polo = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, length: 70 },
  "Polos",
  "Polo clásico",
)[0]

const longTop = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, length: 70 },
  "Camisas",
  "Camisa clásica",
)[0]

const shortLeg = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, length: 42 },
  "Shorts",
  "Short",
)[1]

const skinnyLeg = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, cut: "skinny" },
  "Pantalones",
  "Pantalón",
)[1]

pantLeg.computeBoundingBox()

measuredThigh.computeBoundingBox()

measuredHem.computeBoundingBox()

measuredLegHem.computeBoundingBox()

polo.computeBoundingBox()

longTop.computeBoundingBox()

shortLeg.computeBoundingBox()

skinnyLeg.computeBoundingBox()

assert.ok(shortLeg.boundingBox.min.y > pantLeg.boundingBox.min.y)

assert.ok(
  skinnyLeg.boundingBox.max.x - skinnyLeg.boundingBox.min.x <
    pantLeg.boundingBox.max.x - pantLeg.boundingBox.min.x,
)

assert.ok(
  measuredThigh.boundingBox.max.x - measuredThigh.boundingBox.min.x >
    pantLeg.boundingBox.max.x - pantLeg.boundingBox.min.x,
)

assert.ok(
  measuredHem.boundingBox.max.x - measuredHem.boundingBox.min.x >
    pantLeg.boundingBox.max.x - pantLeg.boundingBox.min.x,
)

assert.ok(
  measuredLegHem.boundingBox.max.x - measuredLegHem.boundingBox.min.x >
    pantLeg.boundingBox.max.x - pantLeg.boundingBox.min.x,
)

assert.ok(polo.boundingBox.min.y > longTop.boundingBox.min.y)

const shortSleeve = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Camisas",
  "Camisa manga corta",
)[1]

const measuredSleeve = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, sleeveLength: 55, armWidth: 28, cuffWidth: 22 },
  "Camisas",
  "Camisa manga corta",
)[1]

shortSleeve.computeBoundingBox()

measuredSleeve.computeBoundingBox()

assert.ok(measuredSleeve.boundingBox.min.y < shortSleeve.boundingBox.min.y)

assert.ok(
  measuredSleeve.boundingBox.max.x - measuredSleeve.boundingBox.min.x >
    shortSleeve.boundingBox.max.x - shortSleeve.boundingBox.min.x,
)

const lowRise = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, rise: 20 },
  "Pantalones",
  "Pantalón",
)[0]

const highRise = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, rise: 30 },
  "Pantalones",
  "Pantalón",
)[0]

lowRise.computeBoundingBox()

highRise.computeBoundingBox()

assert.ok(
  Math.abs(highRise.boundingBox.min.y - lowRise.boundingBox.min.y) < 0.001,
  "Trouser crotch height should follow body inseam, not garment rise",
)

assert.ok(highRise.boundingBox.max.y > lowRise.boundingBox.max.y)

assert.ok(
  createGarmentGeometries(
    fittingBody,
    garmentMeasurements,
    "Camisas",
    "Camisa sin mangas",
  ).length <
    createGarmentGeometries(
      fittingBody,
      garmentMeasurements,
      "Camisas",
      "Camisa manga larga",
    ).length,
)

const avatarMesh = new Mesh(
  new CylinderGeometry(0.2, 0.2, 1.7, 32, 68),
  new MeshBasicMaterial(),
)

avatarMesh.position.set(0.12, 0.85, 0.08)

avatarMesh.updateMatrixWorld(true)

const avatarProfile = extractAvatarBodyProfile(avatarMesh)

assert.ok(avatarProfile)

const footShiftedProfile = {
  minY: 0,
  height: 1.7,
  slices: Array.from({ length: 38 }, (_, index) => {
    const yRatio = (index + 1) * 0.025
    const centerZ = yRatio < 0.075 ? 0.25 : 0
    const section = { centerX: 0.08, centerZ, width: 0.14, depth: 0.12 }

    return {
      yRatio,
      body: { centerX: 0, centerZ: 0, width: 0.35, depth: 0.2 },
      leftLeg: { ...section, centerX: -0.08 },
      rightLeg: { ...section, centerX: 0.08 },
      leftArm: null,
      rightArm: null,
    }
  }),
}
const footAlignedLeg = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón Lirio Beige",
  footShiftedProfile,
)[1]
const footAlignedPositions = footAlignedLeg.getAttribute("position")
const hemCenterZ =
  Array.from({ length: 40 }, (_, index) =>
    footAlignedPositions.getZ(index),
  ).reduce((sum, value) => sum + value, 0) / 40
assert.ok(
  Math.abs(hemCenterZ) < 0.02,
  "Trouser hems should follow the ankle, not shift toward the foot/toe",
)
footAlignedLeg.dispose()

const closeDressGeometry = createGarmentGeometries(
  fittingBody,
  {
    chestWidth: 46,
    waistWidth: 37,
    hipWidth: 49,
    shoulderWidth: 40,
    length: 65,
    stretchPercent: 0,
    hemWidth: 65,
  },
  "Vestidos",
  "Vestido Rojo corto",
  avatarProfile,
)[0]
closeDressGeometry.computeBoundingBox()
assert.ok(
  closeDressGeometry.boundingBox.max.z > avatarMesh.position.z + 0.2,
  "The dress surface should clear the avatar mesh",
)
closeDressGeometry.dispose()

const poloBody = { ...fittingBody, chest: 100 }
const poloMeasurements = {
  ...garmentMeasurements,
  chestWidth: 46,
  waistWidth: 37,
  hipWidth: 49,
  shoulderWidth: 40,
  length: 68,
}
const poloTorso = createGarmentGeometries(
  poloBody,
  poloMeasurements,
  "Camisas",
  "Polo camisero - gris",
  avatarProfile,
)[0]
poloTorso.computeBoundingBox()
assert.ok(
  poloTorso.boundingBox.max.z > avatarMesh.position.z + 0.2,
  "The polo fabric should not be hidden inside the avatar",
)
assert.ok(
  poloTorso.boundingBox.max.y >=
    avatarProfile.minY + avatarProfile.height * 0.84 - 0.0001,
  "The polo torso should extend over the top of the shoulders",
)
poloTorso.dispose()

const poloWithoutProfile = createGarmentGeometries(
  poloBody,
  poloMeasurements,
  "Camisas",
  "Polo camisero - gris",
)
const shortSleevePositions = poloWithoutProfile[1].getAttribute("position")
const shortSleeveRingY = Array.from({ length: 24 }, (_, index) =>
  shortSleevePositions.getY(index),
)
assert.ok(
  Math.max(...shortSleeveRingY) - Math.min(...shortSleeveRingY) > 0.01,
  "Polo sleeve cross-sections should follow the sloped arm",
)
poloWithoutProfile.forEach((geometry) => geometry.dispose())

const missingNormalsMesh = new Mesh(
  new BoxGeometry(0.4, 0.3, 1.7),
  new MeshBasicMaterial(),
)
missingNormalsMesh.geometry.deleteAttribute("normal")
const smoothedAvatar = prepareCladScene(missingNormalsMesh)
let smoothedAvatarMesh
smoothedAvatar.traverse((object) => {
  if (object instanceof Mesh) smoothedAvatarMesh = object
})
assert.ok(smoothedAvatarMesh?.geometry.getAttribute("normal"))
assert.equal(missingNormalsMesh.geometry.getAttribute("normal"), undefined)

const orientationSource = new Group()
const orientationBody = new Mesh(
  new BoxGeometry(0.4, 0.25, 1.7),
  new MeshBasicMaterial(),
)
orientationBody.position.z = 0.85
const frontMarker = new Mesh(
  new BoxGeometry(0.04, 0.02, 0.04),
  new MeshBasicMaterial(),
)
frontMarker.name = "front-marker"
frontMarker.position.set(0, -0.14, 1.45)
orientationSource.add(orientationBody, frontMarker)
const orientedAvatar = prepareCladScene(orientationSource)
const orientedFront = new Vector3()
orientedAvatar.getObjectByName("front-marker").getWorldPosition(orientedFront)
assert.ok(
  orientedFront.z > 0,
  "Clad's -Y-facing front should become Three.js +Z",
)
orientationBody.geometry.dispose()
orientationBody.material.dispose()
frontMarker.geometry.dispose()
frontMarker.material.dispose()

const seatBase = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón recto",
  avatarProfile,
)[0]

const seatLeg = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón recto",
  avatarProfile,
)[1]

seatBase.computeBoundingBox()
seatLeg.computeBoundingBox()

assert.ok(
  seatLeg.boundingBox.max.y > seatBase.boundingBox.min.y + 0.1,
  "The trouser legs should extend into the seat mesh to avoid a crotch gap",
)

const seatPositions = seatBase.getAttribute("position")
const seatRingWidth = (ringIndex) => {
  const xs = Array.from({ length: 40 }, (_, index) =>
    seatPositions.getX(ringIndex * 40 + index),
  )

  return Math.max(...xs) - Math.min(...xs)
}
assert.ok(
  seatRingWidth(0) < seatRingWidth(4) * 0.8,
  "The trouser seat should taper toward the crotch",
)

const lirioSeat = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón Lirio Beige",
  avatarProfile,
)[0]
const lirioSeatPositions = lirioSeat.getAttribute("position")
const lirioCrotchWidth =
  Math.max(
    ...Array.from({ length: 40 }, (_, index) => lirioSeatPositions.getX(index)),
  ) -
  Math.min(
    ...Array.from({ length: 40 }, (_, index) => lirioSeatPositions.getX(index)),
  )
assert.ok(
  lirioCrotchWidth < seatRingWidth(0),
  "Lirio's crotch bridge should be narrower than a regular trouser seat",
)
lirioSeat.dispose()

const measuredBody = {
  gender: "F",
  height: 180,
  weight: 68,
  chest: 86,
  waist: 72,
  hips: 92,
  shoulder: 41,
  inseam: 78,
}
const lirioSReference = {
  chestWidth: null,
  waistWidth: 37,
  hipWidth: 49,
  shoulderWidth: null,
  length: 100,
  stretchPercent: 0,
  rise: 26,
}
assert.equal(
  loadModule("src/lib/fitting.ts").assessFit(
    measuredBody,
    lirioSReference,
    "Pantalones",
  )?.overall,
  "adecuado",
)

const measuredLirio = createGarmentGeometries(
  measuredBody,
  lirioSReference,
  "Pantalones",
  "Pantalón Lirio Beige",
  footShiftedProfile,
)
measuredLirio[0].computeBoundingBox()
measuredLirio[1].computeBoundingBox()
const buttRingZ = Array.from({ length: 40 }, (_, index) =>
  measuredLirio[0].getAttribute("position").getZ(3 * 40 + index),
)
assert.ok(
  Math.abs(measuredLirio[0].boundingBox.max.y - 1.04) < 0.001,
  "The Lirio waistband height should use the measured inseam and rise",
)
assert.ok(
  Math.max(...buttRingZ) - Math.min(...buttRingZ) > 0.22,
  "The Lirio seat should preserve the avatar's glute contour above the crotch",
)
assert.ok(
  measuredLirio[1].boundingBox.min.y > 0.03 &&
    measuredLirio[1].boundingBox.min.y < 0.05,
  "The reference Lirio length should end near the ankle for this body",
)
measuredLirio.forEach((geometry) => geometry.dispose())

assert.ok(
  seatBase.boundingBox.max.z - seatBase.boundingBox.min.z >
    pantLeg.boundingBox.max.z - pantLeg.boundingBox.min.z,
)

const profileBaseLeg = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Pantalones",
  "Pantalón recto",
  avatarProfile,
)[1]

const profileMeasuredLeg = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, thighWidth: 32 },
  "Pantalones",
  "Pantalón recto",
  avatarProfile,
)[1]

profileBaseLeg.computeBoundingBox()

profileMeasuredLeg.computeBoundingBox()

assert.ok(
  profileMeasuredLeg.boundingBox.max.x - profileMeasuredLeg.boundingBox.min.x >
    profileBaseLeg.boundingBox.max.x - profileBaseLeg.boundingBox.min.x,
)

const armRoot = new Group()

const armMaterial = new MeshBasicMaterial()

const armTorso = new Mesh(
  new CylinderGeometry(0.2, 0.2, 1.7, 24, 40),
  armMaterial,
)

armTorso.position.y = 0.85

armRoot.add(armTorso)

for (const side of [-1, 1]) {
  const arm = new Mesh(
    new CylinderGeometry(0.055, 0.075, 0.46, 12, 12),
    armMaterial,
  )

  arm.rotation.z = (side * Math.PI) / 2

  arm.position.set(side * 0.37, 1.3, 0)

  armRoot.add(arm)
}

const armProfile = extractAvatarBodyProfile(armRoot)

assert.ok(
  armProfile?.slices.some((slice) => slice.leftArm) &&
    armProfile.slices.some((slice) => slice.rightArm),
)
const torsoAtShoulder = armProfile.slices.find(
  (slice) => Math.abs(slice.yRatio - 0.75) < 0.02,
)
assert.ok(torsoAtShoulder?.body)
assert.ok(torsoAtShoulder.body.width < 0.5)

const fittedTop = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Camisas",
  "Camisa manga corta",
  avatarProfile,
)[0]

assert.ok(fittedTop.getAttribute("position").count > 40 * 12)

fittedTop.computeBoundingBox()

assert.ok(
  Math.abs(
    (fittedTop.boundingBox.min.x + fittedTop.boundingBox.max.x) / 2 - 0.12,
  ) < 0.02,
)

assert.ok(
  Math.abs(
    (fittedTop.boundingBox.min.z + fittedTop.boundingBox.max.z) / 2 - 0.08,
  ) < 0.02,
)

const spikyProfile = {
  ...avatarProfile,

  slices: avatarProfile.slices.map((slice) => ({
    ...slice,

    body: slice.body
      ? {
          ...slice.body,
          width: Math.abs(slice.yRatio - 0.725) < 0.001 ? 0.68 : 0.36,
        }
      : null,
  })),
}

const smoothedTop = createGarmentGeometries(
  fittingBody,
  garmentMeasurements,
  "Camisas",
  "Camisa manga corta",
  spikyProfile,
)[0]

smoothedTop.computeBoundingBox()

assert.ok(smoothedTop.boundingBox.max.x - smoothedTop.boundingBox.min.x < 0.55)

const noStretchTop = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, chestWidth: 70 },
  "Camisas",
  "Camisa manga corta",
  avatarProfile,
)[0]

const elasticTop = createGarmentGeometries(
  fittingBody,
  { ...garmentMeasurements, chestWidth: 70, stretchPercent: 30 },
  "Camisas",
  "Camisa manga corta",
  avatarProfile,
)[0]

noStretchTop.computeBoundingBox()

elasticTop.computeBoundingBox()

assert.ok(
  elasticTop.boundingBox.max.x - elasticTop.boundingBox.min.x <
    noStretchTop.boundingBox.max.x - noStretchTop.boundingBox.min.x,
)

avatarMesh.geometry.dispose()
avatarMesh.material.dispose()
smoothedAvatarMesh.geometry.dispose()
missingNormalsMesh.geometry.dispose()
missingNormalsMesh.material.dispose()
fittedTop.dispose()

smoothedTop.dispose()

noStretchTop.dispose()

elasticTop.dispose()

pantLeg.dispose()

measuredThigh.dispose()

measuredHem.dispose()

measuredLegHem.dispose()

profileBaseLeg.dispose()

profileMeasuredLeg.dispose()

shortLeg.dispose()

skinnyLeg.dispose()

shortSleeve.dispose()

measuredSleeve.dispose()

lowRise.dispose()

highRise.dispose()

seatBase.dispose()
seatLeg.dispose()

polo.dispose()

longTop.dispose()

armRoot.traverse((object) => {
  if (object instanceof Mesh) object.geometry.dispose()
})

armMaterial.dispose()

console.log(
  "Pedidos: renderizado con artículos, pedidos antiguos, datos incompletos y estados vacíos verificado.",
)

console.log(
  "Avatar y probador: selector de prenda, tallas y visualización orientativa presentes.",
)

console.log(
  "Modelo de prendas: siluetas de vestido/conjunto, pantalón ancho, shorts y mangas verificadas.",
)

console.log(
  "Ajuste 3D: geometría alineada a los contornos y desplazamiento del modelo corporal.",
)

if (process.argv.includes("--supabase")) {
  const { createClient } = await import("@supabase/supabase-js")

  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await db
    .from("pedidos")
    .select(
      "id,numero_orden,monto_total,creado_el,perfiles(nombre,apellido),pedido_productos(id,codigo_producto,nombre_producto,talla,estado)",
    )

assert.ok(fittingHtml.includes('Sin tallas registradas'))
const profileHtml = renderToStaticMarkup(React.createElement(Fitting, { mode: 'profile', products, setPage: () => {} }))
assert.ok(profileHtml.includes('Prueba una prenda'))
assert.ok(profileHtml.includes('Selecciona una prenda para tu avatar'))
console.log('Pedidos: renderizado con artículos, pedidos antiguos, datos incompletos y estados vacíos verificado.')
console.log('Avatar y probador: selector de prenda, tallas y visualización orientativa presentes.')

if (process.argv.includes('--supabase')) {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.from('pedidos').select('id,numero_orden,monto_total,creado_el,perfiles(nombre,apellido),pedido_productos(id,codigo_producto,nombre_producto,talla,estado)')
  if (error) throw new Error(error.message)

  const realRows = buildAdminOrderRows(data, 1000)

  const realHtml = renderToStaticMarkup(
    React.createElement(OrdersPanel, {
      rows: realRows,
      loading: false,
      onRefresh: async () => {},
      onStatusChange: async () => {},
    }),
  )

  assert.ok(realHtml.includes("Pedidos recientes"))

  assert.ok(realRows.length >= data.length)

  console.log(
    `Renderizado con Supabase verificado: ${data.length} pedidos, ${realRows.length} filas. No se imprimieron datos personales.`,
  )
}
