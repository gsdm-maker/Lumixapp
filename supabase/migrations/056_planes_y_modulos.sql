-- Migration 056: registro abierto con prueba de 15 dias, modulos por empresa y por unidad.
--
-- Plan de la empresa (lo maneja el Owner):
--   'prueba' -> vale hasta prueba_hasta (15 dias desde que se crea); despues la app pide
--               contactar para gestionar la suscripcion y la IA deja de responder.
--   'gratis' -> sin vencimiento (el Owner decide quien la usa gratis).
--   'pago'   -> suscripcion vigente (cuando exista el portal de pago).
--
-- Modulos: el Chat siempre esta. Lo demas se enciende por empresa (empresas.modulos) y cada
-- unidad puede tener los suyos (teams.modulos; NULL = los de la empresa). Encima sigue el
-- permiso por persona (team_members.permissions 'modulos.*').

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS modulos TEXT[] NOT NULL
    DEFAULT ARRAY['actividades', 'planificacion', 'dashboard'],
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'prueba'
    CHECK (plan IN ('prueba', 'gratis', 'pago')),
  ADD COLUMN IF NOT EXISTS prueba_hasta TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 days';

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS modulos TEXT[];

COMMENT ON COLUMN public.empresas.modulos IS
  'Modulos encendidos: actividades, proyectos, minuta, compromisos, errores, ingestas, planificacion, dashboard. El chat siempre esta.';
COMMENT ON COLUMN public.teams.modulos IS
  'Modulos de esta unidad. NULL = usa los de la empresa.';

-- Las empresas que ya existian siguen funcionando como antes: gratis y con todo encendido.
UPDATE public.empresas
  SET plan = 'gratis',
      modulos = ARRAY['actividades', 'proyectos', 'minuta', 'compromisos', 'errores', 'ingestas',
                      'planificacion', 'dashboard'];

CREATE OR REPLACE FUNCTION public.modulos_validos(m TEXT[])
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT m <@ ARRAY['actividades', 'proyectos', 'minuta', 'compromisos', 'errores', 'ingestas',
                    'planificacion', 'dashboard']::TEXT[];
$$;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_modulos_validos CHECK (modulos_validos(modulos));
ALTER TABLE public.teams
  ADD CONSTRAINT teams_modulos_validos CHECK (modulos IS NULL OR modulos_validos(modulos));

-- El cambio de rol de una persona solo lo hace un Admin... salvo al crear su propio espacio
-- (crear_mi_espacio, abajo), que se marca con una variable local de la transaccion. PostgREST
-- no expone set_config: desde la app no se puede encender.
CREATE OR REPLACE FUNCTION prevent_role_team_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
  puede_por_permiso BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR current_setting('lumix.creando_espacio', true) = 'si' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'No autorizado para modificar role';
    END IF;
  END IF;

  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    puede_por_permiso :=
      NEW.role IS NOT DISTINCT FROM OLD.role
      AND tiene_permiso(NEW.team_id, 'equipo.gestionar_miembros');

    IF NOT (
      (NEW.id = auth.uid()
        AND EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.id AND team_id = NEW.team_id))
      OR is_team_manager(NEW.team_id)
      OR puede_por_permiso
    ) THEN
      RAISE EXCEPTION 'No autorizado para modificar team_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

/**
 * Bienvenida: quien recien se registra (sin empresa) crea su espacio.
 *   p_tipo 'personal' -> empresa personal "Mi espacio", sin jerarquia visible.
 *   p_tipo 'empresa'  -> empresa con su nombre y niveles; la persona queda como su Admin.
 * En ambos casos se crea la primera unidad, con la persona como Lider, y empieza la prueba de
 * 15 dias. Devuelve el id de la empresa.
 */
CREATE OR REPLACE FUNCTION public.crear_mi_espacio(
  p_tipo TEXT,
  p_nombre TEXT,
  p_modulos TEXT[],
  p_niveles TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := auth.uid();
  e UUID;
  u UUID;
  nombre TEXT := btrim(coalesce(p_nombre, ''));
  niveles TEXT[] := coalesce(p_niveles, ARRAY['Gerencia', 'Subgerencia', 'Área', 'Equipo']);
BEGIN
  IF yo IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión primero';
  END IF;
  IF (SELECT empresa_id FROM profiles WHERE id = yo) IS NOT NULL THEN
    RAISE EXCEPTION 'Ya tienes un espacio creado';
  END IF;
  IF p_tipo NOT IN ('personal', 'empresa') THEN
    RAISE EXCEPTION 'Tipo de espacio no válido';
  END IF;
  IF NOT modulos_validos(coalesce(p_modulos, '{}')) THEN
    RAISE EXCEPTION 'Módulo no válido';
  END IF;
  IF p_tipo = 'empresa' AND (length(nombre) < 2 OR length(nombre) > 80) THEN
    RAISE EXCEPTION 'El nombre de la empresa debe tener entre 2 y 80 caracteres';
  END IF;
  IF array_length(niveles, 1) IS NULL OR array_length(niveles, 1) > 8 THEN
    RAISE EXCEPTION 'Define entre 1 y 8 niveles';
  END IF;

  PERFORM set_config('lumix.creando_espacio', 'si', true);

  INSERT INTO empresas (nombre, es_personal, modulos, niveles, plan, prueba_hasta)
  VALUES (
    CASE WHEN p_tipo = 'personal' THEN 'Mi espacio' ELSE nombre END,
    p_tipo = 'personal',
    coalesce(p_modulos, '{}'),
    CASE WHEN p_tipo = 'personal' THEN ARRAY['Equipo'] ELSE niveles END,
    'prueba',
    now() + interval '15 days'
  )
  RETURNING id INTO e;

  UPDATE profiles
    SET empresa_id = e, role = CASE WHEN p_tipo = 'empresa' THEN 'admin' ELSE role END
    WHERE id = yo;

  INSERT INTO teams (name, description, created_by, empresa_id, nivel)
  VALUES (
    CASE WHEN p_tipo = 'personal' THEN 'Mi espacio' ELSE nombre END,
    '',
    yo,
    e,
    CASE WHEN p_tipo = 'personal' THEN NULL ELSE niveles[1] END
  )
  RETURNING id INTO u;

  INSERT INTO team_members (team_id, user_id, role) VALUES (u, yo, 'lider');
  UPDATE profiles SET team_id = u WHERE id = yo;

  PERFORM set_config('lumix.creando_espacio', '', true);
  RETURN e;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_mi_espacio(TEXT, TEXT, TEXT[], TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_mi_espacio(TEXT, TEXT, TEXT[], TEXT[]) TO authenticated;
