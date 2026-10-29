import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildAdminOrderRows } from '../src/lib/adminOrders.ts'

function loadComponent(file, mocks = {}) {
  const filename = resolve(file)
  const require = createRequire(pathToFileURL(filename))
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports.default
}

const OrdersPanel = loadComponent('src/components/AdminOrdersPanel.tsx')
const order = { id: 'order-1', numero_orden: 'VL-TEST', monto_total: 200000, creado_el: '2026-10-28T12:00:00Z', perfiles: { nombre: 'Cliente', apellido: 'Prueba' } }
const rows = buildAdminOrderRows([
  { ...order, pedido_productos: [{ id: 'item-1', codigo_producto: 'ART-TEST', nombre_producto: 'Blazer', talla: 'M', estado: 'pendiente' }] },
  { ...order, id: 'legacy', numero_orden: null, pedido_productos: null },
  { id: null, creado_el: 'invalid', monto_total: 'invalid', perfiles: [], pedido_productos: [null, { estado: {} }] },
], 1000)
const html = renderToStaticMarkup(React.createElement(OrdersPanel, { rows, loading: false, onRefresh: async () => {}, onStatusChange: async () => {} }))
assert.ok(html.includes('Pedidos recientes'))
assert.ok(html.includes('ART-TEST'))
assert.ok(html.includes('Pedido antiguo sin detalle'))
assert.ok(html.includes('Fecha no disponible'))
assert.equal(html.includes('[object Object]'), false)
assert.equal(rows.length, 3)
for (const loading of [true, false]) {
  const empty = renderToStaticMarkup(React.createElement(OrdersPanel, { rows: [], loading, onRefresh: async () => {}, onStatusChange: async () => {} }))
  assert.ok(empty.includes(loading ? 'Cargando pedidos' : 'No hay pedidos registrados'))
}

const body = { gender: 'F', height: 170, weight: 65, chest: 92, waist: 74, hips: 98, shoulder: 40, inseam: 78 }
const avatar = { modelUrl: 'https://private.test/avatar.glb', busy: false, loading: false, accuracy: null, savedBody: body }
const Fitting = loadComponent('src/components/FittingExperience.tsx', {
  '../lib/supabase': { supabase: {} },
  '../lib/fitting': { readSavedBody: () => body, assessFit: () => null, isReferenceMeasurements: () => false },
  '../lib/clad': { useCladAvatar: () => avatar },
  './FittingAvatar3D': { default: ({ bodyModelUrl }) => React.createElement('div', { 'data-avatar': bodyModelUrl }) },
  './CladAvatarControls': { default: () => null }, './AvatarAccuracyReport': { default: () => null },
})
const products = [
  { id: 'first', name: 'Primera prenda', category: 'Camisas', price: 50, img: 'first.jpg' },
  { id: 'chosen', name: 'Prenda elegida', category: 'Pantalones', price: 90, img: 'chosen.jpg' },
]
const fittingHtml = renderToStaticMarkup(React.createElement(Fitting, { mode: 'tryon', products, initialProductId: 'chosen', setPage: () => {} }))
assert.ok(fittingHtml.includes('data-avatar="https://private.test/avatar.glb"'))
assert.ok(fittingHtml.includes('aria-label="Prenda seleccionada"'))
assert.ok(fittingHtml.includes('<h2 class="font-display text-xl">Prenda elegida</h2>'))
assert.ok(fittingHtml.includes('aria-pressed="true"'))
assert.ok(fittingHtml.includes('La prenda todavía no se superpone'))
console.log('Pedidos: renderizado con artículos, pedidos antiguos, datos incompletos y estados vacíos verificado.')
console.log('Probador: avatar Clad y prenda elegida desde el catálogo presentes en el mismo renderizado.')

if (process.argv.includes('--supabase')) {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.from('pedidos').select('id,numero_orden,monto_total,creado_el,perfiles(nombre,apellido),pedido_productos(id,codigo_producto,nombre_producto,talla,estado)')
  if (error) throw new Error(error.message)
  const realRows = buildAdminOrderRows(data, 1000)
  const realHtml = renderToStaticMarkup(React.createElement(OrdersPanel, { rows: realRows, loading: false, onRefresh: async () => {}, onStatusChange: async () => {} }))
  assert.ok(realHtml.includes('Pedidos recientes'))
  assert.ok(realRows.length >= data.length)
  console.log(`Renderizado con Supabase verificado: ${data.length} pedidos, ${realRows.length} filas. No se imprimieron datos personales.`)
}
