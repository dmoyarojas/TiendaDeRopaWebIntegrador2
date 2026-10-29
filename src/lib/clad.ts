import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { BodyMeasurements } from './fitting'
import { assessAvatarAccuracy } from './cladAccuracy'

export interface CladQuestionnaire { body_shape: string; belly: number; build: number; legs: number; arms: number }
interface AvatarResult {
  status: 'none' | 'generating' | 'tuning' | 'ready' | 'error'
  modelUrl?: string | null
  body_input?: BodyMeasurements
  measurements?: Record<string, unknown> | null
}

async function invoke(body: Record<string, unknown>): Promise<AvatarResult> {
  const { data, error } = await supabase.functions.invoke('clad-avatar', { body })
  if (error) {
    if ('context' in error && error.context instanceof Response) {
      const response = await error.context.json().catch(() => null)
      if (response?.error) throw new Error(response.error)
    }
    throw new Error('No se pudo conectar con el generador de avatares. Comprueba tu sesión y la configuración del servicio.')
  }
  if (data?.error) throw new Error(data.error)
  if (!data || !['none', 'generating', 'tuning', 'ready', 'error'].includes(data.status)) throw new Error('El generador devolvió una respuesta inválida.')
  return data
}

export function sameBody(a: BodyMeasurements | undefined, b: BodyMeasurements | null) {
  return Boolean(a && b && (Object.keys(b) as (keyof BodyMeasurements)[]).every(key => a[key] === b[key]))
}

export function useCladAvatar(body: BodyMeasurements | null) {
  const [userId, setUserId] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<AvatarResult>({ status: 'none' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const run = ++generation.current
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    setAvatar({ status: 'none' }); setError(''); setBusy(false)
    if (!userId) return
    async function load(action: 'get' | 'poll') {
      if (run !== generation.current) return
      try {
        const result = await invoke({ action })
        if (run !== generation.current) return
        setAvatar(result)
        const pending = result.status === 'generating' || result.status === 'tuning'
        setBusy(pending)
        if (pending) {
          if (Date.now() - started > 300000) {
            setBusy(false)
            setError('La generación está tardando. Puedes consultar su estado o volver a intentarlo.')
          } else timer = setTimeout(() => void load('poll'), 4000)
        } else if (result.status === 'ready') {
          // Renueva la URL privada antes de que expire.
          timer = setTimeout(() => void load('get'), 50 * 60 * 1000)
        } else if (result.status === 'error') setError('La generación anterior no se completó. Puedes volver a intentarlo.')
      } catch (cause) {
        if (run === generation.current) { setBusy(false); setError(cause instanceof Error ? cause.message : 'No se pudo cargar el avatar.') }
      }
    }
    void load('get')
    return () => { generation.current++; clearTimeout(timer) }
  }, [userId, refresh])

  const generate = useCallback(async (questionnaire: CladQuestionnaire, consent: boolean) => {
    if (!body || !userId) { setError('Guarda tus medidas e inicia sesión para generar el avatar.'); return }
    if (!consent) { setError('Autoriza el envío de tus medidas a Clad para continuar.'); return }
    if (body.height < 140 || body.height > 220 || body.weight < 30 || body.weight > 200) {
      setError('Clad admite estaturas de 140 a 220 cm y pesos de 30 a 200 kg.'); return
    }
    const run = ++generation.current
    setBusy(true); setError(''); setAvatar({ status: 'generating' })
    try {
      await invoke({ action: 'generate', body, questionnaire, consent })
      if (run === generation.current) setRefresh(value => value + 1)
    } catch (cause) {
      if (run === generation.current) { setBusy(false); setAvatar({ status: 'error' }); setError(cause instanceof Error ? cause.message : 'No se pudo generar el avatar.') }
    }
  }, [body, userId])

  const matchesSavedBody = sameBody(avatar.body_input, body)
  const accuracy = avatar.status === 'ready' && matchesSavedBody && body
    ? assessAvatarAccuracy(body, avatar.measurements) : null
  return {
    accuracy,
    modelUrl: avatar.status === 'ready' && sameBody(avatar.body_input, body) ? avatar.modelUrl ?? null : null,
    outdated: avatar.status === 'ready' && !sameBody(avatar.body_input, body),
    busy, error, loggedIn: Boolean(userId), generate,
    reload: () => setRefresh(value => value + 1),
  }
}
