-- Migration 060: arreglos bajos de la revision de seguridad (docs/seguridad-wstg-2026-10-09.md).
--
-- H9: tope diario de mensajes con IA por persona, guardado en la base (el limite en memoria de
--     las funciones es por instancia y no sirve como tope de gasto). El Owner lo ajusta en
--     plataforma.tope_ia_diario; el Owner mismo no tiene tope.
-- H11: borrar una cuenta que creo unidades fallaba (teams.created_by sin regla al borrar). Ahora
--     la unidad queda sin creador. Lo demas que una persona crea (actividades, errores...) sigue
--     atado a ella: para quien se va, la consola usa "Desactivar", que no borra nada.

ALTER TABLE public.plataforma
  ADD COLUMN IF NOT EXISTS tope_ia_diario INTEGER NOT NULL DEFAULT 150
    CHECK (tope_ia_diario BETWEEN 1 AND 10000);

CREATE TABLE IF NOT EXISTS public.uso_ia (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santiago')::date,
  llamadas INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, dia)
);

-- Solo la usan las funciones del servidor (service_role): sin politicas, la app no la ve.
ALTER TABLE public.uso_ia ENABLE ROW LEVEL SECURITY;

/**
 * Suma una llamada a la IA de hoy y dice si la persona sigue dentro de su tope. La llaman las
 * funciones de IA antes de ir a OpenAI.
 */
CREATE OR REPLACE FUNCTION public.registrar_uso_ia(p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hoy DATE := (now() AT TIME ZONE 'America/Santiago')::date;
  tope INTEGER := (SELECT tope_ia_diario FROM plataforma LIMIT 1);
  n INTEGER;
BEGIN
  IF (SELECT es_owner FROM profiles WHERE id = p_user) THEN
    RETURN true;
  END IF;
  INSERT INTO uso_ia (user_id, dia, llamadas) VALUES (p_user, hoy, 1)
  ON CONFLICT (user_id, dia) DO UPDATE SET llamadas = uso_ia.llamadas + 1
  RETURNING llamadas INTO n;
  RETURN n <= coalesce(tope, 150);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_uso_ia(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_uso_ia(UUID) TO service_role;

-- H11
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS fk_teams_created_by;
ALTER TABLE public.teams
  ADD CONSTRAINT fk_teams_created_by
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
