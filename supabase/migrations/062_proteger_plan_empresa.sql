-- Migration 062: el plan de una empresa solo lo cambia la plataforma.
--
-- AGUJERO QUE CIERRA
-- La politica empresas_update (051) deja que el Admin de una empresa actualice la fila de SU
-- empresa, y eso incluia plan y prueba_hasta. Quien se registra para la prueba queda como Admin
-- de su propio espacio (crear_mi_espacio, 056), asi que con su sesion y la anon key podia
-- ponerse plan = 'gratis' o alargar su prueba sin pasar por el Owner. Verificado en vivo el
-- 26-10-2026 (la base acepto la escritura).
--
-- Desde la app nadie actualiza empresas directo: todo pasa por la Edge Function admin-users con
-- la service role. Por eso basta con exigir service_role para tocar estas columnas. Las
-- migraciones y el editor SQL (sin JWT: auth.uid() es NULL) siguen pudiendo.

CREATE OR REPLACE FUNCTION public.proteger_plan_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.prueba_hasta IS DISTINCT FROM OLD.prueba_hasta)
     AND auth.uid() IS NOT NULL
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'El plan de la empresa solo lo cambia la administración de la plataforma'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_plan_empresa ON public.empresas;
CREATE TRIGGER trg_proteger_plan_empresa
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_plan_empresa();
