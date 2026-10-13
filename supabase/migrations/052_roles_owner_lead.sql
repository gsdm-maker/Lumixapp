-- Migration 052: nombres de roles al estilo de Asana/Linear/Notion
--
--   Plataforma: Owner   -> profiles.es_owner (antes es_admin_plataforma, 051)
--   Empresa:    Admin   -> profiles.role = 'admin'   (el resto: 'member')
--   Unidad:     Lead    -> team_members.role = 'lead'   (antes 'jefatura', y el 'admin' de quien
--                                                        creaba un equipo sin ser admin)
--               Member  -> 'member'                     (antes 'colaborador' y 'supervisor')
--               Guest   -> 'guest'                      (antes 'invitado')
--   team_members.role = 'admin' se mantiene solo para el admin de la empresa que figura en una
--   unidad (la app no lo lista como integrante).

-- --- Datos ---------------------------------------------------------------------------------------

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;

UPDATE public.team_members tm SET role = CASE
    WHEN tm.role = 'admin'
      AND (SELECT p.role FROM public.profiles p WHERE p.id = tm.user_id) = 'admin' THEN 'admin'
    WHEN tm.role IN ('admin', 'jefatura') THEN 'lead'
    WHEN tm.role = 'invitado' THEN 'guest'
    ELSE 'member'
  END;

UPDATE public.profiles SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member'));

ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'lead', 'member', 'guest'));

-- --- Owner de la plataforma ----------------------------------------------------------------------

ALTER TABLE public.profiles RENAME COLUMN es_admin_plataforma TO es_owner;

-- Renombrar (no recrear) conserva la funcion que usan las politicas de 051.
ALTER FUNCTION public.es_admin_plataforma() RENAME TO es_owner;
CREATE OR REPLACE FUNCTION public.es_owner()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT es_owner FROM profiles WHERE id = auth.uid()), false);
$$;

-- --- Lead de una unidad --------------------------------------------------------------------------

ALTER FUNCTION public.es_jefe_de(UUID) RENAME TO es_lead_de;
CREATE OR REPLACE FUNCTION public.es_lead_de(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = t AND user_id = auth.uid() AND role IN ('admin', 'lead')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    es_owner()
    OR es_admin_empresa((SELECT empresa_id FROM teams WHERE id = t))
    OR es_lead_de(t)
    OR es_lead_de((SELECT parent_id FROM teams WHERE id = t));
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_unidad(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    es_miembro_del_equipo(t)
    OR is_team_manager(t)
    OR EXISTS (SELECT 1 FROM ancestros_de(t) a WHERE es_lead_de(a));
$$;

-- --- Funciones que nombraban los roles viejos -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, team_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'member',
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
                tm.role = 'guest'
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

CREATE OR REPLACE FUNCTION public.validar_unidad()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  quien UUID := auth.uid();
BEGIN
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

  IF TG_OP = 'INSERT' AND quien IS NOT NULL AND NOT es_owner()
     AND NEW.empresa_id IS DISTINCT FROM (SELECT empresa_id FROM profiles WHERE id = quien) THEN
    RAISE EXCEPTION 'Solo puedes crear unidades en tu empresa';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     AND quien IS NOT NULL AND NOT es_owner() THEN
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

  IF quien IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
    IF NEW.parent_id IS NOT NULL THEN
      IF NOT is_team_manager(NEW.parent_id) THEN
        RAISE EXCEPTION 'No controlas la unidad superior elegida';
      END IF;
    ELSIF NOT (
      es_owner()
      OR es_admin_empresa(NEW.empresa_id)
      OR COALESCE((SELECT es_personal FROM empresas WHERE id = NEW.empresa_id), false)
    ) THEN
      RAISE EXCEPTION 'Solo el admin de la empresa crea unidades de primer nivel';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_empresa_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR es_owner() THEN
    RETURN NEW;
  END IF;
  IF NEW.es_owner IS DISTINCT FROM OLD.es_owner THEN
    RAISE EXCEPTION 'No autorizado para modificar es_owner';
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id AND OLD.empresa_id IS NOT NULL THEN
    RAISE EXCEPTION 'No autorizado para cambiar de empresa';
  END IF;
  RETURN NEW;
END;
$$;

-- --- Politicas que nombraban los roles viejos -----------------------------------------------------

-- Quien crea una unidad entra como su Lead (antes 'admin').
DROP POLICY IF EXISTS team_members_insert ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT WITH CHECK (
    (
      auth.uid() = user_id
      AND role = 'lead'
      AND EXISTS (SELECT 1 FROM teams WHERE id = team_members.team_id AND created_by = auth.uid())
    )
    OR is_team_manager(team_id)
    OR (puede_gestionar_miembros(team_id) AND role = 'member')
  );

DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE USING (
    is_team_manager(team_id)
    OR (puede_gestionar_miembros(team_id) AND role IN ('member', 'guest'))
  );

-- --- Auditoria por empresa ------------------------------------------------------------------------

-- La consola de cada empresa ve solo su registro (admin-users filtra por esta columna).
ALTER TABLE public.admin_auditoria
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS admin_auditoria_empresa_idx
  ON public.admin_auditoria (empresa_id, created_at DESC);
