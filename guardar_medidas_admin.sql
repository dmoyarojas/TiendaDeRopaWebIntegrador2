-- Ejecutar una vez en Supabase SQL Editor, con el propietario de la base.
-- Guarda la variante y sus medidas en una sola transacción, comprobando el rol
-- del usuario autenticado. La función usa SECURITY DEFINER para no depender de
-- las políticas RLS de UPDATE que bloquean el editor actual.

BEGIN;

CREATE OR REPLACE FUNCTION public.guardar_talla_y_medidas_admin(
  p_producto_id uuid,
  p_variante_id uuid,
  p_talla text,
  p_nombre_color text,
  p_color_hex text,
  p_precio numeric,
  p_stock integer,
  p_ancho_pecho_cm numeric,
  p_ancho_cintura_cm numeric,
  p_ancho_cadera_cm numeric,
  p_ancho_hombros_cm numeric,
  p_largo_total_cm numeric,
  p_porcentaje_elasticidad numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede guardar tallas y medidas.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id) THEN
    RAISE EXCEPTION 'El producto no existe.' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(p_talla), '') IS NULL OR nullif(trim(p_nombre_color), '') IS NULL
     OR nullif(trim(p_color_hex), '') IS NULL OR p_precio IS NULL OR p_precio < 0
     OR p_stock IS NULL OR p_stock < 0 THEN
    RAISE EXCEPTION 'Talla, color, precio o stock inválidos.' USING ERRCODE = '22023';
  END IF;
  IF (p_ancho_pecho_cm IS NULL OR p_ancho_pecho_cm <= 0)
     AND (p_ancho_cintura_cm IS NULL OR p_ancho_cintura_cm <= 0)
     AND (p_ancho_cadera_cm IS NULL OR p_ancho_cadera_cm <= 0)
     AND (p_ancho_hombros_cm IS NULL OR p_ancho_hombros_cm <= 0) THEN
    RAISE EXCEPTION 'Ingresa al menos un ancho de prenda mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF (p_ancho_pecho_cm IS NOT NULL AND p_ancho_pecho_cm < 0)
     OR (p_ancho_cintura_cm IS NOT NULL AND p_ancho_cintura_cm < 0)
     OR (p_ancho_cadera_cm IS NOT NULL AND p_ancho_cadera_cm < 0)
     OR (p_ancho_hombros_cm IS NOT NULL AND p_ancho_hombros_cm < 0)
     OR (p_largo_total_cm IS NOT NULL AND p_largo_total_cm < 0)
     OR p_porcentaje_elasticidad IS NULL OR p_porcentaje_elasticidad < 0
     OR p_porcentaje_elasticidad > 100 THEN
    RAISE EXCEPTION 'Las medidas deben estar dentro de un rango válido.' USING ERRCODE = '22023';
  END IF;

  IF p_variante_id IS NULL THEN
    INSERT INTO public.variantes_producto (
      producto_id, sku, talla, nombre_color, color_hex, precio, stock, esta_activo
    ) VALUES (
      p_producto_id, 'VEL-' || substr(pg_catalog.gen_random_uuid()::text, 1, 18),
      upper(trim(p_talla)), trim(p_nombre_color), p_color_hex, p_precio, p_stock, true
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.variantes_producto
    SET talla = upper(trim(p_talla)), nombre_color = trim(p_nombre_color),
        color_hex = p_color_hex, precio = p_precio, stock = p_stock
    WHERE id = p_variante_id AND producto_id = p_producto_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'La talla no pertenece a este producto.' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.especificaciones_prenda (
    variante_producto_id, ancho_pecho_cm, ancho_cintura_cm, ancho_cadera_cm,
    ancho_hombros_cm, largo_total_cm, porcentaje_elasticidad
  ) VALUES (
    v_id, p_ancho_pecho_cm, p_ancho_cintura_cm, p_ancho_cadera_cm,
    p_ancho_hombros_cm, p_largo_total_cm, p_porcentaje_elasticidad
  ) ON CONFLICT (variante_producto_id) DO UPDATE SET
    ancho_pecho_cm = EXCLUDED.ancho_pecho_cm,
    ancho_cintura_cm = EXCLUDED.ancho_cintura_cm,
    ancho_cadera_cm = EXCLUDED.ancho_cadera_cm,
    ancho_hombros_cm = EXCLUDED.ancho_hombros_cm,
    largo_total_cm = EXCLUDED.largo_total_cm,
    porcentaje_elasticidad = EXCLUDED.porcentaje_elasticidad;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_talla_y_medidas_admin(
  uuid, uuid, text, text, text, numeric, integer,
  numeric, numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_talla_y_medidas_admin(
  uuid, uuid, text, text, text, numeric, integer,
  numeric, numeric, numeric, numeric, numeric, numeric
) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
