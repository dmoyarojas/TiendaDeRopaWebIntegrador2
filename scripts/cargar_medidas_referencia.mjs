import { createClient } from '@supabase/supabase-js'
import reference from '../src/data/medidasReferencia.json' with { type: 'json' }

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.seed.local')

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

function garmentType(product) {
  const name = product.nombre.toLowerCase()
  const category = (product.categorias?.nombre ?? '').toLowerCase()
  if (/jean|pantal|falda|short/.test(name) || /pantal|falda|short/.test(category)) return 'pants'
  if (/abrigo|coat/.test(name) || /abrigo/.test(category)) return 'coat'
  if (/polo|camisa/.test(name)) return 'top'
  if (/blazer/.test(name) || /blazer/.test(category)) return 'blazer'
  return 'top'
}

async function checked(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

const products = await checked(db.from('productos')
  .select('id,nombre,precio_base,esta_activo,categorias(nombre)').eq('esta_activo', true), 'Productos')
const variants = await checked(db.from('variantes_producto')
  .select('id,producto_id,talla,nombre_color,color_hex,precio,stock,esta_activo'), 'Variantes')
const specs = await checked(db.from('especificaciones_prenda')
  .select('variante_producto_id'), 'Medidas')
const existingSpecs = new Set(specs.map(row => row.variante_producto_id))
let createdVariants = 0
let createdSpecs = 0
let skippedSpecs = 0

for (const product of products) {
  const type = garmentType(product)
  for (const size of ['S', 'M', 'L', 'XL']) {
    const matches = variants.filter(row => row.producto_id === product.id && row.talla.toUpperCase() === size)
    if (matches.length > 1) throw new Error(`Más de una variante ${size} para ${product.nombre}; revisa los colores antes de continuar.`)
    let variant = matches[0]
    if (!variant) {
      variant = await checked(db.from('variantes_producto').insert({
        producto_id: product.id,
        sku: `VEL-REF-${product.id.slice(0, 8)}-${size}`,
        talla: size,
        nombre_color: 'Referencia',
        color_hex: '#777777',
        precio: product.precio_base,
        stock: 0,
        esta_activo: true,
      }).select('id,producto_id,talla,nombre_color,color_hex,precio,stock,esta_activo').single(), `Crear talla ${size} de ${product.nombre}`)
      variants.push(variant)
      createdVariants++
    }
    if (existingSpecs.has(variant.id)) {
      skippedSpecs++
      continue
    }
    await checked(db.from('especificaciones_prenda').insert({
      variante_producto_id: variant.id,
      ancho_pecho_cm: null,
      ancho_cintura_cm: null,
      ancho_cadera_cm: null,
      ancho_hombros_cm: null,
      largo_total_cm: null,
      largo_tiro_cm: null,
      ...reference[type][size],
      porcentaje_elasticidad: 0,
      tipo_corte: 'regular',
    }), `Guardar medidas ${size} de ${product.nombre}`)
    existingSpecs.add(variant.id)
    createdSpecs++
  }
}

console.log(JSON.stringify({ products: products.length, createdVariants, createdSpecs, skippedSpecs }))
