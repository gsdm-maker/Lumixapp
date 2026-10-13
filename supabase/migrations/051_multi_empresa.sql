-- Migration 051: multi-empresa con jerarquia de unidades
--
-- Modelo:
--   - empresas: cada empresa define los nombres de sus niveles (Gerencia > Subgerencia > ...).
--   - teams pasa a ser el arbol de unidades: empresa_id + parent_id (profundidad libre; una rama
--     puede saltarse niveles) + nivel (texto libre, normalmente uno de empresas.niveles).
--     Actividades, minutas, errores y chat siguen colgando de team_id: la app no cambia.
--   - profiles.empresa_id: una persona pertenece a UNA sola empresa (puede estar en varias
--     unidades de ella). profiles.role = 'admin' pasa a significar admin DE SU empresa.
--   - profiles.es_admin_plataforma: el dueno de la plataforma, ve y controla todas las empresas.
--
-- Control en cascada:
--   - is_team_manager(t) (controla t): admin de plataforma, admin de la empresa de t, jefe de t
--     o jefe de la unidad inmediatamente superior a t.
--   - puede_ver_unidad(t) (ve t): miembro de t, quien la controla, o jefe de cualquier unidad
--     por encima de t (un jefe ve toda su rama, pero solo controla el nivel de abajo).
--   Jefe = team_members.role 'admin' o 'jefatura' en esa unidad.

-- --- Tablas y columnas ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  niveles TEXT[] NOT NULL DEFAULT ARRAY['Gerencia', 'Subgerencia', 'Area', 'Equipo'],
  es_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.empresas.niveles IS
  'Nombres de los niveles de la jerarquia, de arriba hacia abajo. Solo para mostrar: la profundidad real es libre.';
COMMENT ON COLUMN public.empresas.es_personal IS
  'Empresa creada automaticamente para una persona que trabaja sola; la app no le muestra jerarquia.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS es_admin_plataforma BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.teams(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS nivel TEXT;

CREATE INDEX IF NOT EXISTS idx_teams_empresa ON public.teams(empresa_id);
CREATE INDEX IF NOT EXISTS idx_teams_parent ON public.teams(parent_id);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa ON public.profiles(empresa_id);

-- Lo que ya existia queda en una empresa inicial (se renombra despues desde la consola).
DO $$
DECLARE
  e UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.teams WHERE empresa_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE empresa_id IS NULL) THEN
    INSERT INTO public.empresas (nombre) VALUES ('Empresa inicial') RETURNING id INTO e;
    UPDATE public.teams SET empresa_id = e WHERE empresa_id IS NULL;
    UPDATE public.profiles SET empresa_id = e WHERE empresa_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.teams ALTER COLUMN empresa_id SET NOT NULL;

-- --- Funciones de permisos ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mi_empresa()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT empresa_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.es_admin_plataforma()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT es_admin_plataforma FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.es_admin_empresa(e UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND empresa_id = e
  );
$$;

CREATE OR REPLACE FUNCTION public.es_jefe_de(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = t AND user_id = auth.uid() AND role IN ('admin', 'jefatura')
  );
$$;

-- Unidades por encima de t (sin incluir t). Tope de 50 niveles por seguridad.
CREATE OR REPLACE FUNCTION public.ancestros_de(t UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE arriba AS (
    SELECT parent_id AS id, 1 AS d FROM teams WHERE id = t
    UNION ALL
    SELECT tt.parent_id, arriba.d + 1 FROM teams tt JOIN arriba ON tt.id = arriba.id
    WHERE arriba.d < 50
  )
  SELECT id FROM arriba WHERE id IS NOT NULL;
$$;

-- Controla t. Reemplaza a la version de 021: el admin ya no es global, es de su empresa.
CREATE OR REPLACE FUNCTION public.is_team_manager(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    es_admin_plataforma()
    OR es_admin_empresa((SELECT empresa_id FROM teams WHERE id = t))
    OR es_jefe_de(t)
    OR es_jefe_de((SELECT parent_id FROM teams WHERE id = t));
$$;

-- Ve t: miembro, quien la controla, o jefe de cualquier unidad por encima.
CREATE OR REPLACE FUNCTION public.puede_ver_unidad(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    es_miembro_del_equipo(t)
    OR is_team_manager(t)
    OR EXISTS (SELECT 1 FROM ancestros_de(t) a WHERE es_jefe_de(a));
$$;

REVOKE ALL ON FUNCTION public.mi_empresa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_admin_plataforma() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_admin_empresa(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_jefe_de(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ancestros_de(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_ver_unidad(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_empresa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_plataforma() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_empresa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_jefe_de(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ancestros_de(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_unidad(UUID) TO authenticated;

-- Hojas (minuta/ingesta/proyecto): el admin global de 049 pasa a ser quien controla la unidad.
CREATE OR REPLACE FUNCTION public.puede_escribir_hoja(t uuid, p_tipo text, p_accion text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_team_manager(t)
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = t
        AND tm.user_id = auth.uid()
        AND (
          (p_tipo = 'ingesta' AND (
                tm.role = 'invitado'
                OR (tm.permissions->>'ingestas.gestionar')::boolean IS TRUE))
          OR (p_tipo = 'proyecto' AND p_accion = 'eliminar'
                AND (tm.permissions->>'proyectos.eliminar')::boolean IS TRUE)
          OR (p_tipo = 'proyecto' AND p_accion <> 'eliminar'
                AND (tm.permissions->>'proyectos.gestionar')::boolean IS TRUE)
          OR (p_tipo = 'minuta' AND p_accion = 'eliminar'
                AND (tm.permissions->>'minuta.eliminar')::boolean IS TRUE)
          OR (p_tipo = 'minuta' AND p_accion <> 'eliminar'
                AND (tm.permissions->>'minuta.gestionar')::boolean IS TRUE)
        )
    );
$$;

-- --- Integridad del arbol -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validar_unidad()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  quien UUID := auth.uid();
BEGIN
  -- Unidad nueva sin empresa: la de quien la crea. Si esa persona no tiene empresa (trabaja
  -- sola), se le crea una empresa personal.
  IF TG_OP = 'INSERT' AND NEW.empresa_id IS NULL THEN
    NEW.empresa_id := (SELECT empresa_id FROM profiles WHERE id = quien);
    IF NEW.empresa_id IS NULL AND quien IS NOT NULL THEN
      INSERT INTO empresas (nombre, es_personal)
      VALUES (COALESCE((SELECT full_name FROM profiles WHERE id = quien), 'Mi espacio'), true)
      RETURNING id INTO NEW.empresa_id;
      UPDATE profiles SET empresa_id = NEW.empresa_id WHERE id = quien;
    END IF;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'La unidad necesita una empresa';
  END IF;

  -- Solo se crean unidades en la empresa propia (la plataforma puede en cualquiera).
  IF TG_OP = 'INSERT' AND quien IS NOT NULL AND NOT es_admin_plataforma()
     AND NEW.empresa_id IS DISTINCT FROM (SELECT empresa_id FROM profiles WHERE id = quien) THEN
    RAISE EXCEPTION 'Solo puedes crear unidades en tu empresa';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     AND quien IS NOT NULL AND NOT es_admin_plataforma() THEN
    RAISE EXCEPTION 'No se puede cambiar la empresa de una unidad';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Una unidad no puede depender de si misma';
    END IF;
    IF (SELECT empresa_id FROM teams WHERE id = NEW.parent_id) IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'La unidad superior es de otra empresa';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.id IN (SELECT ancestros_de(NEW.parent_id)) THEN
      RAISE EXCEPTION 'Ese cambio formaria un ciclo en la jerarquia';
    END IF;
  END IF;

  -- Permisos para colgar o mover una unidad (solo usuarios; service_role pasa).
  IF quien IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
    IF NEW.parent_id IS NOT NULL THEN
      IF NOT is_team_manager(NEW.parent_id) THEN
        RAISE EXCEPTION 'No controlas la unidad superior elegida';
      END IF;
    ELSIF NOT (
      es_admin_plataforma()
      OR es_admin_empresa(NEW.empresa_id)
      OR COALESCE((SELECT es_personal FROM empresas WHERE id = NEW.empresa_id), false)
    ) THEN
      RAISE EXCEPTION 'Solo el admin de la empresa crea unidades de primer nivel';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_unidad ON public.teams;
CREATE TRIGGER trg_validar_unidad
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.validar_unidad();

-- Una persona solo entra a unidades de su empresa. Si aun no tiene empresa, toma esa.
CREATE OR REPLACE FUNCTION public.validar_miembro_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e_unidad UUID;
  e_persona UUID;
BEGIN
  SELECT empresa_id INTO e_unidad FROM teams WHERE id = NEW.team_id;
  SELECT empresa_id INTO e_persona FROM profiles WHERE id = NEW.user_id;
  IF e_persona IS NULL THEN
    UPDATE profiles SET empresa_id = e_unidad WHERE id = NEW.user_id;
  ELSIF e_persona IS DISTINCT FROM e_unidad THEN
    RAISE EXCEPTION 'Esta persona pertenece a otra empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_miembro_empresa ON public.team_members;
CREATE TRIGGER trg_validar_miembro_empresa
  BEFORE INSERT OR UPDATE OF team_id, user_id ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.validar_miembro_empresa();

-- La empresa y la marca de plataforma de un perfil no se cambian desde la app (salvo asignar
-- empresa a quien no tenia, que lo hacen los triggers de arriba).
CREATE OR REPLACE FUNCTION public.proteger_empresa_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR es_admin_plataforma() THEN
    RETURN NEW;
  END IF;
  IF NEW.es_admin_plataforma IS DISTINCT FROM OLD.es_admin_plataforma THEN
    RAISE EXCEPTION 'No autorizado para modificar es_admin_plataforma';
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id AND OLD.empresa_id IS NOT NULL THEN
    RAISE EXCEPTION 'No autorizado para cambiar de empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_empresa_perfil ON public.profiles;
CREATE TRIGGER trg_proteger_empresa_perfil
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_empresa_perfil();

-- --- RLS ------------------------------------------------------------------------------------------

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY empresas_select ON public.empresas
  FOR SELECT USING (id = mi_empresa() OR es_admin_plataforma());
CREATE POLICY empresas_update ON public.empresas
  FOR UPDATE USING (es_admin_empresa(id) OR es_admin_plataforma())
  WITH CHECK (es_admin_empresa(id) OR es_admin_plataforma());
CREATE POLICY empresas_insert ON public.empresas
  FOR INSERT WITH CHECK (es_admin_plataforma());
CREATE POLICY empresas_delete ON public.empresas
  FOR DELETE USING (es_admin_plataforma());

-- Unidades
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
  FOR SELECT USING (created_by = auth.uid() OR puede_ver_unidad(id));

-- teams_insert sigue siendo "usuario autenticado" (003): la empresa y el lugar en el arbol los
-- valida trg_validar_unidad, que si ve la empresa personal recien creada en el mismo INSERT.

-- Miembros: quien ve la unidad ve su gente.
DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT USING (user_id = auth.uid() OR puede_ver_unidad(team_id));

-- Perfiles: los de las unidades que veo, y todos los de mi empresa si soy su admin.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = profiles.id AND puede_ver_unidad(tm.team_id)
    )
    OR es_admin_empresa(empresa_id)
    OR es_admin_plataforma()
  );

-- Actividades
DROP POLICY IF EXISTS activities_select ON public.activities;
CREATE POLICY activities_select ON public.activities
  FOR SELECT USING (puede_ver_unidad(team_id));

DROP POLICY IF EXISTS activities_insert ON public.activities;
CREATE POLICY activities_insert ON public.activities
  FOR INSERT WITH CHECK (es_miembro_del_equipo(team_id) OR is_team_manager(team_id));

DROP POLICY IF EXISTS activities_delete ON public.activities;
CREATE POLICY activities_delete ON public.activities
  FOR DELETE USING (is_team_manager(team_id) OR tiene_permiso(team_id, 'actividades.eliminar'));

-- Errores
DROP POLICY IF EXISTS errors_select ON public.errors;
CREATE POLICY errors_select ON public.errors
  FOR SELECT USING (puede_ver_unidad(team_id));

DROP POLICY IF EXISTS errors_insert ON public.errors;
CREATE POLICY errors_insert ON public.errors
  FOR INSERT WITH CHECK (es_miembro_del_equipo(team_id) OR is_team_manager(team_id));

DROP POLICY IF EXISTS errors_update ON public.errors;
CREATE POLICY errors_update ON public.errors
  FOR UPDATE USING (es_miembro_del_equipo(team_id) OR is_team_manager(team_id));

-- Reuniones
DROP POLICY IF EXISTS meetings_select ON public.meetings;
CREATE POLICY meetings_select ON public.meetings
  FOR SELECT USING (puede_ver_unidad(team_id));

DROP POLICY IF EXISTS meetings_insert ON public.meetings;
CREATE POLICY meetings_insert ON public.meetings
  FOR INSERT WITH CHECK (es_miembro_del_equipo(team_id) OR is_team_manager(team_id));

-- Hojas
DROP POLICY IF EXISTS minute_items_select ON public.minute_items;
CREATE POLICY minute_items_select ON public.minute_items
  FOR SELECT USING (puede_ver_unidad(team_id));

-- Decisiones de la IA
DROP POLICY IF EXISTS ai_decisions_select ON public.ai_decisions;
CREATE POLICY ai_decisions_select ON public.ai_decisions
  FOR SELECT USING (puede_ver_unidad(team_id));

DROP POLICY IF EXISTS ai_decisions_insert ON public.ai_decisions;
CREATE POLICY ai_decisions_insert ON public.ai_decisions
  FOR INSERT WITH CHECK (es_miembro_del_equipo(team_id) OR is_team_manager(team_id));

DROP POLICY IF EXISTS ai_decisions_update ON public.ai_decisions;
CREATE POLICY ai_decisions_update ON public.ai_decisions
  FOR UPDATE USING (es_miembro_del_equipo(team_id) OR is_team_manager(team_id));

-- Grupos de trabajo
DROP POLICY IF EXISTS grupos_trabajo_select ON public.grupos_trabajo;
CREATE POLICY grupos_trabajo_select ON public.grupos_trabajo
  FOR SELECT USING (puede_ver_unidad(team_id));

-- Notificaciones: tambien a la gente de las unidades que controlo.
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = notifications.user_id
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = notifications.user_id AND is_team_manager(tm.team_id)
    )
  );

-- El chat (messages) queda igual: cada persona ve lo suyo, y el admin de la empresa lo de las
-- unidades donde es miembro (028). La membresia ya lo acota a su empresa.
