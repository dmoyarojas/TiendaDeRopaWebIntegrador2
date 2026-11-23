import { BufferGeometry, Float32BufferAttribute } from "three"

import type { BodyMeasurements, GarmentMeasurements } from "./fitting"

interface Ring {
  y: number

  width: number

  depth: number

  centerX?: number
}

function circumferenceWidth(circumferenceCm: number) {
  return Math.max(circumferenceCm / 100 / 2.6, 0.04)
}

function makeLoft(rings: Ring[]): BufferGeometry {
  const sides = 32

  const vertices: number[] = []

  const indices: number[] = []

  rings.forEach((ring) => {
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2

      vertices.push(
        (ring.centerX ?? 0) + (Math.sin(angle) * ring.width) / 2,

        ring.y,

        (Math.cos(angle) * ring.depth) / 2,
      )
    }
  })

  for (let ring = 0; ring < rings.length - 1; ring++) {
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

export function createGarmentGeometries(
  body: BodyMeasurements,

  garment: GarmentMeasurements,

  kind: "upper" | "lower" | "full",
): BufferGeometry[] {
  const height = body.height / 100

  const chestWidth = contour(garment.chestWidth, body.chest)

  const waistWidth = contour(garment.waistWidth, body.waist)

  const hipWidth = contour(garment.hipWidth, body.hips)

  const depth = (width: number) => width * 0.68

  const shoulderWidth = Math.max(
    (body.shoulder / 100) * 1.12,
    chestWidth * 0.72,
  )

  const shoulderY = height * 0.82

  if (kind === "lower") {
    const waistY = height * 0.6

    const hipY = height * 0.51

    const legCircumference =
      (garment.hipWidth === null ? body.hips + 8 : garment.hipWidth * 2) * 0.34

    const legWidth = circumferenceWidth(legCircumference)

    const legDepth = depth(legWidth)

    const legCenter = hipWidth * 0.2

    return [
      makeLoft([
        { y: hipY, width: hipWidth, depth: depth(hipWidth) },

        { y: waistY, width: waistWidth, depth: depth(waistWidth) },
      ]),

      ...[-1, 1].map((side) =>
        makeLoft([
          {
            y: height * 0.06,
            width: legWidth * 0.66,
            depth: legDepth * 0.66,
            centerX: side * legCenter,
          },

          {
            y: height * 0.27,
            width: legWidth * 0.78,
            depth: legDepth * 0.78,
            centerX: side * legCenter,
          },

          {
            y: hipY,
            width: legWidth,
            depth: legDepth,
            centerX: side * legCenter,
          },
        ]),
      ),
    ]
  }

  const bottomY =
    kind === "full"
      ? Math.max(
          height * 0.12,
          shoulderY - (garment.length ?? body.height * 0.66) / 100,
        )
      : Math.max(
          height * 0.4,
          shoulderY - (garment.length ?? body.height * 0.38) / 100,
        )

  const rings: Ring[] = [
    {
      y: bottomY,
      width: kind === "full" ? hipWidth * 1.15 : hipWidth,
      depth: depth(hipWidth),
    },

    { y: height * 0.61, width: waistWidth, depth: depth(waistWidth) },

    { y: height * 0.72, width: chestWidth, depth: depth(chestWidth) },

    { y: shoulderY, width: shoulderWidth, depth: depth(chestWidth) * 0.85 },
  ]

  return [makeLoft(rings)]
}
