export interface AdminOrderItem { id: string; codigo_producto: string; nombre_producto: string; talla: string; estado: string }
export interface AdminOrderRow { key: string; order: string; customer: string; date: string; total: string; item: AdminOrderItem | null }

const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}

export function buildAdminOrderRows(orders: unknown[], priceScale: number): AdminOrderRow[] {
  return orders.flatMap<AdminOrderRow>((value, index) => {
    const order = record(value)
    const profile = record(Array.isArray(order.perfiles) ? order.perfiles[0] : order.perfiles)
    const id = text(order.id, `pedido-${index}`)
    const date = new Date(text(order.creado_el))
    const amount = Number(order.monto_total) / priceScale
    const info = {
      order: text(order.numero_orden, id.slice(0, 8)),
      customer: [text(profile.nombre), text(profile.apellido)].filter(Boolean).join(' ') || 'Desconocido',
      date: Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-PE') : 'Fecha no disponible',
      total: new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number.isFinite(amount) ? amount : 0),
    }
    const items = Array.isArray(order.pedido_productos) ? order.pedido_productos.filter(item => item && typeof item === 'object') : []
    if (!items.length) return [{ ...info, key: id, item: null }]
    return items.map((value, itemIndex) => {
      const item = record(value)
      return { ...info, key: `${id}-${text(item.id, String(itemIndex))}`, item: {
        id: text(item.id), codigo_producto: text(item.codigo_producto, 'Sin código'),
        nombre_producto: text(item.nombre_producto, 'Producto no disponible'), talla: text(item.talla, '—'),
        estado: text(item.estado, 'pendiente'),
      } }
    })
  })
}
