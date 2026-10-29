-- Ejecutar una vez en Supabase > SQL Editor antes de usar el nuevo probador.
-- No modifica datos existentes. Agrega políticas para medidas y tallas.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE public.medidas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variantes_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especificaciones_prenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos_3d_ropa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario lee sus medidas" ON public.medidas_usuario;
CREATE POLICY "Usuario lee sus medidas" ON public.medidas_usuario
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
DROP POLICY IF EXISTS "Usuario crea sus medidas" ON public.medidas_usuario;
CREATE POLICY "Usuario crea sus medidas" ON public.medidas_usuario
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
DROP POLICY IF EXISTS "Usuario actualiza sus medidas" ON public.medidas_usuario;
CREATE POLICY "Usuario actualiza sus medidas" ON public.medidas_usuario
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Catalogo lee variantes activas" ON public.variantes_producto;
CREATE POLICY "Catalogo lee variantes activas" ON public.variantes_producto
  FOR SELECT TO anon, authenticated USING (esta_activo IS TRUE);
DROP POLICY IF EXISTS "Admin lee todas las variantes" ON public.variantes_producto;
CREATE POLICY "Admin lee todas las variantes" ON public.variantes_producto
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admin crea variantes" ON public.variantes_producto;
CREATE POLICY "Admin crea variantes" ON public.variantes_producto
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin actualiza variantes" ON public.variantes_producto;
CREATE POLICY "Admin actualiza variantes" ON public.variantes_producto
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Catalogo lee especificaciones" ON public.especificaciones_prenda;
CREATE POLICY "Catalogo lee especificaciones" ON public.especificaciones_prenda
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.variantes_producto v
            WHERE v.id = variante_producto_id AND v.esta_activo IS TRUE)
  );
DROP POLICY IF EXISTS "Admin lee especificaciones" ON public.especificaciones_prenda;
CREATE POLICY "Admin lee especificaciones" ON public.especificaciones_prenda
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admin crea especificaciones" ON public.especificaciones_prenda;
CREATE POLICY "Admin crea especificaciones" ON public.especificaciones_prenda
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin actualiza especificaciones" ON public.especificaciones_prenda;
CREATE POLICY "Admin actualiza especificaciones" ON public.especificaciones_prenda
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Catalogo lee modelos 3D" ON public.recursos_3d_ropa;
CREATE POLICY "Catalogo lee modelos 3D" ON public.recursos_3d_ropa
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.variantes_producto v
            WHERE v.id = variante_producto_id AND v.esta_activo IS TRUE)
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
