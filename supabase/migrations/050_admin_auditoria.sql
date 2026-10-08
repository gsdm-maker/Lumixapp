-- Migration 050: registro de auditoria de la consola de administracion.
--
-- Cada accion de la consola (crear persona, clave temporal, desactivar, cambiar rol, sumar o
-- quitar de un equipo, crear o renombrar equipo) deja una fila: quien, que, sobre quien y
-- cuando. Nunca se guardan claves.
--
-- Solo la Edge Function admin-users escribe y lee esta tabla (con la service role, que salta
-- RLS). RLS activada y SIN politicas: desde el navegador nadie puede leerla, escribirla ni
-- borrarla, ni siquiera el admin con su sesion. Asi el registro no se puede maquillar desde la
-- app.

CREATE TABLE IF NOT EXISTS public.admin_auditoria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid NOT NULL,
  accion      text NOT NULL,
  objetivo_id uuid,
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_auditoria_created_at_idx
  ON public.admin_auditoria (created_at DESC);

ALTER TABLE public.admin_auditoria ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_auditoria FROM anon, authenticated;
