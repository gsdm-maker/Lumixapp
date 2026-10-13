# Revisión de seguridad de Lumixapp (OWASP WSTG)

9 de octubre de 2026 · Revisión defensiva, solo de lectura

## Resumen

La revisión encontró 11 hallazgos: 2 altos, 4 medios y 5 bajos. Ninguno expone los datos de una empresa a otra, pero conviene arreglar los dos altos antes de publicar.

Orden recomendado:

1. Quitar a los visitantes sin sesión el permiso de ejecutar funciones de la base (H1) y corregir la verificación de dueño en "deshacer actividad" (H2).
2. Actualizar la política de seguridad de contenido (CSP) al proyecto nuevo (H3): sin eso, la app publicada no podrá conectarse a su base.
3. Endurecer el registro abierto: clave mínima de 8, claves filtradas, captcha y reautenticación al cambiar la clave (H4 a H6).

## Estado de los arreglos

| #        | Estado                          | Cómo                                                                                                                                                                                                                                    |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1       | Corregido (9 oct 2026)          | Migraciones 058 y 059: ninguna función se puede ejecutar sin sesión (0 de 32), y `find_user_id_by_email` busca solo dentro de la propia empresa.                                                                                        |
| H2       | Corregido (9 oct 2026)          | Migración 058: `deshacer_actividad` exige sesión y compara con `IS DISTINCT FROM`.                                                                                                                                                      |
| H3       | Corregido (9 oct 2026)          | `netlify.toml`: la CSP apunta a `wartulamjzlxmlubmbrn` y `script-src` quedó solo en `'self'`.                                                                                                                                           |
| H4       | Corregido en parte (9 oct 2026) | Supabase exige mínimo 8 caracteres; Perfil, registro y cambio obligatorio también. La protección de claves filtradas de Supabase es del plan Pro: la app revisa la clave contra Have I Been Pwned (k-anonimato) al crearla o cambiarla. |
| H5       | Listo para encender             | Captcha Cloudflare Turnstile en el ingreso y el registro (`VITE_TURNSTILE_SITE_KEY`). Falta crear las claves en Cloudflare y activarlo en Supabase.                                                                                     |
| H6       | Corregido (9 oct 2026)          | Supabase exige sesión reciente para cambiar la clave; Perfil pide la clave actual y vuelve a ingresar antes de cambiarla.                                                                                                               |
| H7 a H11 | Pendientes                      | —                                                                                                                                                                                                                                       |

Comprobado en vivo: sin sesión, las funciones responden "permiso denegado"; con sesión, el registro, la Bienvenida, la búsqueda por correo y la lectura de datos siguen funcionando.

## Actualización (12 oct 2026)

Se retomó el trabajo donde quedó. La migración 060 (posterior a este informe) ya había creado la infraestructura del tope de IA y el arreglo de borrado, pero H9 quedó sin conectar.

| #   | Estado                  | Cómo                                                                                                                                                                                              |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H4  | Completo                | `supabase/config.toml` pasó a `minimum_password_length = 8` (alineado con la app y el proyecto hosted).                                                                                           |
| H7  | Corregido (12 oct 2026) | `react-router-dom` 7.18.0 → 7.18.4 y `npm audit fix`: `npm audit` queda en 0 vulnerabilidades (antes 9: 7 altas, 1 media, 1 baja).                                                                |
| H9  | Corregido (12 oct 2026) | `_shared/auth.ts` suma `dentroDelTopeIa()` (RPC `registrar_uso_ia`). Las 5 funciones de IA (`ai-classify`, `ai-ask`, `ai-update`, `ai-bulk`, `ai-agente`) cortan con 429 al pasar el tope diario. |
| H11 | Corregido (12 oct 2026) | Migración 060: `teams.created_by` con `ON DELETE SET NULL`.                                                                                                                                       |
| H5  | Pendiente (operación)   | Código del captcha listo; falta crear claves de Cloudflare Turnstile y activarlo en Supabase.                                                                                                     |
| H8  | Pendiente (operación)   | Código listo (`ALLOWED_ORIGIN` en `cors.ts`); falta setear el secreto.                                                                                                                            |
| H10 | Aceptable               | Sin cambios.                                                                                                                                                                                      |

Desplegado (13 oct 2026): se verificó que la migración 060 ya está aplicada en el proyecto hosted (tabla `uso_ia` y RPC `registrar_uso_ia` presentes) y se redesplegaron las 5 Edge Functions de IA (`ai-classify` v6, `ai-ask` v8, `ai-update` v6, `ai-bulk` v6, `ai-agente` v4), así que el tope diario ya se aplica. Falta solo la operación de H5 y H8.

### Endurecimiento adicional (13 oct 2026)

No estaba en el informe original. Verificado contra la base: de 28 funciones `SECURITY DEFINER` en `public`, **27 fijan `SET search_path`; solo `handle_new_user()` no lo hacía** (heredaba el del llamador). Riesgo bajo, pero es la práctica recomendada. Se agrega la migración `061_hardening_search_path.sql`, que ejecuta `ALTER FUNCTION public.handle_new_user() SET search_path = public;` (idempotente). **Aplicada al hosted (13 oct 2026) por la Management API.** Verificado después: las 28 funciones `SECURITY DEFINER` de `public` fijan `search_path`.

> Nota operativa (reconciliada el 13 oct 2026): el historial del hosted usaba versiones por timestamp (`20261009…`) mientras los archivos locales son `001…061`, así que `supabase db push` habría reaplicado las 61 migraciones. Se renumeró el remoto a `001…061` (según el `name` de cada fila) y se registró la `061` (aplicada). La `055` se dejó **fuera a propósito**: se había reversado (no se siguió esa jerarquía), y se quitó su archivo local para que `db push` no la reaplique. `supabase migration list` muestra **60/60 sin desalineadas**, así que `db push` vuelve a ser seguro para migraciones nuevas.

## Hallazgos

| #   | WSTG                | Severidad | Qué pasa                                                                                                                                                                                                                                                             | Arreglo propuesto                                                                                          |
| --- | ------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| H1  | IDNT-04, ATHZ-02    | Alta      | Los visitantes sin sesión pueden ejecutar todas las funciones de la base: las migraciones quitaban el permiso a "todos" (`PUBLIC`), pero Supabase da permiso directo al rol `anon`. Con `find_user_id_by_email` cualquiera puede saber si un correo está registrado. | Quitar `EXECUTE` al rol `anon` en todas las funciones y acotar la búsqueda por correo a la propia empresa. |
| H2  | ATHZ-02, BUSL-03    | Alta      | `deshacer_actividad` compara el creador con el usuario usando `<>`; sin sesión la comparación queda en `NULL` y no frena. Basta conocer el identificador de una actividad recién creada para borrarla.                                                               | Usar `IS DISTINCT FROM` y exigir sesión (se resuelve también con H1).                                      |
| H3  | CONF-12             | Media     | La CSP de `netlify.toml` apunta al proyecto antiguo (`dviowymbowuhbwqcaaye`). Publicada así, la app no podrá conectarse a la base de Lumixapp.                                                                                                                       | Cambiar los dominios a `wartulamjzlxmlubmbrn` y quitar el dominio de Supabase de `script-src`.             |
| H4  | ATHN-07             | Media     | El servidor acepta claves de 6 caracteres (Perfil también), aunque el registro pide 8, y no revisa claves filtradas.                                                                                                                                                 | Subir el mínimo a 8 en Supabase y en Perfil, y activar la protección de claves filtradas.                  |
| H5  | BUSL-05, ATHN-03    | Media     | El registro abierto no tiene captcha ni límite por persona: se pueden crear cuentas sin fin y abrir una prueba de 15 días nueva con cada correo.                                                                                                                     | Activar captcha (Turnstile) en el registro y limitar pruebas por dominio o por dispositivo.                |
| H6  | ATHN-09             | Media     | Cambiar la clave no pide la clave actual: quien tenga una sesión abierta ajena puede cambiarla.                                                                                                                                                                      | Activar la reautenticación al cambiar la clave y pedir la clave actual en Perfil.                          |
| H7  | CONF (dependencias) | Baja      | `npm audit` reporta 5 vulnerabilidades altas y 1 baja, casi todas del entorno de desarrollo. React Router (dependencia directa) tiene una actualización de seguridad.                                                                                                | Actualizar `react-router-dom` y correr `npm audit fix`.                                                    |
| H8  | CONF-08             | Baja      | Las funciones de IA y de administración aceptan llamadas desde cualquier origen (CORS `*`), porque no hay `ALLOWED_ORIGIN`. El token de sesión sigue siendo obligatorio.                                                                                             | Definir `ALLOWED_ORIGIN` con el dominio publicado y localhost.                                             |
| H9  | BUSL-05             | Baja      | El límite de llamadas a la IA vive en la memoria de cada instancia: no es un tope real de gasto por persona.                                                                                                                                                         | Guardar un contador diario por persona en la base y cortarlo en las funciones.                             |
| H10 | BUSL-01             | Baja      | Con la prueba vencida se bloquean la app y la IA, pero la API de datos sigue respondiendo a esas cuentas.                                                                                                                                                            | Aceptable por ahora (son sus propios datos); bloquearlo en las reglas si se vuelve un problema.            |
| H11 | IDNT-01             | Baja      | No se puede borrar la cuenta de alguien que creó unidades: `teams.created_by` no tiene regla al borrar.                                                                                                                                                              | Pasar `created_by` a `ON DELETE SET NULL`.                                                                 |

Además, como operación: el token de gestión de Supabase guardado en `credenciales\Lumixapp.md` da acceso total a los proyectos de la cuenta. Revocarlo cuando ya no se use.

## Lo que está bien

- **Aislamiento entre empresas:** todas las tablas tienen reglas por fila. Las pruebas con usuarios de prueba confirmaron que un Admin no ve ni toca otra empresa, ni por la API ni por la consola.
- **Consola de administración:** valida en el servidor quién llama, acepta solo acciones de una lista cerrada, revisa formatos, responde con errores genéricos y deja registro de cada cambio.
- **Funciones de IA:** exigen sesión válida y se cortan con la prueba vencida, sin llegar a OpenAI.
- **Sesión:** tokens de 1 hora con rotación del token de renovación; el cambio de correo exige confirmar ambos correos.
- **Navegador:** no hay inserción de HTML sin filtrar; la CSP no permite scripts en línea; hay cabeceras contra incrustar la app en otra página y contra adivinar tipos de archivo.
- **Secretos:** el `.env` no está en el repositorio; la clave service_role solo vive en las funciones; los mapas de código están apagados en producción.
- **Almacenamiento:** no hay buckets de archivos ni tablas publicadas en tiempo real.

## Alcance y método

Revisión defensiva, solo de lectura, del proyecto Lumixapp (base `wartulamjzlxmlubmbrn` y este repositorio), guiada por las categorías de la [OWASP Web Security Testing Guide](https://github.com/OWASP/wstg/).

| Se revisó                              | Cómo                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Configuración de autenticación         | Lectura de la configuración del proyecto en Supabase                              |
| Reglas por fila y funciones de la base | Consultas a los catálogos de Postgres: permisos, políticas y definiciones         |
| Funciones del servidor                 | Lectura del código de `admin-users`, las funciones de IA y las piezas compartidas |
| Cliente                                | Búsqueda de inserción de HTML, manejo de secretos y cabeceras de `netlify.toml`   |
| Dependencias                           | `npm audit` de las dependencias de producción                                     |

No se revisó el Lumix publicado (congelado), la infraestructura de Supabase y Netlify, ni pruebas de carga. Tampoco se ejecutaron ataques reales: los hallazgos salen del código y de la configuración.
