import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BODY_STORAGE_KEY, assessFit, isReferenceMeasurements, readSavedBody, validateBody,
  type BodyMeasurements, type FittingVariant, type GarmentMeasurements,
} from '../lib/fitting'
import FittingAvatar3D from './FittingAvatar3D'
import ImageWithFallback from './ImageWithFallback'
import CladAvatarControls from './CladAvatarControls'
import { useCladAvatar } from '../lib/clad'
import AvatarAccuracyReport from './AvatarAccuracyReport'
import { garmentStyle, type GarmentStyle } from '../lib/garmentModel'

type Page = 'home' | 'products' | 'cart' | 'login' | 'register' | 'avatar' | 'tryon' | 'checkout' | 'admin' | 'forgot-password'
interface CatalogProduct { id: string | number; name: string; category: string; price: number; img: string }
type FormValues = Record<Exclude<keyof BodyMeasurements, 'gender'>, string> & { gender: 'F' | 'M' }

const emptyForm: FormValues = { gender: 'F', height: '', weight: '', chest: '', waist: '', hips: '', shoulder: '', inseam: '' }
const fields: { key: Exclude<keyof BodyMeasurements, 'gender'>; label: string; unit: string }[] = [
  { key: 'height', label: 'Estatura', unit: 'cm' }, { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'chest', label: 'Contorno de pecho', unit: 'cm' }, { key: 'waist', label: 'Contorno de cintura', unit: 'cm' },
  { key: 'hips', label: 'Contorno de cadera', unit: 'cm' }, { key: 'shoulder', label: 'Ancho de hombros', unit: 'cm' },
  { key: 'inseam', label: 'Entrepierna', unit: 'cm' },
]
const fieldNames: Record<string, string> = Object.fromEntries(fields.map(field => [field.key, field.label]))

function toForm(body: BodyMeasurements): FormValues {
  return { gender: body.gender, height: String(body.height), weight: String(body.weight), chest: String(body.chest), waist: String(body.waist), hips: String(body.hips), shoulder: String(body.shoulder), inseam: String(body.inseam) }
}

function fromForm(form: FormValues): BodyMeasurements {
  return { gender: form.gender, height: Number(form.height), weight: Number(form.weight), chest: Number(form.chest), waist: Number(form.waist), hips: Number(form.hips), shoulder: Number(form.shoulder), inseam: Number(form.inseam) }
}

function fromDatabase(row: Record<string, unknown>, gender: 'F' | 'M'): BodyMeasurements {
  return {
    gender,
    height: Number(row.altura_cm), weight: Number(row.peso_kg), chest: Number(row.pecho_busto_cm),
    waist: Number(row.cintura_cm), hips: Number(row.cadera_cm), shoulder: Number(row.ancho_hombros_cm),
    inseam: Number(row.tiro_pierna_cm),
  }
}

async function loadVariants(): Promise<FittingVariant[]> {
  const { data: rows, error } = await supabase.from('variantes_producto')
    .select('id, producto_id, talla, nombre_color, color_hex, precio, esta_activo')
    .eq('esta_activo', true)
  if (error) throw error
  if (!rows?.length) return []

  const ids = rows.map(row => row.id)
  const [specsResult, modelsResult] = await Promise.all([
    supabase.from('especificaciones_prenda')
      .select('variante_producto_id, ancho_pecho_cm, ancho_cintura_cm, ancho_cadera_cm, ancho_hombros_cm, largo_total_cm, largo_tiro_cm, largo_manga_cm, ancho_brazo_cm, ancho_puno_cm, ancho_muslo_cm, ancho_rodilla_cm, ancho_bajo_cm, ancho_bajo_pierna_cm, porcentaje_elasticidad, tipo_corte')
      .in('variante_producto_id', ids),
    supabase.from('recursos_3d_ropa').select('variante_producto_id, url_malla_glb').in('variante_producto_id', ids),
  ])
  const specsResult = await supabase.from('especificaciones_prenda')
    .select('variante_producto_id, ancho_pecho_cm, ancho_cintura_cm, ancho_cadera_cm, ancho_hombros_cm, largo_total_cm, porcentaje_elasticidad')
    .in('variante_producto_id', ids)
  if (specsResult.error) throw specsResult.error

  const specs = new Map((specsResult.data ?? []).map(row => [row.variante_producto_id, row]))
  const positiveNumberOrNull = (value: unknown) => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
  }
  return rows.map(row => {
    const spec = specs.get(row.id)
    const measurements: GarmentMeasurements | null = spec ? {
      chestWidth: numberOrNull(spec.ancho_pecho_cm), waistWidth: numberOrNull(spec.ancho_cintura_cm),
      hipWidth: numberOrNull(spec.ancho_cadera_cm), shoulderWidth: numberOrNull(spec.ancho_hombros_cm),
      length: numberOrNull(spec.largo_total_cm), stretchPercent: Number(spec.porcentaje_elasticidad ?? 0),
      rise: numberOrNull(spec.largo_tiro_cm), cut: typeof spec.tipo_corte === 'string' ? spec.tipo_corte : null,
      sleeveLength: numberOrNull(spec.largo_manga_cm), armWidth: numberOrNull(spec.ancho_brazo_cm),
      cuffWidth: numberOrNull(spec.ancho_puno_cm), thighWidth: numberOrNull(spec.ancho_muslo_cm),
      kneeWidth: numberOrNull(spec.ancho_rodilla_cm), hemWidth: numberOrNull(spec.ancho_bajo_cm),
      legHemWidth: numberOrNull(spec.ancho_bajo_pierna_cm),
      chestWidth: positiveNumberOrNull(spec.ancho_pecho_cm), waistWidth: positiveNumberOrNull(spec.ancho_cintura_cm),
      hipWidth: positiveNumberOrNull(spec.ancho_cadera_cm), shoulderWidth: positiveNumberOrNull(spec.ancho_hombros_cm),
      length: positiveNumberOrNull(spec.largo_total_cm), stretchPercent: positiveNumberOrNull(spec.porcentaje_elasticidad) ?? 0,
    } : null
    return {
      id: row.id, productId: row.producto_id, size: row.talla, color: row.nombre_color,
      colorHex: row.color_hex, price: Number(row.precio) / 1000, measurements,
    }
  })
}

const tone = {
  ajustado: 'bg-rose-100 text-rose-800',
  adecuado: 'bg-emerald-100 text-emerald-800',
  holgado: 'bg-amber-100 text-amber-800',
}

const referenceColors: Partial<Record<GarmentStyle, string>> = {
  americano: '#23263D',
  poloGris: '#38393B',
}

export default function FittingExperience({ mode, products, setPage, initialProductId = null, onProductChange }: {
  mode: 'profile' | 'tryon'
  products: CatalogProduct[]
  setPage: (page: Page) => void
  initialProductId?: string | number | null
  onProductChange?: (id: string | number) => void
}) {
  const [body, setBody] = useState<BodyMeasurements | null>(() => readSavedBody())
  const [form, setForm] = useState<FormValues>(() => {
    const saved = readSavedBody()
    return saved ? toForm(saved) : emptyForm
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [variants, setVariants] = useState<FittingVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(true)
  const [variantError, setVariantError] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | number | null>(initialProductId)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const cladAvatar = useCladAvatar(body)

  useEffect(() => {
    if (!body && cladAvatar.savedBody && validateBody(cladAvatar.savedBody) === null) {
      setBody(cladAvatar.savedBody)
      setForm(toForm(cladAvatar.savedBody))
      sessionStorage.setItem(BODY_STORAGE_KEY, JSON.stringify(cladAvatar.savedBody))
    }
  }, [body, cladAvatar.savedBody])

  useEffect(() => {
    if (initialProductId !== null) setSelectedProductId(initialProductId)
  }, [initialProductId])

  useEffect(() => {
    let cancelled = false
    async function loadBody() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('medidas_usuario').select('*').eq('usuario_id', user.id).maybeSingle()
      if (!data || cancelled) return
      const savedGender = user.user_metadata?.genero
      const candidate = fromDatabase(data, savedGender === 'M' || savedGender === 'masculino' ? 'M' : 'F')
      if (validateBody(candidate) === null) {
        setBody(candidate)
        setForm(toForm(candidate))
        sessionStorage.setItem(BODY_STORAGE_KEY, JSON.stringify(candidate))
      }
    }
    void loadBody()
    return () => { cancelled = true }
    // Solo cargamos al montar; cambios posteriores vienen del formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingVariants(true)
    setVariantError('')
    void loadVariants().then(data => {
      if (!cancelled) { setVariants(data); setLoadingVariants(false) }
    }).catch(error => {
      if (!cancelled) { setVariantError(error instanceof Error ? error.message : 'No se pudieron cargar las tallas.'); setLoadingVariants(false) }
    })
    return () => { cancelled = true }
  }, [mode])

  useEffect(() => {
    if (products.length && (selectedProductId === null || !products.some(product => product.id === selectedProductId))) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  const product = products.find(item => item.id === selectedProductId) ?? null
  const productVariants = variants.filter(item => item.productId === String(selectedProductId))
    .sort((a, b) => {
      const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
      const rank = (size: string) => sizes.includes(size.toUpperCase()) ? sizes.indexOf(size.toUpperCase()) : 99
      return rank(a.size) - rank(b.size) || a.size.localeCompare(b.size, undefined, { numeric: true })
    })
  const selectedVariant = productVariants.find(item => item.id === selectedVariantId) ?? productVariants.find(item => item.measurements) ?? productVariants[0] ?? null
  const style = product ? garmentStyle(product.name, product.category) : null
  const fitCategory = style === 'poloGris' ? 'Camisas' : product?.category
  const fit = body && fitCategory != null && selectedVariant?.measurements
    ? assessFit(body, selectedVariant.measurements, fitCategory)
    : null
  const previewGarment = style && fit && selectedVariant?.measurements
    ? {
      style,
      measurements: selectedVariant.measurements,
      colorHex: selectedVariant.color.trim().toLowerCase() === 'referencia'
        ? referenceColors[style] ?? selectedVariant.colorHex
        : selectedVariant.colorHex,
    }
    : null
  const previewMessage = !fit
    ? 'Registra medidas válidas de esta talla para generar su vista 3D.'
    : !style ? 'Este tipo de prenda aún no tiene una vista 3D.'
      : 'Vista 3D aproximada del corte. Usa la foto para consultar los detalles de la prenda.'
  const usesReferenceMeasurements = Boolean(product && selectedVariant?.measurements
    && isReferenceMeasurements(product.name, product.category, selectedVariant.size, selectedVariant.measurements))
  const recommended = useMemo(() => {
    if (!body || fitCategory == null) return null
    return productVariants
      .map(variant => ({ variant, result: variant.measurements ? assessFit(body, variant.measurements, fitCategory) : null }))
      .filter((item): item is { variant: FittingVariant; result: NonNullable<typeof item.result> } => item.result !== null)
      .sort((a, b) => (a.result.overall === 'ajustado' ? 1000 : 0) + a.result.score - ((b.result.overall === 'ajustado' ? 1000 : 0) + b.result.score))[0] ?? null
  }, [body, fitCategory, productVariants])

  async function saveMeasurements(event: React.FormEvent) {
    event.preventDefault()
    const next = fromForm(form)
    const invalid = validateBody(next)
    if (invalid) { setMessage(`Revisa el campo ${fieldNames[invalid]}.`); return }
    setSaving(true)
    setMessage('')
    sessionStorage.setItem(BODY_STORAGE_KEY, JSON.stringify(next))
    setBody(next)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setMessage('Medidas guardadas para esta sesión. Inicia sesión para generar tu avatar con Clad.'); return }
      const { error } = await supabase.from('medidas_usuario').upsert({
        usuario_id: user.id,
        altura_cm: next.height, peso_kg: next.weight, pecho_busto_cm: next.chest,
        cintura_cm: next.waist, cadera_cm: next.hips, ancho_hombros_cm: next.shoulder,
        tiro_pierna_cm: next.inseam,
      }, { onConflict: 'usuario_id' })
      if (error) throw error
      const { error: genderError } = await supabase.auth.updateUser({ data: { genero: next.gender } })
      if (genderError) throw genderError
      setMessage('Medidas guardadas en tu cuenta. Puedes probar las prendas.')
    } catch (error) {
      setMessage(`Las medidas quedaron en esta sesión, pero no se guardaron en Supabase: ${error instanceof Error ? error.message : 'error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'profile') return (
    <div className="min-h-screen bg-[#FAF8F5] pt-16">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-xs font-700 uppercase tracking-[0.2em] text-[#A78B58]">Tu perfil corporal</p>
        <h1 className="mt-2 font-display text-4xl text-[#0D0D0D]">Crea tu avatar 3D</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6B6860]">Ingresa medidas tomadas con cinta métrica. Clad ajustará el cuerpo a esos objetivos y compararemos las medidas del modelo generado con las tuyas.</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={event => void saveMeasurements(event)} className="space-y-5 bg-white p-6 border border-[#DDD9D0]">
            <fieldset>
              <legend className="text-sm font-600 text-[#0D0D0D]">Silueta</legend>
              <div className="mt-2 flex gap-3">
                {(['F', 'M'] as const).map(gender => <button key={gender} type="button" onClick={() => setForm(value => ({ ...value, gender }))} className={`flex-1 border px-3 py-2 text-sm ${form.gender === gender ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#DDD9D0]'}`}>{gender === 'F' ? 'Femenina' : 'Masculina'}</button>)}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-4">
              {fields.map(field => <label key={field.key} className="text-xs font-600 text-[#6B6860]">{field.label} ({field.unit})
                <input type="number" min="0" step="0.1" required value={form[field.key]} onChange={event => setForm(value => ({ ...value, [field.key]: event.target.value }))} className="mt-1 block w-full border border-[#DDD9D0] bg-white px-3 py-2.5 text-sm text-[#0D0D0D]" />
              </label>)}
            </div>
            <button type="submit" disabled={saving} className="w-full bg-[#0D0D0D] px-5 py-3 text-sm font-700 text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar medidas'}</button>
            {message && <p role="status" className="text-sm text-[#6B6860]">{message}</p>}
            {body && <button type="button" onClick={() => setPage('tryon')} className="w-full border border-[#C9A96E] px-5 py-3 text-sm font-700 text-[#0D0D0D]">Ir al probador →</button>}
          </form>
          <div className="border border-[#DDD9D0] bg-[#eee9e1]">
            <FittingAvatar3D
              bodyModelUrl={cladAvatar.modelUrl}
              busy={cladAvatar.busy}
              needsReview={!cladAvatar.accuracy?.withinTolerance}
              body={body}
              garment={product && selectedVariant ? { measurements: selectedVariant.measurements, category: product.category, name: product.name, colorHex: selectedVariant.colorHex } : null}
              garment={previewGarment}
            />
            <p className="border-t border-[#DDD9D0] px-4 py-3 text-xs text-[#6B6860]">Arrastra para girar el avatar y ver la prenda desde otros ángulos.</p>
            <div className="border-t border-[#DDD9D0] bg-white p-4">
              <h2 className="font-display text-xl text-[#0D0D0D]">Prueba una prenda</h2>
              <label className="mt-3 block text-xs font-600 text-[#6B6860]">Prenda
                <select
                  aria-label="Selecciona una prenda para tu avatar"
                  value={product ? String(product.id) : ''}
                  onChange={event => {
                    const selected = products.find(item => String(item.id) === event.target.value)
                    if (selected) {
                      setSelectedProductId(selected.id)
                      setSelectedVariantId(null)
                      onProductChange?.(selected.id)
                    }
                  }}
                  className="mt-1 block w-full border border-[#DDD9D0] bg-white px-3 py-2 text-sm text-[#0D0D0D]"
                >
                  <option value="">Selecciona una prenda</option>
                  {products.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                </select>
              </label>
              {loadingVariants && <p className="mt-3 text-sm text-[#6B6860]">Cargando tallas y medidas…</p>}
              {variantError && <p role="alert" className="mt-3 text-sm text-red-700">No se pudieron cargar las medidas: {variantError}</p>}
              {!cladAvatar.modelUrl && <p className="mt-3 text-xs text-[#6B6860]">Genera tu avatar 3D para visualizar la prenda sobre el modelo.</p>}
              {!loadingVariants && !variantError && product && productVariants.length === 0 && <p className="mt-3 text-sm text-[#6B6860]">Esta prenda aún no tiene tallas registradas.</p>}
              {productVariants.length > 0 && <div className="mt-3">
                <p className="text-xs font-700 uppercase text-[#6B6860]">Talla y color</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {productVariants.map(item => <button
                    key={item.id}
                    type="button"
                    aria-pressed={selectedVariant?.id === item.id}
                    onClick={() => setSelectedVariantId(item.id)}
                    className={`border px-3 py-2 text-sm ${selectedVariant?.id === item.id ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#DDD9D0]'}`}
                  >{item.size} · {item.color}</button>)}
                </div>
              </div>}
              {selectedVariant && <div className="mt-4 border-t border-[#EEE8E1] pt-3">
                {product && <div className="mb-3 flex items-center gap-3">
                  <img src={product.img} alt={product.name} className="h-16 w-14 object-cover" />
                  <p className="text-xs text-[#6B6860]">{previewMessage}</p>
                </div>}
                {!fit ? <p className="text-sm text-[#6B6860]">Completa las medidas de la prenda para ver una estimación de ajuste.</p> : <>
                  <p className="text-sm">Ajuste estimado: <span className={`px-2 py-1 text-xs font-700 capitalize ${tone[fit.overall]}`}>{fit.overall}</span></p>
                  <p className="mt-2 text-xs text-[#6B6860]">{fit.zones.map(zone => `${zone.label}: ${zone.status}`).join(' · ')}</p>
                </>}
                {usesReferenceMeasurements && <p className="mt-2 text-xs leading-relaxed text-amber-900">Las medidas de esta talla son valores de referencia, no datos verificados de la prenda.</p>}
              </div>}
            </div>
          </div>
        </div>
        <div className="mt-6"><AvatarAccuracyReport accuracy={cladAvatar.accuracy} /></div>
        <div className="mt-6 max-w-2xl"><CladAvatarControls avatar={cladAvatar} hasBody={Boolean(body)} /></div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-16">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="text-xs font-700 uppercase tracking-[0.2em] text-[#A78B58]">Probador virtual</p>
        <h1 className="mt-2 font-display text-4xl text-[#0D0D0D]">Comprueba el ajuste</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6B6860]">Comparamos tus contornos con las medidas de cada talla y mostramos una representación 3D orientativa de la prenda seleccionada. No es una simulación física de tela.</p>
        {!body ? <div className="mt-8 border border-[#DDD9D0] bg-white p-8"><p role="status" className="text-sm text-[#6B6860]">{cladAvatar.loading ? 'Recuperando tu avatar y sus medidas…' : 'Necesitas guardar tus medidas antes de probarte ropa.'}</p>{cladAvatar.error && <p role="alert" className="mt-3 text-sm text-red-700">{cladAvatar.error}</p>}<button onClick={() => setPage('avatar')} className="mt-4 bg-[#0D0D0D] px-5 py-3 text-sm text-white">Ir a Mi Avatar</button></div> : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border border-[#DDD9D0] bg-white">
              <FittingAvatar3D bodyModelUrl={cladAvatar.modelUrl} busy={cladAvatar.busy || cladAvatar.loading} needsReview={!cladAvatar.accuracy?.withinTolerance} body={body} garment={product && selectedVariant ? { measurements: selectedVariant.measurements, category: product.category, name: product.name, colorHex: selectedVariant.colorHex } : null} />
              {cladAvatar.error && <div role="alert" className="border-t border-[#DDD9D0] p-4 text-sm text-red-700"><p>{cladAvatar.error}</p><button onClick={cladAvatar.reload} className="mt-2 underline">Volver a cargar mi avatar</button></div>}
              {cladAvatar.outdated && <p className="p-4 text-sm text-amber-900">Tus medidas cambiaron. Actualiza el modelo desde Mi Avatar.</p>}
              {!cladAvatar.modelUrl && !cladAvatar.busy && !cladAvatar.loading && <button onClick={() => setPage('avatar')} className="m-4 border border-[#DDD9D0] px-4 py-2 text-sm">Generar o revisar mi avatar</button>}
              {product && <div className="flex items-center gap-4 border-t border-[#DDD9D0] p-4" aria-label="Prenda seleccionada"><ImageWithFallback src={product.img} alt={product.name} className="h-24 w-20 object-cover" /><div><p className="text-xs text-[#6B6860]">Prenda seleccionada</p><h2 className="font-display text-xl">{product.name}</h2><p className="mt-1 text-sm">{selectedVariant ? `Talla ${selectedVariant.size} · ${selectedVariant.color}` : 'Sin tallas registradas'}</p><p className="mt-2 text-xs text-[#6B6860]">Representación 3D aproximada basada en las medidas registradas.</p></div></div>}
              {cladAvatar.modelUrl && <p className="px-4 py-3 text-xs text-[#6B6860]">La recomendación de talla se calcula con tus medidas y las medidas registradas de la prenda; el visor no simula la física de la tela.</p>}
              <FittingAvatar3D bodyModelUrl={cladAvatar.modelUrl} busy={cladAvatar.busy || cladAvatar.loading} needsReview={!cladAvatar.accuracy?.withinTolerance} garment={previewGarment} />
              {cladAvatar.error && <div role="alert" className="border-t border-[#DDD9D0] p-4 text-sm text-red-700"><p>{cladAvatar.error}</p><button onClick={cladAvatar.reload} className="mt-2 underline">Volver a cargar mi avatar</button></div>}
              {cladAvatar.outdated && <p className="p-4 text-sm text-amber-900">Tus medidas cambiaron. Actualiza el modelo desde Mi Avatar.</p>}
              {!cladAvatar.modelUrl && !cladAvatar.busy && !cladAvatar.loading && <button onClick={() => setPage('avatar')} className="m-4 border border-[#DDD9D0] px-4 py-2 text-sm">Generar o revisar mi avatar</button>}
              {product && <div className="flex items-center gap-4 border-t border-[#DDD9D0] p-4" aria-label="Prenda seleccionada"><img src={product.img} alt={product.name} className="h-24 w-20 object-cover" /><div><p className="text-xs text-[#6B6860]">Prenda seleccionada</p><h2 className="font-display text-xl">{product.name}</h2><p className="mt-1 text-sm">{selectedVariant ? `Talla ${selectedVariant.size} · ${selectedVariant.color}` : 'Sin tallas registradas'}</p>{selectedVariant && <p className="mt-2 text-xs text-[#6B6860]">{previewMessage}</p>}</div></div>}
              <div className="flex items-center justify-between gap-3 p-4 text-xs text-[#6B6860]"><span>Arrastra para girar · Acerca con la rueda</span><button onClick={() => setPage('avatar')} className="font-700 text-[#0D0D0D] underline">Editar mis medidas</button></div>
            </div>
            <div className="space-y-5">
              <div className="border border-[#DDD9D0] bg-white p-5">
                <h2 className="font-display text-xl text-[#0D0D0D]">Prenda</h2>
                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                  {products.map(item => <button key={item.id} aria-pressed={item.id === selectedProductId} onClick={() => { setSelectedProductId(item.id); setSelectedVariantId(null); onProductChange?.(item.id) }} className={`flex w-full items-center gap-3 border p-2 text-left ${item.id === selectedProductId ? 'border-[#C9A96E] bg-[#FAF8F5]' : 'border-[#DDD9D0]'}`}><ImageWithFallback src={item.img} alt="" className="h-12 w-10 object-cover" /><span className="text-sm font-600">{item.name}</span></button>)}
                </div>
                {loadingVariants && <p className="mt-3 text-sm text-[#6B6860]">Cargando tallas…</p>}
                {variantError && <p role="alert" className="mt-3 text-sm text-red-700">No se pudieron cargar las medidas: {variantError}</p>}
                {!loadingVariants && !variantError && productVariants.length === 0 && <p className="mt-3 text-sm text-[#6B6860]">Este producto aún no tiene tallas registradas en Supabase.</p>}
                {productVariants.length > 0 && <div className="mt-4"><p className="text-xs font-700 uppercase text-[#6B6860]">Talla</p><div className="mt-2 flex flex-wrap gap-2">{productVariants.map(item => <button key={item.id} onClick={() => setSelectedVariantId(item.id)} className={`border px-3 py-2 text-sm ${selectedVariant?.id === item.id ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#DDD9D0]'}`}>{item.size} · {item.color}</button>)}</div></div>}
              </div>
              <div className="border border-[#DDD9D0] bg-white p-5">
                <h2 className="font-display text-xl text-[#0D0D0D]">Ajuste estimado</h2>
                {usesReferenceMeasurements && <p className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">Esta talla usa medidas promedio de referencia, no medidas verificadas de la prenda. La recomendación sirve para probar el sistema y puede diferir del ajuste real.</p>}
                {!fit ? <p className="mt-3 text-sm text-[#6B6860]">Faltan las medidas de esta talla. El administrador debe registrarlas para calcular el ajuste.</p> : <>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><span className={`px-3 py-1 text-xs font-700 capitalize ${tone[fit.overall]}`}>{fit.overall}</span>{recommended && <button type="button" onClick={() => setSelectedVariantId(recommended.variant.id)} className="text-xs text-[#6B6860] underline">Usar talla sugerida: <strong>{recommended.variant.size}</strong></button>}</div>
                  <div className="mt-4 space-y-3">{fit.zones.map(zone => <div key={zone.key} className="flex items-center justify-between gap-2 border-b border-[#EEE8E1] pb-2 text-sm"><div><p className="font-600">{zone.label}</p><p className="text-xs text-[#6B6860]">Cuerpo {zone.bodyCm.toFixed(1)} cm · prenda {zone.garmentCm.toFixed(1)} cm</p></div><span className={`px-2 py-1 text-xs capitalize ${tone[zone.status]}`}>{zone.status}</span></div>)}</div>
                  {selectedVariant?.measurements?.length != null && <p className="mt-3 text-xs text-[#6B6860]">Largo de la prenda: {selectedVariant.measurements.length.toFixed(1)} cm. El largo aún no interviene en el cálculo porque falta una medida corporal equivalente.</p>}
                  <p className="mt-4 text-xs leading-relaxed text-[#6B6860]">Los anchos de la prenda se interpretan como medidas en plano y se convierten a contornos. El resultado es orientativo y no sustituye una prueba física.</p>
                </>}
              </div>
              <AvatarAccuracyReport accuracy={cladAvatar.accuracy} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
