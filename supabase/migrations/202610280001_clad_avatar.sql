BEGIN;
CREATE TABLE IF NOT EXISTS public.avatares_clad (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('generating', 'tuning', 'ready', 'error')),
  body_input jsonb NOT NULL,
  questionnaire jsonb NOT NULL,
  job_id text,
  object_path text,
  measurements jsonb,
  last_requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.avatares_clad ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avatares_clad FROM anon, authenticated;
GRANT SELECT ON public.avatares_clad TO authenticated;
GRANT ALL ON public.avatares_clad TO service_role;
DROP POLICY IF EXISTS "Usuario lee su avatar Clad" ON public.avatares_clad;
CREATE POLICY "Usuario lee su avatar Clad" ON public.avatares_clad
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reservar_avatar_clad(p_body jsonb, p_questionnaire jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.avatares_clad (usuario_id, status, body_input, questionnaire)
  VALUES (auth.uid(), 'generating', p_body, p_questionnaire)
  ON CONFLICT (usuario_id) DO UPDATE SET
    request_id = pg_catalog.gen_random_uuid(), status = 'generating',
    body_input = EXCLUDED.body_input, questionnaire = EXCLUDED.questionnaire,
    job_id = NULL, measurements = NULL, last_requested_at = now()
  WHERE avatares_clad.last_requested_at < now() - interval '60 seconds'
    AND (avatares_clad.status NOT IN ('generating', 'tuning')
      OR avatares_clad.last_requested_at < now() - interval '5 minutes')
  RETURNING request_id INTO v_request;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Ya hay una generación en curso o debes esperar un minuto.' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_request;
END; $$;
REVOKE ALL ON FUNCTION public.reservar_avatar_clad(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_avatar_clad(jsonb, jsonb) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares-clad', 'avatares-clad', false, 20971520, ARRAY['model/gltf-binary'])
ON CONFLICT (id) DO NOTHING;
COMMIT;
NOTIFY pgrst, 'reload schema';


"ck_live_MHzx2btZqpQeAEtcnsCF6jvGMHzx2btZ"