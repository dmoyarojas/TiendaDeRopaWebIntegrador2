import { useState } from 'react'
import type { CladQuestionnaire, useCladAvatar } from '../lib/clad'

export default function CladAvatarControls({ avatar, hasBody }: { avatar: ReturnType<typeof useCladAvatar>; hasBody: boolean }) {
  const [q, setQ] = useState<CladQuestionnaire>({ body_shape: 'rectangle', belly: 2, build: 2, legs: 2, arms: 2 })
  const [consent, setConsent] = useState(false)
  const selectClass = 'mt-1 w-full border border-[#DDD9D0] bg-white px-3 py-2 text-sm'
  return <div className="border border-[#DDD9D0] bg-white p-6">
    <h2 className="font-display text-2xl">Tu cuerpo 3D con Clad</h2>
    <p className="mt-2 text-sm text-[#6B6860]">Primero guarda tus medidas. Después indica tus proporciones para generar un modelo y ajustarlo a tus contornos.</p>
    <div className="mt-4 grid grid-cols-2 gap-4">
      <label className="col-span-2 text-xs">Forma corporal<select className={selectClass} value={q.body_shape} onChange={e => setQ({ ...q, body_shape: e.target.value })}>
        <option value="rectangle">Rectangular</option><option value="hourglass">Reloj de arena</option><option value="inverted_triangle">Triángulo invertido</option><option value="pear">Caderas más anchas</option><option value="apple">Centro del cuerpo más ancho</option>
      </select></label>
      {([
        ['belly', 'Abdomen', ['Poco prominente', 'Intermedio', 'Prominente']],
        ['build', 'Complexión', ['Poco musculosa', 'Media', 'Atlética']],
        ['legs', 'Longitud de piernas', ['Cortas', 'Medias', 'Largas']],
        ['arms', 'Longitud de brazos', ['Cortos', 'Medios', 'Largos']],
      ] as const).map(([key, label, options]) => <label key={key} className="text-xs">{label}<select className={selectClass} value={q[key]} onChange={e => setQ({ ...q, [key]: Number(e.target.value) })}>{options.map((label, i) => <option key={i} value={i + 1}>{label}</option>)}</select></label>)}
    </div>
    <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#6B6860]"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />Autorizo enviar mis medidas y proporciones corporales a Clad para generar mi avatar 3D.</label>
    {!avatar.loggedIn && <p className="mt-3 text-sm text-[#6B6860]">Inicia sesión para guardar y recuperar tu modelo.</p>}
    {avatar.outdated && <p className="mt-3 text-sm text-amber-800">Tus medidas cambiaron. Genera de nuevo el avatar para actualizarlas.</p>}
    <button type="button" disabled={avatar.busy || !hasBody || !avatar.loggedIn || !consent} onClick={() => void avatar.generate(q, consent)} className="mt-4 w-full bg-[#0D0D0D] px-5 py-3 text-sm text-white disabled:opacity-50">{avatar.busy ? 'Generando y ajustando el cuerpo…' : avatar.modelUrl ? 'Volver a generar con Clad' : 'Generar avatar con Clad'}</button>
    {avatar.error && <p role="alert" className="mt-3 text-sm text-red-700">{avatar.error}</p>}
    {avatar.error && <button type="button" onClick={avatar.reload} className="mt-2 text-xs underline">Consultar estado del avatar</button>}
  </div>
}
