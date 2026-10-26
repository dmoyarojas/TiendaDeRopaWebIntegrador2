-- Ejecutar en Supabase > SQL Editor con un rol administrador.
-- Crea 20 pedidos de prueba para 20 perfiles de clientes existentes.
-- No crea usuarios de Auth ni modifica pedidos existentes. Es repetible.
-- Si no hay variantes de producto, crea una categoría, producto y variante de prueba.
-- Los importes se guardan en la misma escala que usa el dashboard (precio / 1000).

BEGIN;

DO $$
DECLARE
  total_clientes integer;
BEGIN
  SELECT count(*) INTO total_clientes
  FROM public.perfiles
  WHERE rol = 'client';

  IF total_clientes < 20 THEN
    RAISE EXCEPTION 'Se necesitan 20 perfiles con rol client; solo hay %.', total_clientes;
  END IF;
END $$;

-- Los pedidos históricos pueden referenciar variantes que hoy estén sin stock.
-- Solo creamos catálogo de prueba cuando no hay ninguna variante registrada.
DO $$
DECLARE
  categoria_demo_id integer;
  producto_demo_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.variantes_producto) THEN
    INSERT INTO public.categorias (nombre, slug, tipo_ranura)
    VALUES ('Pruebas VELOUR', 'velour-pruebas', 'superior')
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO categoria_demo_id
    FROM public.categorias
    WHERE slug = 'velour-pruebas';

    INSERT INTO public.productos
      (categoria_id, nombre, slug, descripcion, genero, precio_base, esta_activo, etiqueta)
    VALUES
      (categoria_demo_id, 'Camisa de prueba VELOUR', 'camisa-prueba-velour',
       'Producto de prueba para pedidos del dashboard', 'unisex', 159000, true, 'Demo')
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO producto_demo_id
    FROM public.productos
    WHERE slug = 'camisa-prueba-velour';

    INSERT INTO public.variantes_producto
      (producto_id, sku, talla, nombre_color, color_hex, precio, stock, esta_activo)
    VALUES
      (producto_demo_id, 'VEL-PRUEBA-001', 'M', 'Negro', '#0D0D0D', 159000, 100, true)
    ON CONFLICT (sku) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.variantes_producto) THEN
    RAISE EXCEPTION 'No se pudo crear una variante de prueba; revisa el catálogo.';
  END IF;
END $$;

CREATE TEMP TABLE velour_seed_pedidos ON COMMIT DROP AS
WITH clientes AS (
  SELECT id AS usuario_id,
         row_number() OVER (ORDER BY creado_el NULLS LAST, id) AS numero
  FROM public.perfiles
  WHERE rol = 'client'
  ORDER BY creado_el NULLS LAST, id
  LIMIT 20
)
SELECT
  md5('velour-pedido-demo-v1:' || c.usuario_id::text)::uuid AS pedido_id,
  md5('velour-articulo-demo-v1:' || c.usuario_id::text)::uuid AS articulo_id,
  c.usuario_id,
  v.id AS variante_producto_id,
  v.precio AS precio_unitario,
  1 + ((c.numero - 1) % 3)::integer AS cantidad,
  CASE (c.numero - 1) % 4
    WHEN 0 THEN 'pendiente'
    WHEN 1 THEN 'pagado'
    WHEN 2 THEN 'enviado'
    ELSE 'completado'
  END AS estado,
  date_trunc('month', now())
    - ((20 - c.numero) / 2)::integer * interval '1 month'
    + (4 + ((c.numero - 1) % 2) * 12) * interval '1 day' AS creado_el
FROM clientes c
CROSS JOIN LATERAL (
  SELECT id, precio
  FROM public.variantes_producto
  ORDER BY (esta_activo IS TRUE AND stock > 0) DESC,
           md5(c.usuario_id::text || id::text)
  LIMIT 1
) v;

INSERT INTO public.pedidos
  (id, usuario_id, monto_total, estado, direccion_envio, creado_el)
SELECT pedido_id,
       usuario_id,
       precio_unitario * cantidad,
       estado,
       '[DEMO] Dirección de prueba, Lima, Perú',
       creado_el
FROM velour_seed_pedidos
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.articulos_pedido
  (id, pedido_id, variante_producto_id, cantidad, precio_unitario)
SELECT articulo_id, pedido_id, variante_producto_id, cantidad, precio_unitario
FROM velour_seed_pedidos
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Comprobación: debe devolver 20 pedidos y 20 usuarios distintos.
SELECT count(*) AS pedidos_demo,
       count(DISTINCT usuario_id) AS usuarios_distintos,
       sum(monto_total) / 1000 AS total_dashboard_pen
FROM public.pedidos
WHERE direccion_envio = '[DEMO] Dirección de prueba, Lima, Perú'
  AND id IN (
    SELECT md5('velour-pedido-demo-v1:' || id::text)::uuid
    FROM public.perfiles
  );
