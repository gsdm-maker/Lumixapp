-- Migration 058: arreglos de la revision de seguridad (docs/seguridad-wstg-2026-10-09.md).
--
-- H1: el rol anonimo (visitante sin sesion) podia ejecutar todas las funciones de public. Las
--     migraciones hacian REVOKE ... FROM PUBLIC, pero Supabase le da EXECUTE directo a `anon`
--     en cada funcion nueva, asi que ese REVOKE no alcanzaba. Se le quita a todas, y tambien
--     para las funciones que se creen despues. Las reglas por fila que usan estas funciones no
--     se ven afectadas: nadie consulta tablas sin sesion.
-- H1b: find_user_id_by_email devolvia el id de cualquier correo registrado. Ahora solo busca
--     dentro de la empresa de quien pregunta (el Owner, en todas).
-- H2: deshacer_actividad comparaba el creador con `<>`: sin sesion, auth.uid() es NULL, la
--     comparacion da NULL y no frenaba. Ahora exige sesion y usa IS DISTINCT FROM.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM profiles
  WHERE email = lower(btrim(lookup_email))
    AND auth.uid() IS NOT NULL
    AND (es_owner() OR (empresa_id IS NOT NULL AND empresa_id = mi_empresa()))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.deshacer_actividad(p_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'no_es_tuya';
  END IF;

  SELECT * INTO a FROM activities WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN 'no_existe';
  END IF;

  IF a.created_by IS DISTINCT FROM auth.uid() THEN
    RETURN 'no_es_tuya';
  END IF;

  IF a.created_at < now() - interval '30 minutes' THEN
    RETURN 'muy_antigua';
  END IF;

  IF a.status <> 'pendiente' THEN
    RETURN 'ya_empezada';
  END IF;

  IF EXISTS (SELECT 1 FROM activities h WHERE h.parent_activity_id = p_id) THEN
    RETURN 'tiene_delegadas';
  END IF;

  UPDATE minute_items
     SET linked_activity_ids = array_remove(linked_activity_ids, p_id)
   WHERE p_id = ANY(linked_activity_ids);

  UPDATE ai_decisions SET entity_id = NULL WHERE entity_id = p_id;

  DELETE FROM notifications WHERE (metadata->>'activity_id')::uuid = p_id;
  DELETE FROM activities WHERE id = p_id;

  RETURN 'ok';
END;
$$;

-- CREATE OR REPLACE conserva los permisos, pero por si acaso: sin anon, con authenticated.
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deshacer_actividad(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deshacer_actividad(uuid) TO authenticated;
