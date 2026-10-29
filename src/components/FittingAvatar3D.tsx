import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { prepareCladScene } from '../lib/cladModel'

function CladBody({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => prepareCladScene(scene), [scene])
  return <primitive object={model} />
}

class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <Html center><p role="alert" className="w-64 bg-white p-4 text-center text-sm">No se pudo abrir el modelo 3D. Consulta de nuevo el estado del avatar.</p></Html>
      : this.props.children
  }
}

export default function FittingAvatar3D({ bodyModelUrl, busy = false, needsReview = false }: {
  bodyModelUrl?: string | null
  busy?: boolean
  needsReview?: boolean
}) {
  return <div className="relative h-[480px] w-full bg-[#eee9e1]" aria-label="Visor del avatar corporal Clad">
    {!bodyModelUrl ? <div role="status" className="flex h-full items-center justify-center px-8 text-center text-sm text-[#6B6860]">
      {busy ? 'Clad está generando y ajustando tu cuerpo. El modelo aparecerá cuando termine.' : 'Genera tu avatar con Clad desde Mi Avatar. Aquí se mostrará tu modelo 3D.'}
    </div> : <>
      <span className="absolute left-3 top-3 z-10 bg-white/90 px-3 py-1 text-xs">{needsReview ? 'Avatar Clad · medidas por revisar' : 'Avatar Clad · tolerancia comprobada'}</span>
      <Canvas camera={{ position: [0, 1, 4], fov: 32 }} dpr={[1, 1.75]}>
        <color attach="background" args={['#eee9e1']} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[2, 4, 4]} intensity={1.5} />
        <directionalLight position={[-3, 2, -2]} intensity={0.7} />
        <OrbitControls makeDefault target={[0, 0.9, 0]} enablePan={false} minDistance={0.8} maxDistance={6} maxPolarAngle={Math.PI / 1.8} />
        <ModelBoundary key={bodyModelUrl}><Suspense fallback={<Html center><p role="status" className="w-52 text-center text-sm">Descargando el modelo 3D…</p></Html>}>
          <Bounds fit clip observe margin={1.25}><CladBody url={bodyModelUrl} /></Bounds>
        </Suspense></ModelBoundary>
      </Canvas>
    </>}
  </div>
}
