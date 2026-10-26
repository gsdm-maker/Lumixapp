# Pruebas de punta a punta (Playwright)

Recorren los flujos principales con los usuarios de prueba (`*.prueba@example.com`): login, rutas
protegidas, navegación, Actividades, Minuta, Compromisos, chat con IA, eliminar y cerrar sesión.

La única prueba que escribe datos crea una actividad «E2E <hora>» desde el chat y la elimina al
final. Igual conviene correrlas contra una empresa de prueba.

## Requisitos

- Python con Playwright: `pip install playwright` y `playwright install chromium`.
- La base de Supabase activa (si está pausada, el login no responde).

## Cómo correrlas

En una terminal, la app en un puerto propio (para no chocar con otros proyectos en el 5173):

```bash
npm run dev -- --port 5180 --strictPort
```

En otra:

```bash
E2E_CLAVE='<clave de los usuarios de prueba>' python e2e/suite.py
```

En PowerShell: `$env:E2E_CLAVE='<clave>'; python e2e/suite.py`.

Variables opcionales:

| Variable                                | Para qué                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `E2E_BASE`                              | Otra dirección de la app (por defecto `http://localhost:5180`).                          |
| `E2E_SUPABASE_HOST` + `E2E_SUPABASE_IP` | Si el DNS local aún dice que el proyecto no existe (pasa al reactivar una base pausada). |

El resultado sale en la consola (`PASA` / `FALLA`) y las capturas quedan en `e2e/resultados/`
(ignorada por git). La clave nunca va en el código.

## Estado

Última corrida completa: ver la salida de `python e2e/suite.py`.
