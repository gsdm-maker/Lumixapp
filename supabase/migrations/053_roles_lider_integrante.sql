-- Migration 053: roles de unidad en espanol, relativos a cada unidad (modelo "linking pin" de
-- Likert): una jefatura es Lider de su unidad y, a la vez, Integrante de la unidad de su jefe.
-- El rol vive en team_members (por unidad), no en la persona. La pertenencia a la unidad de
-- arriba se asigna a mano (decision de producto), no automaticamente.
--
--   team_members.role:  'lead' -> 'lider' · 'member' -> 'integrante' · 'guest' -> 'invitado'
--                       ('admin' sigue igual: el Admin de empresa que figura en una unidad)
--   profiles.role:      'member' -> 'integrante' ('admin' sigue igual)
--   Owner y Admin no cambian: son de plataforma y de empresa, no de unidad.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;

UPDATE public.team_members SET role = CASE role
    WHEN 'lead' THEN 'lider'
    WHEN 'member' THEN 'integrante'
    WHEN 'guest' THEN 'invitado'
    ELSE role
  END;
UPDATE public.profiles SET role = 'integrante' WHERE role = 'member';

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'integrante';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'integrante'));

ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'integrante';
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'lider', 'integrante', 'invitado'));

-- Renombrar conserva la funcion (por si alguna politica la referencia).
ALTER FUNCTION public.es_lead_de(UUID) RENAME TO es_lider_de;
CREATE OR REPLACE FUNCTION public.es_lider_de(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = t AND user_id = auth.uid() AND role IN ('admin', 'lider')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    es_owner()
    OR es_admin_empresa((SELECT empresa_id FROM teams WHERE id = t))
    OR es_lider_de(t)
    OR es_lider_de((SELECT parent_id FROM teams WHERE id = t));
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_unidad(t UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    es_miembro_del_equipo(t)
    OR is_team_manager(t)
    OR EXISTS (SELECT 1 FROM ancestros_de(t) a WHERE es_lider_de(a));
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, team_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'integrante',
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

-- Quien crea una unidad entra como su Lider.
DROP POLICY IF EXISTS team_members_insert ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT WITH CHECK (
    (
      auth.uid() = user_id
      AND role = 'lider'
      AND EXISTS (SELECT 1 FROM teams WHERE id = team_members.team_id AND created_by = auth.uid())
    )
    OR is_team_manager(team_id)
    OR (puede_gestionar_miembros(team_id) AND role = 'integrante')
  );

DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE USING (
    is_team_manager(team_id)
    OR (puede_gestionar_miembros(team_id) AND role IN ('integrante', 'invitado'))
  );
