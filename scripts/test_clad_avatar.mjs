import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { assessAvatarAccuracy } from '../src/lib/cladAccuracy.ts'
import { prepareCladScene } from '../src/lib/cladModel.ts'

// Ejecuta el handler real con Supabase y Clad simulados; no consume cuota.
const source = readFileSync('supabase/functions/clad-avatar/index.ts', 'utf8').replace(/^import .*\n/, '')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const body = { gender: 'F', height: 170, weight: 65, chest: 92, waist: 74, hips: 98, shoulder: 40, inseam: 78 }
const questionnaire = { body_shape: 'rectangle', belly: 2, build: 2, legs: 2, arms: 2 }

function harness({ authenticated = true, key = 'test-secret', row = null, failPoll = false } = {}) {
  const calls = [], uploads = [], queries = []
  let handler
  function builder(table) {
    const query = { table, op: 'select', filters: [] }
    queries.push(query)
    const b = {
      select() { return b },
      update(values) { query.op = 'update'; query.values = values; return b },
      eq(k, v) { query.filters.push([k, v]); return b },
      maybeSingle() { return Promise.resolve({ data: row, error: null }) },
      then(resolve, reject) { return Promise.resolve({ data: [{ request_id: 'request-1' }], error: null }).then(resolve, reject) },
    }
    return b
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user-1' } : null }, error: null }) },
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return { data: 'request-1', error: null } },
    from: builder,
    storage: { from: () => ({
      upload: async (path, bytes) => { uploads.push({ path, bytes }); return { error: null } },
      remove: async () => ({ error: null }),
      createSignedUrl: async path => ({ data: { signedUrl: `https://private.test/${path}` }, error: null }),
    }) },
  }
  const binary = new Uint8Array(12)
  new DataView(binary.buffer).setUint32(0, 0x46546c67, true)
  const mockFetch = async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null, authorization: options.headers.Authorization })
    if (url.endsWith('/from-questionnaire')) return Response.json({ params: 'opaque-params' })
    if (url.endsWith('/tune')) return Response.json({ job_id: 'job-1' })
    if (failPoll) throw new Error('Temporary network failure')
    return Response.json({ status: 'completed', result: { mesh: { data_b64: Buffer.from(binary).toString('base64') }, measurements: { waist_cm: 74 } } })
  }
  const env = { SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', CLAD_API_KEY: key }
  new Function('createClient', 'Deno', 'fetch', compiled)(() => client, { env: { get: k => env[k] }, serve: h => { handler = h } }, mockFetch)
  return {
    calls, uploads, queries,
    async request(input) {
      const response = await handler(new Request('https://edge.test', { method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(input) }))
      return { status: response.status, data: await response.json() }
    },
  }
}

let h = harness({ authenticated: false })
assert.equal((await h.request({ action: 'generate' })).status, 401)
assert.equal(h.calls.length, 0)
h = harness({ key: '' })
assert.equal((await h.request({ action: 'generate', body, questionnaire, consent: true })).status, 503)
h = harness()
assert.equal((await h.request({ action: 'generate', body, questionnaire, consent: false })).status, 400)
assert.equal(h.calls.length, 0)
assert.equal((await h.request({ action: 'generate', body: { ...body, height: 90 }, questionnaire, consent: true })).status, 400)
assert.equal(h.calls.length, 0)

h = harness()
assert.equal((await h.request({ action: 'generate', body, questionnaire, consent: true })).data.status, 'tuning')
const apiCalls = h.calls.filter(c => c.url)
assert.equal(apiCalls.length, 2)
assert.equal(apiCalls[0].body.height_cm, 170)
assert.equal(apiCalls[0].authorization, 'Bearer test-secret')
assert.equal(apiCalls[1].body.target_measurements.bust_cm, body.chest)
assert.equal(apiCalls[1].body.target_measurements.inseam_cm, body.inseam)
assert.equal(h.queries.at(-1).values.job_id, 'job-1')

const row = { usuario_id: 'user-1', request_id: 'request-1', status: 'tuning', job_id: 'owned-job', body_input: body }
h = harness({ row: { ...row } })
const ready = await h.request({ action: 'poll', job_id: 'someone-elses-job', usuario_id: 'user-2' })
assert.equal(ready.data.status, 'ready')
assert.ok(h.calls[0].url.endsWith('/owned-job'))
assert.deepEqual(h.queries[0].filters, [['usuario_id', 'user-1']])
assert.equal(h.uploads[0].path, 'user-1/request-1.glb')
assert.ok(ready.data.modelUrl.includes('user-1/request-1.glb'))
assert.equal('job_id' in ready.data, false)

h = harness({ row: { ...row }, failPoll: true })
await h.request({ action: 'poll' })
assert.equal(h.queries.some(q => q.values?.status === 'error'), false, 'Un fallo de red debe permitir reanudar el trabajo')
h = harness({ row: null })
assert.equal((await h.request({ action: 'get' })).data.status, 'none')
console.log('Clad: autenticación, consentimiento, validación, mapeo, aislamiento, GLB privado y reintento verificados.')

const actual = { height_cm: 170, bust_cm: 92, waist_cm: 74, hip_cm: 98, shoulder_width_cm: 40, inseam_cm: 78 }
assert.equal(assessAvatarAccuracy(body, actual).withinTolerance, true)
assert.equal(assessAvatarAccuracy(body, { ...actual, hip_cm: 109.61 }).withinTolerance, false)
assert.equal(assessAvatarAccuracy(body, { ...actual, hip_cm: 99.01 }).withinTolerance, false)
assert.equal(assessAvatarAccuracy(body, { ...actual, hip_cm: 99 }).withinTolerance, true)
for (const invalid of [null, undefined, NaN, Infinity, '98', -1]) {
  assert.equal(assessAvatarAccuracy(body, { ...actual, hip_cm: invalid }).withinTolerance, false)
}
assert.equal(assessAvatarAccuracy(body, {}).withinTolerance, false)
const mesh = new Mesh(new BoxGeometry(0.4, 0.3, 1.7), new MeshBasicMaterial())
mesh.position.set(2, 3, 0.85)
const prepared = prepareCladScene(mesh)
const bounds = new Box3().setFromObject(prepared)
const size = bounds.getSize(new Vector3())
assert.ok(Math.abs(size.y - 1.7) < 0.000001, 'La estatura en metros debe conservarse')
assert.ok(Math.abs(size.x - 0.4) < 0.000001)
assert.ok(Math.abs(size.z - 0.3) < 0.000001)
assert.ok(Math.abs(bounds.min.y) < 0.000001)
assert.equal(mesh.parent, null, 'No debe modificarse el modelo fuente')
mesh.geometry.dispose(); mesh.material.dispose()
console.log('Precisión: tolerancia por zona, datos faltantes y escala física del GLB verificados.')
