-- Migration 049: catalogo de permisos completo + cierre de la brecha que reabrio la 041.
--
-- Revision de permisos pedida por Sebastian ("ve si estan todos los posibles permisos, sin
-- desmarcar lo que ya esta asignado"). Cuatro partes:
--
-- 1. SEGURIDAD. La 041 redefinio prevent_role_team_escalation copiando la version de la 022 y
--    volvio a dejar pasar 'jefatura' en cambios de role: una jefatura podia ascenderse a admin
--    global desde el navegador (exactamente la BRECHA 1 que habia cerrado la 030). Tambien
--    perdio el camino is_team_manager(NEW.team_id) para cambiar el team_id de un invitado.
--    Aca se vuelve a la 030 y se conserva lo que agrego la 041 (equipo.gestionar_miembros).
--
-- 2. PERMISOS NUEVOS. Proyectos usaba los de Minuta, Ingestas tomaba prestado
--    'minuta.asignar', y la configuracion del equipo (grupos, umbral) era solo de jefatura.
--      proyectos.gestionar / proyectos.eliminar / proyectos.asignar
--      ingestas.asignar
--      compromisos.conducir   (solo app: sus escrituras en minuta siguen pidiendo minuta.gestionar)
--      equipo.configurar      (grupos de trabajo + umbral de sobrecarga)
--    'actividades.editar_todas' ya existia pero la base no lo conocia: ahora activities_update
--    lo acepta.
--
-- 3. NADA SE DESMARCA. Los flags explicitos que ya existen se copian a su equivalente nuevo,
--    asi el acceso efectivo de cada persona queda igual que antes de esta migracion. Admin y
--    jefatura siguen pasando por is_team_manager / el rol, como hoy.
--
-- 4. ASIGNAR SIN GESTIONAR. Con 'minuta.asignar' pero sin 'minuta.gestionar' la actividad se
--    creaba y despues fallaba el vinculo con el tema (la policy de UPDATE pide gestionar).
--    vincular_actividades_tema() hace solo ese vinculo, con el permiso de asignar de cada hoja.

-- --- helper ---------------------------------------------------------------------------
-- Flag explicito concedido al usuario actual en ese equipo.
CREATE OR REPLACE FUNCTION public.tiene_permiso(t uuid, cap text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = t AND user_id = auth.uid()
      AND (permissions->>cap)::boolean IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.tiene_permiso(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tiene_permiso(uuid, text) TO authenticated;

-- --- 1. seguridad --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_role_team_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
  puede_por_permiso BOOLEAN;
BEGIN
  -- service_role (Edge Functions) no tiene auth.uid(): ese camino ya valida por su cuenta.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Solo admin global (030). La 041 habia vuelto a dejar pasar 'jefatura'.
    IF caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'No autorizado para modificar role';
    END IF;
  END IF;

  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    -- Camino de la 041: invitar con 'equipo.gestionar_miembros' en el equipo destino, sin
    -- cambiar el role en la misma fila.
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

-- --- 2. permisos por hoja ---------------------------------------------------------------
-- Misma firma que la 033 (las policies de minute_items no cambian). Cambia solo que flag se
-- mira: proyecto ahora tiene los suyos.
CREATE OR REPLACE FUNCTION public.puede_escribir_hoja(t uuid, p_tipo text, p_accion text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = t
        AND tm.user_id = auth.uid()
        AND (
          tm.role IN ('admin', 'jefatura')
          OR (p_tipo = 'ingesta' AND (
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

-- editar_todas: hasta ahora solo lo miraba Planificacion en la app.
DROP POLICY IF EXISTS activities_update ON activities;
CREATE POLICY activities_update ON activities
  FOR UPDATE
  USING (responsible_id = auth.uid() OR is_team_manager(team_id)
         OR tiene_permiso(team_id, 'actividades.editar_todas'))
  WITH CHECK (responsible_id = auth.uid() OR is_team_manager(team_id)
              OR tiene_permiso(team_id, 'actividades.editar_todas'));

-- equipo.configurar: umbral de sobrecarga (teams) y grupos de trabajo. De paso teams_update
-- pasa a is_team_manager, que suma al admin global (la 003 no lo dejaba).
DROP POLICY IF EXISTS teams_update ON teams;
CREATE POLICY teams_update ON teams
  FOR UPDATE
  USING (is_team_manager(id) OR tiene_permiso(id, 'equipo.configurar'))
  WITH CHECK (is_team_manager(id) OR tiene_permiso(id, 'equipo.configurar'));

DROP POLICY IF EXISTS grupos_trabajo_insert ON grupos_trabajo;
CREATE POLICY grupos_trabajo_insert ON grupos_trabajo
  FOR INSERT WITH CHECK (is_team_manager(team_id) OR tiene_permiso(team_id, 'equipo.configurar'));

DROP POLICY IF EXISTS grupos_trabajo_update ON grupos_trabajo;
CREATE POLICY grupos_trabajo_update ON grupos_trabajo
  FOR UPDATE
  USING (is_team_manager(team_id) OR tiene_permiso(team_id, 'equipo.configurar'))
  WITH CHECK (is_team_manager(team_id) OR tiene_permiso(team_id, 'equipo.configurar'));

DROP POLICY IF EXISTS grupos_trabajo_delete ON grupos_trabajo;
CREATE POLICY grupos_trabajo_delete ON grupos_trabajo
  FOR DELETE USING (is_team_manager(team_id) OR tiene_permiso(team_id, 'equipo.configurar'));

-- --- 3. copiar flags existentes (nada se desmarca) ----------------------------------------
-- Solo donde el flag nuevo no existe todavia: re-ejecutar la migracion no pisa nada.
UPDATE team_members SET permissions = permissions
    || jsonb_build_object('proyectos.gestionar', permissions->'minuta.gestionar')
  WHERE permissions ? 'minuta.gestionar' AND NOT permissions ? 'proyectos.gestionar';

UPDATE team_members SET permissions = permissions
    || jsonb_build_object('proyectos.eliminar', permissions->'minuta.eliminar')
  WHERE permissions ? 'minuta.eliminar' AND NOT permissions ? 'proyectos.eliminar';

UPDATE team_members SET permissions = permissions
    || jsonb_build_object('proyectos.asignar', permissions->'minuta.asignar')
  WHERE permissions ? 'minuta.asignar' AND NOT permissions ? 'proyectos.asignar';

UPDATE team_members SET permissions = permissions
    || jsonb_build_object('ingestas.asignar', permissions->'minuta.asignar')
  WHERE permissions ? 'minuta.asignar' AND NOT permissions ? 'ingestas.asignar';

-- Conducir Compromisos: los botones salian con 'ver_todas' y la escritura (en la minuta) pedia
-- minuta.gestionar. Lo podia hacer de verdad quien tenia los dos: solo a ellos se les concede,
-- para no sumarle botones a nadie. Jefatura/admin lo traen por rol.
UPDATE team_members SET permissions = permissions
    || jsonb_build_object('compromisos.conducir', true)
  WHERE (permissions->>'minuta.gestionar')::boolean IS TRUE
    AND (permissions->>'actividades.ver_todas')::boolean IS TRUE
    AND NOT permissions ? 'compromisos.conducir';

-- En el chat, 'asignar a terceros' tambien permitia editar actividades ajenas. Ahora eso es
-- 'editar_todas': se concede a quien tenia asignar_otros, para no quitarle esa capacidad.
UPDATE team_members SET permissions = permissions
    || jsonb_build_object('actividades.editar_todas', true)
  WHERE (permissions->>'actividades.asignar_otros')::boolean IS TRUE
    AND NOT permissions ? 'actividades.editar_todas';

-- --- 4. vincular actividades a un tema con el permiso de ASIGNAR --------------------------
-- Lo que hacia createActivitiesFromItem con un UPDATE directo (que pedia gestionar). Fechas
-- opcionales: Proyectos guarda inicio/termino al asignar.
CREATE OR REPLACE FUNCTION public.vincular_actividades_tema(
  p_item uuid,
  p_activity_ids uuid[],
  p_responsables uuid[],
  p_fecha_inicio date DEFAULT NULL,
  p_plazo date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it minute_items%ROWTYPE;
  cap text;
BEGIN
  SELECT * INTO it FROM minute_items WHERE id = p_item;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tema no encontrado';
  END IF;

  cap := CASE it.tipo
    WHEN 'proyecto' THEN 'proyectos.asignar'
    WHEN 'ingesta' THEN 'ingestas.asignar'
    ELSE 'minuta.asignar'
  END;
  IF NOT (puede_escribir_hoja(it.team_id, it.tipo, 'gestionar') OR tiene_permiso(it.team_id, cap)) THEN
    RAISE EXCEPTION 'No autorizado para asignar actividades en este tema';
  END IF;

  -- Solo actividades del mismo equipo: no se puede colgar trabajo ajeno de un tema.
  IF EXISTS (
    SELECT 1 FROM unnest(p_activity_ids) AS x(id)
    WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = x.id AND a.team_id = it.team_id)
  ) THEN
    RAISE EXCEPTION 'Actividad fuera del equipo del tema';
  END IF;

  UPDATE minute_items SET
    -- Se agregan al final sin repetir, conservando el orden (la primera actividad es la que
    -- Actividades usa como padre al agrupar subtareas).
    linked_activity_ids = it.linked_activity_ids || ARRAY(
      SELECT x FROM unnest(p_activity_ids) AS x WHERE x <> ALL (it.linked_activity_ids)),
    responsables = it.responsables || ARRAY(
      SELECT x FROM unnest(p_responsables) AS x WHERE x <> ALL (it.responsables)),
    responsables_text = '',
    estado = 'en_desarrollo',
    fecha_inicio = coalesce(p_fecha_inicio, it.fecha_inicio),
    plazo = coalesce(p_plazo, it.plazo),
    -- Mismo criterio que changePlazo en la app: la primera fecha no cuenta como cambio.
    plazo_change_count = it.plazo_change_count
      + CASE WHEN p_plazo IS NOT NULL AND it.plazo IS NOT NULL AND p_plazo <> it.plazo
             THEN 1 ELSE 0 END,
    plazo_history = CASE WHEN p_plazo IS NOT NULL AND p_plazo IS DISTINCT FROM it.plazo
      THEN it.plazo_history || jsonb_build_array(jsonb_build_object(
             'date', to_char(p_plazo, 'YYYY-MM-DD'), 'at', now()))
      ELSE it.plazo_history END
  WHERE id = p_item;
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_actividades_tema(uuid, uuid[], uuid[], date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_actividades_tema(uuid, uuid[], uuid[], date, date) TO authenticated;
