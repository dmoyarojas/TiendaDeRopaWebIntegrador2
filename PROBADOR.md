# Probador virtual

La integración del cuerpo personalizado de Clad se activa siguiendo [CLAD.md](CLAD.md).

## Preparación

1. Ejecuta `configuracion_probador.sql` en Supabase SQL Editor. Da a cada usuario acceso a sus propias medidas y permite al administrador registrar tallas y especificaciones.
2. Ejecuta `guardar_medidas_admin.sql` en Supabase SQL Editor. Instala el guardado transaccional que usa el editor de tallas; comprueba el rol de administrador en la base de datos.
3. En Administración → Productos, abre **Tallas y medidas** en cada producto. Registra al menos una variante con un ancho relevante. Los anchos de pecho, cintura y cadera se miden con la prenda extendida en plano; el probador los multiplica por dos para compararlos con los contornos del cuerpo. Hombros se registra como ancho directo.
4. En **Mi Avatar**, el cliente ingresa sus medidas. Si inició sesión, se guardan en `medidas_usuario`; sin sesión quedan solo en la sesión del navegador.
5. En **Probador virtual**, elige producto y talla para ver el ajuste estimado por zona y girar el avatar 3D.

## Medidas de referencia cargadas

El catálogo de Supabase tiene tallas S, M, L y XL con medidas promedio de demostración para los seis productos que existían el 26 de octubre de 2026. Las cifras están en `src/data/medidasReferencia.json`. Pecho, cintura y cadera son anchos de la prenda extendida en plano; hombros y largo se miden una vez. El probador señala cuando las medidas coinciden con estas referencias. No son medidas tomadas de las prendas reales.

Las variantes creadas para completar tallas tienen **stock 0**. La variante M existente de la camisa de prueba conservó su stock, precio y color. El script `scripts/cargar_medidas_referencia.mjs` es idempotente: solo agrega variantes o medidas faltantes y nunca reemplaza medidas guardadas. Para volver a usarlo, ejecuta `node --env-file=.env.seed.local scripts/cargar_medidas_referencia.mjs` con una clave secreta de Supabase disponible solo en el entorno local.

Cuando tengas la tabla real de cada prenda, actualiza sus dimensiones desde Administración → Productos → Tallas y medidas. Al diferir de los promedios, el aviso de referencia desaparecerá de esa talla.

## Alcance de la estimación

El cálculo compara holgura entre contornos corporales y dimensiones de la prenda. Los rangos de holgura del prototipo están en `src/lib/fitting.ts`; deben calibrarse con prendas físicas de cada corte y tejido antes de presentarlos como predicción confiable. El peso y el largo de prenda se guardan o muestran, pero no intervienen en la recomendación de talla porque faltan parámetros equivalentes y propiedades completas del tejido.

El visor muestra exclusivamente el cuerpo generado por Clad, conservando sus dimensiones en metros. El perfil y el probador muestran las diferencias entre sus seis medidas y las solicitadas; las diferencias mayores de 1 cm se señalan para revisión. Coincidir en contornos no garantiza toda la forma del cuerpo. El visor no realiza simulación física de tela ni superpone prendas sin adaptar a la malla corporal.
