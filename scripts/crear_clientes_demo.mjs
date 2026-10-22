import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !secret) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}

let keyType = 'unknown'
if (secret.startsWith('sb_secret_')) keyType = 'secret'
else if (secret.startsWith('sb_publishable_')) keyType = 'publishable'
else {
  try {
    const payload = JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString('utf8'))
    keyType = payload.role === 'service_role' ? 'service_role' : payload.role === 'anon' ? 'anon' : 'unknown'
  } catch { /* La llamada a Supabase informará si la clave es inválida. */ }
}

if (keyType === 'anon' || keyType === 'publishable') {
  console.error(`La clave configurada es de tipo ${keyType}. Para crear usuarios necesitas una sb_secret_ o la service_role de este proyecto.`)
  console.error('Obtén la clave en Supabase > Settings > API Keys y guárdala solo en .env.seed.local.')
  process.exit(1)
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { count, error: countError } = await supabase
  .from('perfiles')
  .select('id', { count: 'exact', head: true })
  .eq('rol', 'client')

if (countError) throw countError

const missing = Math.max(0, 20 - (count ?? 0))
if (missing === 0) {
  console.log('Ya existen al menos 20 perfiles de clientes. Ejecuta seed_pedidos_demo.sql.')
  process.exit(0)
}

const names = [
  ['Ana', 'Torres'], ['Luis', 'Ramírez'], ['María', 'Flores'],
  ['Carlos', 'Mendoza'], ['Valeria', 'Rojas'], ['José', 'Vargas'],
  ['Camila', 'Paredes'], ['Diego', 'Salazar'], ['Lucía', 'Castillo'],
  ['Andrés', 'Reyes'], ['Sofía', 'Navarro'], ['Miguel', 'Campos'],
  ['Fernanda', 'Silva'], ['Jorge', 'Morales'], ['Daniela', 'Herrera'],
  ['Pablo', 'Medina'], ['Gabriela', 'Cruz'], ['Ricardo', 'León'],
  ['Paola', 'Aguilar'], ['Sebastián', 'Ortiz'],
]

let created = 0
for (let index = 0; index < names.length && created < missing; index++) {
  const [nombre, apellido] = names[index]
  const correo = `velour.demo.${String(index + 1).padStart(2, '0')}@example.com`
  const { data: existing, error: lookupError } = await supabase
    .from('perfiles')
    .select('id')
    .eq('correo', correo)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing) continue

  const { data, error: authError } = await supabase.auth.admin.createUser({
    email: correo,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { name: `${nombre} ${apellido}`, nombre, apellido, role: 'client', rol: 'client' },
  })
  if (authError || !data.user) throw authError ?? new Error(`No se pudo crear ${correo}`)

  const { error: profileError } = await supabase.from('perfiles').upsert({
    id: data.user.id,
    correo,
    nombre,
    apellido,
    rol: 'client',
  }, { onConflict: 'id' })
  if (profileError) throw profileError

  created++
  console.log(`Cliente de prueba ${created}/${missing}: ${correo}`)
}

const { count: finalCount, error: finalError } = await supabase
  .from('perfiles')
  .select('id', { count: 'exact', head: true })
  .eq('rol', 'client')

if (finalError) throw finalError
console.log(`Perfiles de clientes disponibles: ${finalCount}.`)
if ((finalCount ?? 0) < 20) throw new Error('Aún faltan clientes; revisa los errores anteriores.')
console.log('Ahora ejecuta seed_pedidos_demo.sql en el SQL Editor de Supabase.')
