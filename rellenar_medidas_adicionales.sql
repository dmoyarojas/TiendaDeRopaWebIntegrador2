-- Completa medidas complementarias de referencia para variantes activas.
-- Son estimaciones por tipo de prenda y talla, no mediciones reales.
-- Solo rellena campos vacíos; conserva los valores guardados manualmente.
-- Ejecutar después de guardar_medidas_admin.sql.

BEGIN;

ALTER TABLE public.especificaciones_prenda
  ADD COLUMN IF NOT EXISTS largo_manga_cm numeric,
  ADD COLUMN IF NOT EXISTS ancho_brazo_cm numeric,
  ADD COLUMN IF NOT EXISTS ancho_puno_cm numeric,
  ADD COLUMN IF NOT EXISTS ancho_muslo_cm numeric,
  ADD COLUMN IF NOT EXISTS ancho_rodilla_cm numeric,
  ADD COLUMN IF NOT EXISTS ancho_bajo_cm numeric,
  ADD COLUMN IF NOT EXISTS ancho_bajo_pierna_cm numeric;

WITH categorized AS (
  SELECT
    v.id AS variante_producto_id,
    lower(coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) AS texto_prenda,
    upper(v.talla) AS talla,
    CASE
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* '(conjunto|enterizo|jumpsuit|overall|set)' THEN 'set'
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* '(vestid|dress)' THEN 'dress'
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* '(falda|skirt)' THEN 'skirt'
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* '(short|bermuda)' THEN 'shorts'
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* '(jean|pantal|trouser)' THEN 'pants'
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* '(abrigo|coat|chaqueta|jacket|trench|gabardina)' THEN 'coat'
      WHEN (coalesce(p.nombre, '') || ' ' || coalesce(c.nombre, '')) ~* 'blazer' THEN 'blazer'
      ELSE 'top'
    END AS tipo,
    CASE upper(v.talla)
      WHEN 'XS' THEN -1
      WHEN 'S' THEN 0
      WHEN 'M' THEN 1
      WHEN 'L' THEN 2
      WHEN 'XL' THEN 3
      WHEN 'XXL' THEN 4
      WHEN 'XXXL' THEN 5
      ELSE 1
    END AS incremento_talla
  FROM public.variantes_producto v
  JOIN public.productos p ON p.id = v.producto_id
  LEFT JOIN public.categorias c ON c.id = p.categoria_id
  WHERE p.activo IS TRUE AND v.esta_activo IS TRUE
), estimated AS (
  SELECT
    variante_producto_id,
    CASE
      WHEN tipo NOT IN ('top', 'blazer', 'coat', 'dress', 'set') THEN NULL
      WHEN texto_prenda ~* '(sin mangas?|sleeveless|tirantes|strapless)' THEN NULL
      WHEN texto_prenda ~* '(manga corta|short sleeve|polo|camiseta|t-shirt|tee)' THEN 23 + incremento_talla
      WHEN tipo = 'coat' THEN 62 + incremento_talla
      WHEN tipo = 'blazer' THEN 60 + incremento_talla
      ELSE 58 + incremento_talla
    END AS largo_manga_cm,
    CASE
      WHEN tipo NOT IN ('top', 'blazer', 'coat', 'dress', 'set')
        OR texto_prenda ~* '(sin mangas?|sleeveless|tirantes|strapless)' THEN NULL
      WHEN tipo = 'coat' THEN 23 + incremento_talla
      WHEN tipo = 'blazer' THEN 21 + incremento_talla
      WHEN tipo = 'dress' THEN 20 + incremento_talla
      ELSE 19 + incremento_talla
    END AS ancho_brazo_cm,
    CASE
      WHEN tipo NOT IN ('top', 'blazer', 'coat', 'dress', 'set')
        OR texto_prenda ~* '(sin mangas?|sleeveless|tirantes|strapless)' THEN NULL
      WHEN texto_prenda ~* '(manga corta|short sleeve|polo|camiseta|t-shirt|tee)' THEN 16 + incremento_talla
      WHEN tipo = 'coat' THEN 15 + incremento_talla * 0.5
      WHEN tipo = 'blazer' THEN 13 + incremento_talla * 0.5
      ELSE 10 + incremento_talla * 0.5
    END AS ancho_puno_cm,
    CASE
      WHEN tipo IN ('pants', 'shorts', 'set') THEN 29 + incremento_talla * 1.5
      ELSE NULL
    END AS ancho_muslo_cm,
    CASE
      WHEN tipo IN ('pants', 'set') THEN 21 + incremento_talla * 1.5
      ELSE NULL
    END AS ancho_rodilla_cm,
    CASE
      WHEN tipo = 'top' THEN 50 + incremento_talla * 3
      WHEN tipo = 'blazer' THEN 54 + incremento_talla * 3
      WHEN tipo = 'coat' THEN 58 + incremento_talla * 3
      WHEN tipo = 'dress' THEN 65 + incremento_talla * 4
      WHEN tipo = 'skirt' THEN 65 + incremento_talla * 5
      WHEN tipo = 'set' THEN 50 + incremento_talla * 3
      ELSE NULL
    END AS ancho_bajo_cm,
    CASE
      WHEN tipo IN ('pants', 'set') THEN 18 + incremento_talla
      WHEN tipo = 'shorts' THEN 23 + incremento_talla
      ELSE NULL
    END AS ancho_bajo_pierna_cm
  FROM categorized
)
INSERT INTO public.especificaciones_prenda (
  variante_producto_id,
  largo_manga_cm,
  ancho_brazo_cm,
  ancho_puno_cm,
  ancho_muslo_cm,
  ancho_rodilla_cm,
  ancho_bajo_cm,
  ancho_bajo_pierna_cm
)
SELECT
  variante_producto_id,
  largo_manga_cm,
  ancho_brazo_cm,
  ancho_puno_cm,
  ancho_muslo_cm,
  ancho_rodilla_cm,
  ancho_bajo_cm,
  ancho_bajo_pierna_cm
FROM estimated
ON CONFLICT (variante_producto_id) DO UPDATE SET
  largo_manga_cm = coalesce(especificaciones_prenda.largo_manga_cm, EXCLUDED.largo_manga_cm),
  ancho_brazo_cm = coalesce(especificaciones_prenda.ancho_brazo_cm, EXCLUDED.ancho_brazo_cm),
  ancho_puno_cm = coalesce(especificaciones_prenda.ancho_puno_cm, EXCLUDED.ancho_puno_cm),
  ancho_muslo_cm = coalesce(especificaciones_prenda.ancho_muslo_cm, EXCLUDED.ancho_muslo_cm),
  ancho_rodilla_cm = coalesce(especificaciones_prenda.ancho_rodilla_cm, EXCLUDED.ancho_rodilla_cm),
  ancho_bajo_cm = coalesce(especificaciones_prenda.ancho_bajo_cm, EXCLUDED.ancho_bajo_cm),
  ancho_bajo_pierna_cm = coalesce(especificaciones_prenda.ancho_bajo_pierna_cm, EXCLUDED.ancho_bajo_pierna_cm);

COMMIT;
NOTIFY pgrst, 'reload schema';
