-- 1. Agregar campo 'etiqueta' a la tabla productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS etiqueta text;

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

CREATE POLICY "Permitir lectura de devoluciones a todos" ON public.devoluciones FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de productos a todos" ON public.productos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de pedidos a todos" ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de perfiles a todos" ON public.perfiles FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de categorias a todos" ON public.categorias FOR SELECT USING (true);
