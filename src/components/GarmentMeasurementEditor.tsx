import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Product { id: string; nombre: string; precio_base: number }
interface VariantRow { id: string; talla: string; nombre_color: string; color_hex: string; precio: number; stock: number; esta_activo: boolean }
type FieldKey = 'ancho_pecho_cm' | 'ancho_cintura_cm' | 'ancho_cadera_cm' | 'ancho_hombros_cm' | 'largo_total_cm' | 'porcentaje_elasticidad'
type Form = { talla: string; nombre_color: string; color_hex: string; precio: string; stock: string } & Record<FieldKey, string>

const emptyForm: Form = {
  talla: 'M', nombre_color: 'Negro', color_hex: '#333333', precio: '', stock: '0',
  ancho_pecho_cm: '', ancho_cintura_cm: '', ancho_cadera_cm: '', ancho_hombros_cm: '',
  largo_total_cm: '', porcentaje_elasticidad: '0',
}
const measureFields: { key: FieldKey; label: string }[] = [
  { key: 'ancho_pecho_cm', label: 'Pecho' }, { key: 'ancho_cintura_cm', label: 'Cintura' },
  { key: 'ancho_cadera_cm', label: 'Cadera' }, { key: 'ancho_hombros_cm', label: 'Hombros' },
  { key: 'largo_total_cm', label: 'Largo total' }, { key: 'porcentaje_elasticidad', label: 'Elasticidad (%)' },
]

export default function GarmentMeasurementEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ ...emptyForm, precio: String(Number(product.precio_base) / 1000) })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    const { data, error: loadError } = await supabase.from('variantes_producto')
      .select('id, talla, nombre_color, color_hex, precio, stock, esta_activo')
      .eq('producto_id', product.id).order('talla')
    if (loadError) setError(loadError.message)
    else setVariants(data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [product.id])

  async function selectVariant(variant: VariantRow | null) {
    setSelectedId(variant?.id ?? null)
    setError('')
    setNotice('')
    if (!variant) {
      setForm({ ...emptyForm, precio: String(Number(product.precio_base) / 1000) })
      return
    }
    const { data, error: specError } = await supabase.from('especificaciones_prenda').select('*')
      .eq('variante_producto_id', variant.id).maybeSingle()
    if (specError) setError(specError.message)
    setForm({
      talla: variant.talla, nombre_color: variant.nombre_color, color_hex: variant.color_hex,
      precio: String(Number(variant.precio) / 1000), stock: String(variant.stock),
      ancho_pecho_cm: data?.ancho_pecho_cm == null ? '' : String(data.ancho_pecho_cm),
      ancho_cintura_cm: data?.ancho_cintura_cm == null ? '' : String(data.ancho_cintura_cm),
      ancho_cadera_cm: data?.ancho_cadera_cm == null ? '' : String(data.ancho_cadera_cm),
      ancho_hombros_cm: data?.ancho_hombros_cm == null ? '' : String(data.ancho_hombros_cm),
      largo_total_cm: data?.largo_total_cm == null ? '' : String(data.largo_total_cm),
      porcentaje_elasticidad: String(data?.porcentaje_elasticidad ?? 0),
    })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    const measured = measureFields.filter(field => field.key !== 'porcentaje_elasticidad' && field.key !== 'largo_total_cm' && form[field.key] !== '')
    if (measured.length === 0) { setError('Ingresa al menos un ancho de la prenda para calcular el ajuste.'); return }
    if (measureFields.some(field => form[field.key] !== '' && (!Number.isFinite(Number(form[field.key])) || Number(form[field.key]) < 0))) {
      setError('Las medidas deben ser números positivos.'); return
    }
    setSaving(true)
    try {
      const numberOrNull = (value: string) => value === '' ? null : Number(value)
      const { data: variantId, error: saveError } = await supabase.rpc('guardar_talla_y_medidas_admin', {
        p_producto_id: product.id,
        p_variante_id: selectedId,
        p_talla: form.talla.trim().toUpperCase(),
        p_nombre_color: form.nombre_color.trim(),
        p_color_hex: form.color_hex,
        p_precio: Math.round(Number(form.precio) * 1000),
        p_stock: Number(form.stock),
        p_ancho_pecho_cm: numberOrNull(form.ancho_pecho_cm),
        p_ancho_cintura_cm: numberOrNull(form.ancho_cintura_cm),
        p_ancho_cadera_cm: numberOrNull(form.ancho_cadera_cm),
        p_ancho_hombros_cm: numberOrNull(form.ancho_hombros_cm),
        p_largo_total_cm: numberOrNull(form.largo_total_cm),
        p_porcentaje_elasticidad: Number(form.porcentaje_elasticidad),
      })
      if (saveError) {
        if (saveError.code === 'PGRST202' || saveError.code === '42883') {
          throw new Error('Falta instalar guardar_medidas_admin.sql en Supabase SQL Editor.')
        }
        throw new Error(saveError.message)
      }
      if (!variantId) throw new Error('Supabase no confirmó el guardado de la talla.')
      setSelectedId(variantId)
      setNotice('Talla y medidas guardadas. Ya se pueden usar en el probador.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar las medidas. Revisa los permisos de Supabase.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="garment-editor-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6 text-[#0D0D0D]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-700 uppercase tracking-widest text-[#A78B58]">Medidas de prenda</p><h2 id="garment-editor-title" className="mt-1 font-display text-2xl">{product.nombre}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar" className="text-2xl">×</button></div>
        <p className="mt-3 text-sm text-[#6B6860]">Mide los anchos con la prenda extendida en plano. El probador los duplicará para compararlos con los contornos del cuerpo. Hombros y largo se registran una sola vez.</p>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void selectVariant(null)} className={`border px-3 py-2 text-sm ${selectedId === null ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#DDD9D0]'}`}>Nueva talla</button>{variants.map(variant => <button type="button" key={variant.id} onClick={() => void selectVariant(variant)} className={`border px-3 py-2 text-sm ${selectedId === variant.id ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#DDD9D0]'}`}>{variant.talla} · {variant.nombre_color}</button>)}</div>
        {loading && <p className="mt-3 text-sm text-[#6B6860]">Cargando tallas…</p>}
        <form onSubmit={event => void save(event)} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-[#6B6860]">Talla<input required value={form.talla} onChange={event => setForm(value => ({ ...value, talla: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm" /></label>
            <label className="text-xs text-[#6B6860]">Color<input required value={form.nombre_color} onChange={event => setForm(value => ({ ...value, nombre_color: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm" /></label>
            <label className="text-xs text-[#6B6860]">Precio S/<input required type="number" min="0" step="0.01" value={form.precio} onChange={event => setForm(value => ({ ...value, precio: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm" /></label>
            <label className="text-xs text-[#6B6860]">Stock<input required type="number" min="0" step="1" value={form.stock} onChange={event => setForm(value => ({ ...value, stock: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm" /></label>
          </div>
          <label className="flex items-center gap-3 text-xs text-[#6B6860]">Color en el visor<input type="color" value={form.color_hex} onChange={event => setForm(value => ({ ...value, color_hex: event.target.value }))} className="h-9 w-14" /></label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{measureFields.map(field => <label key={field.key} className="text-xs text-[#6B6860]">{field.label} {field.key === 'porcentaje_elasticidad' ? '' : '(cm)'}<input type="number" min="0" step="0.1" value={form[field.key]} onChange={event => setForm(value => ({ ...value, [field.key]: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm" /></label>)}</div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="border border-[#DDD9D0] px-4 py-2 text-sm">Cerrar</button><button type="submit" disabled={saving || loading} className="bg-[#0D0D0D] px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar talla'}</button></div>
        </form>
      </div>
    </div>
  )
}
