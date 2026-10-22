-- 1. Agregar campo 'etiqueta' a la tabla productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS etiqueta text;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url text;

-- 2. Crear la tabla de devoluciones
CREATE TABLE IF NOT EXISTS public.devoluciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  variante_producto_id uuid NOT NULL,
  codigo_devolucion text NOT NULL UNIQUE,
  motivo text NOT NULL,
  estado text DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'en revisión'::text, 'aprobado'::text, 'rechazado'::text])),
  creado_el timestamp with time zone DEFAULT now(),
  CONSTRAINT devoluciones_pkey PRIMARY KEY (id),
  CONSTRAINT devoluciones_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id),
  CONSTRAINT devoluciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles(id),
  CONSTRAINT devoluciones_variante_producto_id_fkey FOREIGN KEY (variante_producto_id) REFERENCES public.variantes_producto(id)
);

-- (Opcional) Insertar algunos datos de prueba si ya tienes pedidos, usuarios y variantes creadas.
-- Asegúrate de habilitar RLS y crear políticas para que puedan ser leídos si tu base de datos tiene Row Level Security activado.
ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;

-- Revisa el rol sin ejecutar las políticas RLS de perfiles de forma recursiva.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Almacenamiento público para imágenes de catálogo, con escritura solo para admins.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('productos', 'productos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Lectura publica de imagenes de productos" ON storage.objects;
CREATE POLICY "Lectura publica de imagenes de productos" ON storage.objects
  FOR SELECT USING (bucket_id = 'productos');

DROP POLICY IF EXISTS "Admins suben imagenes de productos" ON storage.objects;
CREATE POLICY "Admins suben imagenes de productos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'productos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins actualizan imagenes de productos" ON storage.objects;
CREATE POLICY "Admins actualizan imagenes de productos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'productos' AND public.is_admin())
  WITH CHECK (bucket_id = 'productos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins eliminan imagenes de productos" ON storage.objects;
CREATE POLICY "Admins eliminan imagenes de productos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'productos' AND public.is_admin());

-- Elimina solo políticas de perfiles que consultan la misma tabla.
DO $$
DECLARE
  recursive_policy record;
BEGIN
  FOR recursive_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'perfiles'
      AND (coalesce(qual, '') ILIKE '%perfiles%' OR coalesce(with_check, '') ILIKE '%perfiles%')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.perfiles', recursive_policy.policyname);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Permitir lectura de devoluciones a todos" ON public.devoluciones;
CREATE POLICY "Permitir lectura de devoluciones a todos" ON public.devoluciones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir lectura de productos a todos" ON public.productos;
CREATE POLICY "Permitir lectura de productos a todos" ON public.productos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir lectura de pedidos a todos" ON public.pedidos;
CREATE POLICY "Permitir lectura de pedidos a todos" ON public.pedidos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir lectura de perfiles a todos" ON public.perfiles;
CREATE POLICY "Permitir lectura de perfiles a todos" ON public.perfiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Permitir lectura de categorias a todos" ON public.categorias;
CREATE POLICY "Permitir lectura de categorias a todos" ON public.categorias FOR SELECT USING (true);

-- Escrituras administrativas: el usuario debe tener rol admin en su perfil.
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins pueden insertar categorias" ON public.categorias;
CREATE POLICY "Admins pueden insertar categorias" ON public.categorias
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins pueden insertar productos" ON public.productos;
CREATE POLICY "Admins pueden insertar productos" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins pueden actualizar productos" ON public.productos;
CREATE POLICY "Admins pueden actualizar productos" ON public.productos
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins pueden eliminar productos" ON public.productos;
CREATE POLICY "Admins pueden eliminar productos" ON public.productos
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins pueden actualizar pedidos" ON public.pedidos;
CREATE POLICY "Admins pueden actualizar pedidos" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
