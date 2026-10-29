import { createClient } from 'npm:@supabase/supabase-js@2.117.1'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { ...cors, 'Cache-Control': 'no-store' } })
const url = Deno.env.get('SUPABASE_URL')!
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const apiKey = Deno.env.get('CLAD_API_KEY')

async function clad(path: string, body?: unknown) {
  const response = await fetch(`https://api.clad.you${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('Se alcanzó la cuota de Clad. Inténtalo más tarde.')
    if (response.status === 401 || response.status === 403) throw new Error('La conexión con Clad requiere revisar su clave de API.')
    throw new Error('Clad no pudo procesar el modelo. Revisa los datos o vuelve a intentarlo.')
  }
  return await response.json()
}

function validate(body: Record<string, unknown>, q: Record<string, unknown>) {
  const ranges: Record<string, [number, number]> = { height: [140, 220], weight: [30, 200], chest: [40, 200], waist: [40, 200], hips: [40, 220], shoulder: [20, 100], inseam: [30, 150] }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || Number(body[key]) < min || Number(body[key]) > max) throw new Error(`Revisa la medida ${key}.`)
  }
  if (!['F', 'M'].includes(String(body.gender))) throw new Error('Silueta inválida.')
  if (!['hourglass', 'rectangle', 'inverted_triangle', 'pear', 'apple'].includes(String(q.body_shape))) throw new Error('Selecciona la forma corporal.')
  for (const field of ['belly', 'build', 'legs', 'arms']) if (![1, 2, 3].includes(Number(q[field]))) throw new Error('Revisa las proporciones corporales.')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Método no permitido.' }, 405)
  const authorization = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return reply({ error: 'Inicia sesión para generar tu avatar.' }, 401)
  let requestId: string | null = null
  let markFailed = false
  try {
    const raw = await req.text()
    if (raw.length > 16384) return reply({ error: 'Solicitud demasiado grande.' }, 413)
    const input = JSON.parse(raw)
    if (!['get', 'generate', 'poll'].includes(input.action)) return reply({ error: 'Acción inválida.' }, 400)
    if (input.action === 'generate') {
      if (!apiKey) return reply({ error: 'La generación de avatares todavía no está configurada. Contacta al administrador.' }, 503)
      if (input.consent !== true) return reply({ error: 'Autoriza el envío de tus medidas a Clad para generar el modelo.' }, 400)
      const body = input.body ?? {}
      const q = input.questionnaire ?? {}
      validate(body, q)
      const reservation = await userClient.rpc('reservar_avatar_clad', { p_body: body, p_questionnaire: q })
      if (reservation.error) return reply({ error: reservation.error.code === 'P0001' ? reservation.error.message : 'No se pudo preparar el avatar. El administrador debe instalar la configuración de Clad.' }, 409)
      requestId = reservation.data
      markFailed = true
      const initial = await clad('/v1/body/from-questionnaire', {
        height_cm: body.height, mass_kg: body.weight, gender: body.gender === 'F' ? 'female' : 'male',
        body_shape: q.body_shape, belly: Number(q.belly), build: Number(q.build), legs: Number(q.legs), arms: Number(q.arms),
      })
      const job = await clad('/v1/body/tune', { params: initial.params, target_measurements: {
        height_cm: body.height, bust_cm: body.chest, waist_cm: body.waist, hip_cm: body.hips,
        shoulder_width_cm: body.shoulder, inseam_cm: body.inseam,
      } })
      if (typeof job.job_id !== 'string') throw new Error('Clad no devolvió un trabajo de generación válido.')
      const update = await admin.from('avatares_clad').update({ status: 'tuning', job_id: job.job_id })
        .eq('usuario_id', user.id).eq('request_id', requestId)
      if (update.error) throw new Error('No se pudo guardar el estado de generación.')
      return reply({ status: 'tuning', body_input: body })
    }
    const { data: row, error } = await admin.from('avatares_clad').select('*').eq('usuario_id', user.id).maybeSingle()
    if (error) return reply({ error: 'La configuración de avatares todavía no está instalada.' }, 503)
    if (!row) return reply({ status: 'none' })
    requestId = row.request_id
    if (input.action === 'poll' && row.status === 'tuning' && row.job_id) {
      if (!apiKey) return reply({ error: 'La conexión con Clad todavía no está configurada.' }, 503)
      const job = await clad(`/v1/jobs/${encodeURIComponent(row.job_id)}`)
      if (job.status === 'failed') {
        markFailed = true
        throw new Error('Clad no pudo ajustar el cuerpo a esas medidas. Revisa los datos e inténtalo de nuevo.')
      }
      if (job.status === 'completed') {
        const result = job.result
        if (typeof result?.mesh?.data_b64 !== 'string' || result.mesh.data_b64.length > 28000000) throw new Error('Clad devolvió un modelo inválido.')
        const binary = Uint8Array.from(atob(result.mesh.data_b64), c => c.charCodeAt(0))
        if (binary.length < 12 || new DataView(binary.buffer).getUint32(0, true) !== 0x46546c67) throw new Error('El archivo del avatar no es GLB.')
        const path = `${user.id}/${row.request_id}.glb`
        const uploaded = await admin.storage.from('avatares-clad').upload(path, binary, { contentType: 'model/gltf-binary', upsert: true })
        if (uploaded.error) throw new Error('No se pudo guardar el modelo 3D.')
        const saved = await admin.from('avatares_clad').update({ status: 'ready', object_path: path, measurements: result.measurements })
          .eq('usuario_id', user.id).eq('request_id', row.request_id).select('request_id')
        if (saved.error || !saved.data?.length) throw new Error('La generación fue reemplazada. Actualiza el perfil.')
        if (row.object_path && row.object_path !== path) await admin.storage.from('avatares-clad').remove([row.object_path])
        row.status = 'ready'; row.object_path = path; row.measurements = result.measurements
      }
    }
    let modelUrl: string | null = null
    if (row.status === 'ready' && row.object_path) {
      const signed = await admin.storage.from('avatares-clad').createSignedUrl(row.object_path, 3600)
      if (signed.error) throw new Error('No se pudo abrir el modelo 3D.')
      modelUrl = signed.data.signedUrl
    }
    return reply({ status: row.status, modelUrl, body_input: row.body_input, measurements: row.measurements })
  } catch (error) {
    if (markFailed && requestId) await admin.from('avatares_clad').update({ status: 'error' }).eq('usuario_id', user.id).eq('request_id', requestId)
    return reply({ error: error instanceof Error ? error.message : 'No se pudo generar el avatar.' }, 400)
  }
})
