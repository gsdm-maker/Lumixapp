-- Migration 057: configuracion de la plataforma (una sola fila). Por ahora, los correos a los
-- que escribe quien termina su prueba ("Escribir para activar"). La edita el Owner desde la
-- consola (admin-users, con la service role); cualquiera con sesion la puede leer.

CREATE TABLE IF NOT EXISTS public.plataforma (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  contacto_suscripcion TEXT[] NOT NULL DEFAULT ARRAY['sebadiazespindola57@gmail.com'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.plataforma (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.plataforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY plataforma_select ON public.plataforma
  FOR SELECT TO authenticated USING (true);
