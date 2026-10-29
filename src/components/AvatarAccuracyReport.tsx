import { AVATAR_TOLERANCE_CM, type AvatarAccuracy } from '../lib/cladAccuracy'

export default function AvatarAccuracyReport({ accuracy }: { accuracy: AvatarAccuracy | null }) {
  if (!accuracy) return null
  return <section className="border border-[#DDD9D0] bg-white p-5" aria-label="Comprobación de medidas del avatar">
    <h2 className="font-display text-xl">Tus medidas y el modelo generado</h2>
    <p className={`mt-2 text-sm ${accuracy.withinTolerance ? 'text-emerald-800' : 'text-amber-900'}`}>
      {accuracy.withinTolerance ? `Las seis medidas están dentro de una tolerancia de ${AVATAR_TOLERANCE_CM} cm.` : `El modelo requiere revisión: alguna medida falta o difiere más de ${AVATAR_TOLERANCE_CM} cm. Se muestra para revisar su forma.`}
    </p>
    <div className="mt-4 space-y-3">{accuracy.zones.map(zone => <div key={zone.key} className="flex items-center justify-between gap-4 border-b border-[#EEE8E1] pb-2 text-sm">
      <div><p>{zone.label}</p><p className="text-xs text-[#6B6860]">Ingresada: {zone.target.toFixed(1)} cm · Modelo: {zone.actual === null ? 'sin dato' : `${zone.actual.toFixed(1)} cm`}</p></div>
      <span className={zone.withinTolerance ? 'text-emerald-800' : 'text-amber-900'}>{zone.difference === null ? 'Sin verificar' : `${zone.difference > 0 ? '+' : ''}${zone.difference.toFixed(2)} cm`}</span>
    </div>)}</div>
    <p className="mt-3 text-xs leading-relaxed text-[#6B6860]">Comparamos las medidas que devuelve Clad para esta malla con las solicitadas. Coincidir en estos contornos no verifica toda la forma corporal ni garantiza cómo caerá una prenda.</p>
  </section>
}
