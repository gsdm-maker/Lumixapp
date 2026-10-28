-- Migration 064: tope diario de IA mas bajo para las empresas en prueba.
--
-- Auditoria del 28-10-2026: el registro esta abierto, sin confirmar el email y sin captcha, asi
-- que cualquiera (o un bot) puede crear cuentas y usar la IA con la clave del proyecto. Mientras
-- se activan el captcha y la confirmacion de email, una cuenta en prueba gasta poco: 30 mensajes
-- al dia en vez de 150. Las empresas pagadas o gratis siguen con plataforma.tope_ia_diario.

ALTER TABLE public.plataforma
  ADD COLUMN IF NOT EXISTS tope_ia_prueba INTEGER NOT NULL DEFAULT 30
    CHECK (tope_ia_prueba BETWEEN 1 AND 10000);

CREATE OR REPLACE FUNCTION public.registrar_uso_ia(p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hoy DATE := (now() AT TIME ZONE 'America/Santiago')::date;
  en_prueba BOOLEAN;
  tope INTEGER;
  n INTEGER;
BEGIN
  IF (SELECT es_owner FROM profiles WHERE id = p_user) THEN
    RETURN true;
  END IF;
  -- Sin empresa todavia (recien registrado) cuenta como prueba: es justo el caso a acotar.
  en_prueba := coalesce(
    (SELECT e.plan = 'prueba' FROM profiles p JOIN empresas e ON e.id = p.empresa_id
     WHERE p.id = p_user),
    true
  );
  tope := CASE
    WHEN en_prueba THEN (SELECT tope_ia_prueba FROM plataforma LIMIT 1)
    ELSE (SELECT tope_ia_diario FROM plataforma LIMIT 1)
  END;
  INSERT INTO uso_ia (user_id, dia, llamadas) VALUES (p_user, hoy, 1)
  ON CONFLICT (user_id, dia) DO UPDATE SET llamadas = uso_ia.llamadas + 1
  RETURNING llamadas INTO n;
  RETURN n <= coalesce(tope, CASE WHEN en_prueba THEN 30 ELSE 150 END);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_uso_ia(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_uso_ia(UUID) TO service_role;
