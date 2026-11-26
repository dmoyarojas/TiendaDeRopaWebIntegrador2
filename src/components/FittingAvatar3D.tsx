import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react"

import { Canvas } from "@react-three/fiber"

import { Bounds, Html, OrbitControls, useGLTF } from "@react-three/drei"

import { prepareCladScene } from "../lib/cladModel"

import {
  createGarmentDetails,
  createGarmentGeometries,
  extractAvatarBodyProfile,
  garmentDesignId,
  garmentDisplayColor,
} from "../lib/garmentModel"

import type { BodyMeasurements, GarmentMeasurements } from "../lib/fitting"

import { DoubleSide } from "three"

function CladAvatar({
  url,
  body,
  garment,
}: {
  url: string

  body?: BodyMeasurements | null

  garment?: {
    measurements: GarmentMeasurements | null
    category: string
    name: string
    colorHex: string
  } | null
}) {
  const { scene } = useGLTF(url)

  const { model, profile } = useMemo(() => {
    const model = prepareCladScene(scene)

    return { model, profile: extractAvatarBodyProfile(model) }
  }, [scene])

  return (
    <>
      <primitive object={model} />
      {body && garment?.measurements && (
        <GarmentOverlay
          body={body}
          measurements={garment.measurements}
          category={garment.category}
          name={garment.name}
          colorHex={garment.colorHex}
          profile={profile}
        />
      )}
    </>
  )
}

function GarmentOverlay({
  body,
  measurements,
  category,
  name,
  colorHex,
  profile,
}: {
  body: BodyMeasurements

  measurements: GarmentMeasurements

  category: string

  name: string

  colorHex: string

  profile: ReturnType<typeof extractAvatarBodyProfile>
}) {
  const design = garmentDesignId(category, name)
  const color = garmentDisplayColor(category, name, colorHex)
  const satin = design === "red-mini-dress"

  const garmentModel = useMemo(
    () => ({
      geometries: createGarmentGeometries(
        body,
        measurements,
        category,
        name,
        profile ?? undefined,
      ),

      details: createGarmentDetails(
        body,
        measurements,
        category,
        name,
        color,
        profile ?? undefined,
      ),
    }),
    [body, measurements, category, name, color, profile],
  )

  useEffect(
    () => () => {
      garmentModel.geometries.forEach((geometry) => geometry.dispose())

      garmentModel.details.forEach((detail) => detail.geometry.dispose())
    },
    [garmentModel],
  )

  return (
    <group>
      {garmentModel.geometries.map((geometry, index) => (
        <mesh key={`garment-${index}`} geometry={geometry} renderOrder={1}>
          <meshStandardMaterial
            color={color}
            roughness={satin ? 0.36 : 0.88}
            metalness={satin ? 0.04 : 0}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {garmentModel.details.map((detail, index) => (
        <mesh
          key={`detail-${index}`}
          geometry={detail.geometry}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={detail.color}
            roughness={detail.roughness}
            metalness={detail.metalness ?? 0}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

class ModelBoundary extends Component<{ children: ReactNode }, {
  failed: boolean
}> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? (
      <Html center>
        <p role="alert" className="w-64 bg-white p-4 text-center text-sm">
          No se pudo abrir el modelo 3D. Consulta de nuevo el estado del avatar.
        </p>
      </Html>
    ) : (
      this.props.children
    )
  }
}

export default function FittingAvatar3D({
  bodyModelUrl,
  busy = false,
  needsReview = false,
  body,
  garment,
}: {
  bodyModelUrl?: string | null

  busy?: boolean

  needsReview?: boolean

  body?: BodyMeasurements | null

  garment?: {
    measurements: GarmentMeasurements | null
    category: string
    name: string
    colorHex: string
  } | null
}) {
  return (
    <div
      className="relative h-[480px] w-full bg-[#eee9e1]"
      aria-label="Visor del avatar corporal Clad"
    >
      {!bodyModelUrl ? (
        <div
          role="status"
          className="flex h-full items-center justify-center px-8 text-center text-sm text-[#6B6860]"
        >
          {busy
            ? "Clad está generando y ajustando tu cuerpo. El modelo aparecerá cuando termine."
            : "Genera tu avatar con Clad desde Mi Avatar. Aquí se mostrará tu modelo 3D."}
        </div>
      ) : (
        <>
          <span className="absolute left-3 top-3 z-10 bg-white/90 px-3 py-1 text-xs">
            {needsReview
              ? "Avatar Clad · medidas por revisar"
              : "Avatar Clad · tolerancia comprobada"}
          </span>
          <Canvas camera={{ position: [0, 1, 4], fov: 32 }} dpr={[1, 1.75]}>
            <color attach="background" args={["#eee9e1"]} />
            <ambientLight intensity={1.8} />
            <directionalLight position={[2, 4, 4]} intensity={1.5} />
            <directionalLight position={[-3, 2, -2]} intensity={0.7} />
            <OrbitControls
              makeDefault
              target={[0, 0.9, 0]}
              enablePan={false}
              minDistance={0.8}
              maxDistance={6}
              maxPolarAngle={Math.PI / 1.8}
            />
            <ModelBoundary key={bodyModelUrl}>
              <Suspense
                fallback={
                  <Html center>
                    <p role="status" className="w-52 text-center text-sm">
                      Descargando el modelo 3D…
                    </p>
                  </Html>
                }
              >
                <Bounds fit clip observe margin={1.25}>
                  <CladAvatar
                    url={bodyModelUrl}
                    body={body}
                    garment={garment}
                  />
                </Bounds>
              </Suspense>
            </ModelBoundary>
          </Canvas>
        </>
      )}
    </div>
  )
}
