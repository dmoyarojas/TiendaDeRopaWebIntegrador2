-- Ejecutar una vez en Supabase > SQL Editor.
-- Completa tallas S, M, L y XL de productos activos con medidas de referencia.
-- No modifica especificaciones existentes. Las variantes nuevas quedan con stock 0.
-- Las medidas son promedios orientativos, no mediciones de prendas reales.

BEGIN;

DO $$
DECLARE
  v_product record;
  v_size text;
  v_kind text;
  v_variant_ids uuid[];
  v_variant_id uuid;
  v_chest numeric;
  v_waist numeric;
  v_hips numeric;
  v_shoulders numeric;
  v_length numeric;
  v_inseam numeric;
  v_variants_created integer := 0;
  v_specs_created integer := 0;
  v_rows integer;
BEGIN
  FOR v_product IN
    SELECT p.id, p.nombre, p.precio_base, coalesce(c.nombre, '') AS categoria
    FROM public.productos p
    LEFT JOIN public.categorias c ON c.id = p.categoria_id
    WHERE p.activo IS TRUE
  LOOP
    v_kind := CASE
      WHEN v_product.nombre ~* '(jean|pantal|falda|short)'
        OR v_product.categoria ~* '(pantal|falda|short)' THEN 'pants'
      WHEN v_product.nombre ~* '(abrigo|coat)'
        OR v_product.categoria ~* 'abrigo' THEN 'coat'
      WHEN v_product.nombre ~* '(polo|camisa)' THEN 'top'
      WHEN v_product.nombre ~* 'blazer'
        OR v_product.categoria ~* 'blazer' THEN 'blazer'
      ELSE 'top'
    END;

    FOREACH v_size IN ARRAY ARRAY['S', 'M', 'L', 'XL'] LOOP
      SELECT array_agg(v.id)
      INTO v_variant_ids
      FROM public.variantes_producto v
      WHERE v.producto_id = v_product.id
        AND upper(v.talla) = v_size;

      IF coalesce(cardinality(v_variant_ids), 0) = 0 THEN
        INSERT INTO public.variantes_producto (
          producto_id, sku, talla, nombre_color, color_hex, precio, stock, esta_activo
        ) VALUES (
          v_product.id,
          'VEL-REF-' || replace(gen_random_uuid()::text, '-', ''),
          v_size, 'Referencia', '#777777', v_product.precio_base, 0, true
        )
        RETURNING id INTO v_variant_id;

        v_variant_ids := ARRAY[v_variant_id];
        v_variants_created := v_variants_created + 1;
      END IF;

      CASE v_kind
        WHEN 'pants' THEN
          v_chest := NULL;
          v_shoulders := NULL;
          v_waist := CASE v_size WHEN 'S' THEN 37 WHEN 'M' THEN 40 WHEN 'L' THEN 43 ELSE 46 END;
          v_hips := CASE v_size WHEN 'S' THEN 49 WHEN 'M' THEN 52 WHEN 'L' THEN 55 ELSE 58 END;
          v_length := CASE v_size WHEN 'S' THEN 100 WHEN 'M' THEN 102 WHEN 'L' THEN 104 ELSE 106 END;
          v_inseam := CASE v_size WHEN 'S' THEN 26 WHEN 'M' THEN 27 WHEN 'L' THEN 28 ELSE 29 END;
        WHEN 'blazer' THEN
          v_chest := CASE v_size WHEN 'S' THEN 54 WHEN 'M' THEN 57 WHEN 'L' THEN 60 ELSE 63 END;
          v_waist := CASE v_size WHEN 'S' THEN 51 WHEN 'M' THEN 54 WHEN 'L' THEN 57 ELSE 60 END;
          v_hips := NULL;
          v_shoulders := CASE v_size WHEN 'S' THEN 44 WHEN 'M' THEN 46 WHEN 'L' THEN 48 ELSE 50 END;
          v_length := CASE v_size WHEN 'S' THEN 70 WHEN 'M' THEN 72 WHEN 'L' THEN 74 ELSE 76 END;
          v_inseam := NULL;
        WHEN 'coat' THEN
          v_chest := CASE v_size WHEN 'S' THEN 56 WHEN 'M' THEN 59 WHEN 'L' THEN 62 ELSE 65 END;
          v_waist := CASE v_size WHEN 'S' THEN 54 WHEN 'M' THEN 57 WHEN 'L' THEN 60 ELSE 63 END;
          v_hips := NULL;
          v_shoulders := CASE v_size WHEN 'S' THEN 45 WHEN 'M' THEN 47 WHEN 'L' THEN 49 ELSE 51 END;
          v_length := CASE v_size WHEN 'S' THEN 85 WHEN 'M' THEN 87 WHEN 'L' THEN 89 ELSE 91 END;
          v_inseam := NULL;
        ELSE
          v_chest := CASE v_size WHEN 'S' THEN 50 WHEN 'M' THEN 53 WHEN 'L' THEN 56 ELSE 59 END;
          v_waist := CASE v_size WHEN 'S' THEN 48 WHEN 'M' THEN 51 WHEN 'L' THEN 54 ELSE 57 END;
          v_hips := NULL;
          v_shoulders := CASE v_size WHEN 'S' THEN 43 WHEN 'M' THEN 45 WHEN 'L' THEN 47 ELSE 49 END;
          v_length := CASE v_size WHEN 'S' THEN 68 WHEN 'M' THEN 70 WHEN 'L' THEN 72 ELSE 74 END;
          v_inseam := NULL;
      END CASE;

      FOREACH v_variant_id IN ARRAY v_variant_ids LOOP
        INSERT INTO public.especificaciones_prenda (
          variante_producto_id, ancho_pecho_cm, ancho_cintura_cm, ancho_cadera_cm,
          ancho_hombros_cm, largo_total_cm, largo_tiro_cm,
          porcentaje_elasticidad, tipo_corte
        ) VALUES (
          v_variant_id, v_chest, v_waist, v_hips,
          v_shoulders, v_length, v_inseam, 0, 'regular'
        )
        ON CONFLICT (variante_producto_id) DO NOTHING;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_specs_created := v_specs_created + v_rows;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Variantes creadas: %. Medidas de referencia agregadas: %.',
    v_variants_created, v_specs_created;
END;
$$;

COMMIT;
