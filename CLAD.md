# Avatar corporal con Clad

La integración usa el cuestionario de Clad, ajusta el cuerpo a las medidas guardadas con `/v1/body/tune` y consulta el trabajo hasta obtener un GLB. La clave queda en una Edge Function; el navegador solo recibe una URL privada temporal del modelo de su usuario. Se requiere iniciar sesión y autorizar el envío de medidas.

## Activar en Supabase

1. Genera una clave en [Clad Developers](https://clad.you/developers). No la pongas en variables `VITE_*` ni en el código React.
2. En Supabase → SQL Editor, ejecuta `supabase/migrations/202610280001_clad_avatar.sql`. Crea la tabla privada de avatares, el depósito privado de archivos y la reserva de generación con límite de frecuencia.
3. En Supabase → Edge Functions → Secrets, agrega `CLAD_API_KEY` con tu clave de Clad.
4. Crea y despliega la función **clad-avatar** con el contenido de `supabase/functions/clad-avatar/index.ts`. Mantén activada la verificación JWT. Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las proporciona Supabase al ejecutar la función.
5. En la tienda inicia sesión, entra a **Mi Avatar**, guarda tus medidas, completa las proporciones y autoriza su envío. Pulsa **Generar avatar con Clad**. Cuando finalice el ajuste, el visor mostrará **Avatar Clad**. El mismo modelo se recupera en el probador.

Si prefieres la CLI, después de ejecutar el SQL:

```powershell
npx supabase login
# Crea supabase/functions/.env.local a partir de .env.example y añade la clave.
npx supabase secrets set --env-file supabase/functions/.env.local --project-ref kyliylilzpxiswxntcoj
npx supabase functions deploy clad-avatar --project-ref kyliylilzpxiswxntcoj
```

No es necesario poner la clave de Clad en `.env.seed.local`. La clave administrativa de datos de Supabase no permite desplegar funciones ni ejecutar migraciones SQL; usa el panel del proyecto o una sesión autenticada de la CLI.

## Comportamiento y límites

- El cuestionario acepta estaturas de 140–220 cm y pesos de 30–200 kg, según el contrato de Clad. Pecho, cintura, cadera, hombros y entrepierna se envían como objetivos de ajuste. El cálculo de talla sigue usando las medidas introducidas por el usuario.
- El modelo conserva sus dimensiones en metros. Solo se centra y se convierten los ejes de Clad (Z arriba, +Y delante) a los del visor (Y arriba, +Z delante). La cámara se ajusta a su altura; la malla no se escala.
- El GLB se almacena en `avatares-clad`, sin acceso público; se entregan enlaces de una hora que el visor renueva. El cuerpo generado solo se utiliza si coincide con las medidas guardadas actuales.
- Cambiar medidas requiere generar de nuevo. Se admite una generación por minuto y se evita iniciar otra durante cinco minutos si hay un trabajo en curso. Al volver al perfil se retoma la consulta del trabajo.
- El modelo geométrico anterior fue eliminado. Mientras Clad genera el cuerpo o descarga el GLB, se muestra el estado de carga; un fallo muestra un mensaje.
- El perfil y el probador comparan las seis medidas de la malla devueltas por Clad con los objetivos guardados. La tolerancia del proyecto es de 1 cm por medida y está definida en `src/lib/cladAccuracy.ts`. Si falta una medida o alguna excede la tolerancia, el modelo queda marcado para revisión. El resultado sigue visible para inspeccionarlo; no se considera ajustado dentro de la tolerancia. Esta comparación no comprueba por separado la geometría del GLB ni acredita un escaneo o una precisión del 100%.
- Este cambio utiliza `body_input` y `measurements`, que ya existen en `avatares_clad`, y no requiere un nuevo SQL ni desplegar de nuevo la Edge Function. Los modelos ya generados se comprueban al abrirlos.
- Con el cuerpo Clad se muestra el avatar corporal. La simulación física de ropa requiere la integración adicional de Clad para prendas y sus patrones/materiales.
- Esta versión usa cuestionario y medidas; no envía fotos. La API puede consumir cuota tanto al crear el cuerpo como al ajustarlo; consulta el plan de tu cuenta.

Contrato verificado: [Swagger de Clad](https://api.clad.you/) y [biblioteca corporal oficial](https://github.com/datar-psa/clad-body).

## Verificación local

```powershell
node scripts/test_clad_avatar.mjs
npx tsc --noEmit
npm run build
```

Las pruebas del handler usan respuestas simuladas y comprueban autenticación, consentimiento, validación, envío de objetivos de medida, aislamiento entre usuarios, guardado del GLB y recuperación tras un fallo de red. La generación real requiere clave, migración y despliegue.
