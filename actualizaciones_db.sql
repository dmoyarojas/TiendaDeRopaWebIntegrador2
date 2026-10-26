-- 1. Agregar campo 'etiqueta' a la tabla productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS etiqueta text;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url text;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0);

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

-- Seguimiento individual de cada unidad vendida y su código de devolución.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero_orden text,
  ADD COLUMN IF NOT EXISTS codigo_devolucion text;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_orden_unique
  ON public.pedidos (numero_orden)
  WHERE numero_orden IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_codigo_devolucion_unique
  ON public.pedidos (codigo_devolucion)
  WHERE codigo_devolucion IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pedido_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id text NOT NULL,
  nombre_producto text NOT NULL,
  talla text NOT NULL,
  codigo_producto text NOT NULL UNIQUE,
  precio_unitario bigint NOT NULL CHECK (precio_unitario >= 0),
  stock_descontado boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado = ANY (ARRAY['pendiente', 'en preparación', 'enviado', 'entregado', 'cancelado'])),
  creado_el timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_productos
  ADD COLUMN IF NOT EXISTS stock_descontado boolean NOT NULL DEFAULT false;

ALTER TABLE public.pedido_productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes consultan sus articulos" ON public.pedido_productos;
CREATE POLICY "Clientes consultan sus articulos" ON public.pedido_productos
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.pedidos
      WHERE pedidos.id = pedido_productos.pedido_id
        AND pedidos.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clientes crean articulos de sus pedidos" ON public.pedido_productos;
CREATE POLICY "Clientes crean articulos de sus pedidos" ON public.pedido_productos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pedidos
      WHERE pedidos.id = pedido_productos.pedido_id
        AND pedidos.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins actualizan estado de articulos" ON public.pedido_productos;
CREATE POLICY "Admins actualizan estado de articulos" ON public.pedido_productos
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Clientes crean sus pedidos" ON public.pedidos;
CREATE POLICY "Clientes crean sus pedidos" ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.pedido_productos TO authenticated;
GRANT INSERT ON public.pedidos TO authenticated;

DROP FUNCTION IF EXISTS public.crear_pedido_con_detalles(text, text, bigint, text, jsonb);

CREATE FUNCTION public.crear_pedido_con_detalles(
  p_numero_orden text,
  p_codigo_devolucion text,
  p_monto_total bigint,
  p_direccion_envio text,
  p_productos jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nuevo_pedido_id uuid;
  producto record;
  catalogo record;
  unidad integer;
  subtotal bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar el pedido.';
  END IF;
  IF p_numero_orden IS NULL OR p_codigo_devolucion IS NULL
    OR p_monto_total IS NULL OR p_monto_total < 0
    OR p_direccion_envio IS NULL OR btrim(p_direccion_envio) = ''
    OR jsonb_typeof(p_productos) <> 'array' OR jsonb_array_length(p_productos) = 0
  THEN
    RAISE EXCEPTION 'El total o los productos del pedido no son válidos.';
  END IF;

  FOR producto IN
    SELECT *
    FROM jsonb_to_recordset(p_productos) AS item(
      producto_id text,
      nombre_producto text,
      talla text,
      cantidad integer,
      precio_unitario bigint
    )
  LOOP
    IF producto.cantidad IS NULL OR producto.cantidad < 1
      OR producto.producto_id IS NULL OR producto.nombre_producto IS NULL
      OR producto.talla IS NULL OR producto.precio_unitario IS NULL
      OR producto.precio_unitario < 0
    THEN
      RAISE EXCEPTION 'Un producto del pedido contiene datos no válidos.';
    END IF;

    SELECT nombre, precio_base
    INTO catalogo
    FROM public.productos
    WHERE id::text = producto.producto_id;

    IF NOT FOUND OR catalogo.nombre <> producto.nombre_producto
      OR catalogo.precio_base <> producto.precio_unitario
    THEN
      RAISE EXCEPTION 'El producto o su precio ya no coincide con el catálogo.';
    END IF;

    subtotal := subtotal + producto.cantidad * producto.precio_unitario;
  END LOOP;

  IF (subtotal >= 200000 AND p_monto_total <> subtotal)
    OR (subtotal < 200000 AND p_monto_total <> subtotal + 15000)
  THEN
    RAISE EXCEPTION 'El total del pedido no coincide con sus productos.';
  END IF;

  FOR producto IN
    SELECT item.producto_id, sum(item.cantidad)::integer AS cantidad
    FROM jsonb_to_recordset(p_productos) AS item(
      producto_id text,
      nombre_producto text,
      talla text,
      cantidad integer,
      precio_unitario bigint
    )
    GROUP BY item.producto_id
    ORDER BY item.producto_id
  LOOP
    UPDATE public.productos
    SET stock = stock - producto.cantidad
    WHERE id::text = producto.producto_id
      AND stock >= producto.cantidad;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %.', producto.producto_id;
    END IF;
  END LOOP;

  INSERT INTO public.pedidos (
    usuario_id, monto_total, estado, numero_orden, codigo_devolucion, direccion_envio
  )
  VALUES (
    auth.uid(), p_monto_total, 'pendiente', p_numero_orden, p_codigo_devolucion, p_direccion_envio
  )
  RETURNING id INTO nuevo_pedido_id;

  FOR producto IN
    SELECT *
    FROM jsonb_to_recordset(p_productos) AS item(
      producto_id text,
      nombre_producto text,
      talla text,
      cantidad integer,
      precio_unitario bigint
    )
  LOOP
    FOR unidad IN 1..producto.cantidad LOOP
      INSERT INTO public.pedido_productos (
        pedido_id, producto_id, nombre_producto, talla, codigo_producto, precio_unitario, stock_descontado
      )
      VALUES (
        nuevo_pedido_id,
        producto.producto_id,
        producto.nombre_producto,
        producto.talla,
        'ART-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        producto.precio_unitario,
        true
      );
    END LOOP;
  END LOOP;

  RETURN nuevo_pedido_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_pedido_con_detalles(text, text, bigint, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_pedido_con_detalles(text, text, bigint, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_estado_articulo(
  p_articulo_id uuid,
  p_estado text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  articulo public.pedido_productos%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede actualizar el estado del artículo.';
  END IF;
  IF p_estado NOT IN ('pendiente', 'en preparación', 'enviado', 'entregado', 'cancelado') THEN
    RAISE EXCEPTION 'El estado del artículo no es válido.';
  END IF;

  SELECT *
  INTO articulo
  FROM public.pedido_productos
  WHERE id = p_articulo_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el artículo del pedido.';
  END IF;
  IF articulo.estado = p_estado THEN
    RETURN;
  END IF;

  IF p_estado = 'cancelado' AND articulo.stock_descontado THEN
    UPDATE public.productos
    SET stock = stock + 1
    WHERE id::text = articulo.producto_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró el producto asociado al artículo.';
    END IF;
    UPDATE public.pedido_productos
    SET stock_descontado = false
    WHERE id = p_articulo_id;
  ELSIF articulo.estado = 'cancelado' AND NOT articulo.stock_descontado THEN
    UPDATE public.productos
    SET stock = stock - 1
    WHERE id::text = articulo.producto_id
      AND stock > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No hay stock disponible para reactivar este artículo.';
    END IF;
    UPDATE public.pedido_productos
    SET stock_descontado = true
    WHERE id = p_articulo_id;
  END IF;

  UPDATE public.pedido_productos
  SET estado = p_estado
  WHERE id = p_articulo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_estado_articulo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_articulo(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestionar_devolucion(
  p_devolucion_id uuid,
  p_estado text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  devolucion public.devoluciones%ROWTYPE;
  producto_id public.productos.id%TYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede gestionar devoluciones.';
  END IF;
  IF p_estado NOT IN ('aprobado', 'rechazado') THEN
    RAISE EXCEPTION 'El estado de devolución no es válido.';
  END IF;

  SELECT *
  INTO devolucion
  FROM public.devoluciones
  WHERE id = p_devolucion_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la devolución.';
  END IF;
  IF devolucion.estado NOT IN ('pendiente', 'en revisión') THEN
    RAISE EXCEPTION 'La devolución ya fue resuelta.';
  END IF;

  IF p_estado = 'aprobado' THEN
    SELECT variante.producto_id
    INTO producto_id
    FROM public.variantes_producto AS variante
    WHERE variante.id = devolucion.variante_producto_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró el producto asociado a la devolución.';
    END IF;

    UPDATE public.productos
    SET stock = stock + 1
    WHERE id = producto_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se pudo reponer el stock del producto devuelto.';
    END IF;
  END IF;

  UPDATE public.devoluciones
  SET estado = p_estado
  WHERE id = p_devolucion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gestionar_devolucion(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestionar_devolucion(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

NOTIFY pgrst, 'reload schema';
