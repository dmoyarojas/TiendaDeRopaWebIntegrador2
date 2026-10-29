import { useState } from 'react'
import type { AdminOrderRow } from '../lib/adminOrders'

const statuses = ['pendiente', 'en preparación', 'enviado', 'entregado', 'cancelado']

export default function AdminOrdersPanel({ rows, loading, onRefresh, onStatusChange }: {
  rows: AdminOrderRow[]
  loading: boolean
  onRefresh: () => Promise<void>
  onStatusChange: (id: string, status: string) => Promise<void>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function update(id: string, status: string) {
    setPendingId(id); setError('')
    try { await onStatusChange(id, status) }
    catch { setError('No se pudo actualizar el artículo. Vuelve a intentarlo.') }
    finally { setPendingId(null) }
  }
  return <section className="space-y-5" aria-label="Pedidos de clientes">
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.2em] text-[#C9A96E]">Operaciones</p><h1 className="mt-2 font-display text-3xl">Pedidos recientes</h1></div>
      <button type="button" disabled={loading} onClick={() => void onRefresh()} className="border border-[#DDD9D0] px-4 py-2 text-xs uppercase disabled:opacity-50">{loading ? 'Cargando…' : 'Actualizar'}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto border border-[#E6E1D8] bg-white">
      <table className="min-w-full text-left">
        <thead className="bg-[#F5F1ED] text-xs uppercase text-[#6B6860]"><tr>{['Orden', 'Código del artículo', 'Producto', 'Cliente', 'Fecha', 'Total del pedido', 'Estado del artículo', 'Actualizar estado'].map(label => <th key={label} className="px-4 py-3 font-600">{label}</th>)}</tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.key} className="border-t border-[#EEE8E1] text-sm text-[#0D0D0D]">
            <td className="px-4 py-3 font-600">{row.order}</td>
            <td className="px-4 py-3 font-mono text-xs">{row.item?.codigo_producto ?? '—'}</td>
            <td className="px-4 py-3">{row.item ? <>{row.item.nombre_producto}<span className="block text-xs text-[#6B6860]">Talla {row.item.talla}</span></> : 'Pedido antiguo sin detalle de artículos'}</td>
            <td className="px-4 py-3">{row.customer}</td><td className="px-4 py-3">{row.date}</td><td className="px-4 py-3">{row.total}</td>
            <td className="px-4 py-3 capitalize">{row.item?.estado ?? 'Sin artículos'}</td>
            <td className="px-4 py-3"><select aria-label={`Estado del artículo ${row.item?.codigo_producto ?? row.order}`} value={row.item?.estado ?? ''} disabled={!row.item?.id || pendingId !== null} onChange={e => row.item?.id && void update(row.item.id, e.target.value)} className="border border-[#DDD9D0] bg-white px-2 py-1 text-xs disabled:opacity-50">
              {!row.item ? <option value="">Sin artículos</option> : <>
                {!statuses.includes(row.item.estado) && <option value={row.item.estado}>{row.item.estado}</option>}
                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
              </>}
            </select></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={8} role="status" className="p-10 text-center text-sm text-[#6B6860]">{loading ? 'Cargando pedidos…' : 'No hay pedidos registrados.'}</td></tr>}
        </tbody>
      </table>
    </div>
  </section>
}
