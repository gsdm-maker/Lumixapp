-- Migration 063: historial de pagos y fecha de vencimiento de la suscripcion.
--
-- Antes "Pagada" no vencia nunca y no quedaba registro de los cobros: el Owner cobraba por fuera
-- y marcaba la empresa a mano. Ahora:
--
--   * empresas.pagado_hasta: ultimo dia cubierto por los pagos (fecha de Chile).
--   * pagos: cada cobro con monto, meses, periodo, metodo y referencia. No se borran: se
--     anulan con motivo, para que el historial siempre cuadre.
--   * registrar_pago / anular_pago: los usa la consola del Owner (admin-users, service role).
--     Recalculan pagado_hasta en la misma transaccion.
--
-- Reglas (tambien en src/core/auth/plan.ts y supabase/functions/_shared/auth.ts):
--   * Un pago nuevo parte hoy, o al dia siguiente del vencimiento si aun no vence (pagar antes
--     no hace perder dias).
--   * Vencida la fecha hay 7 dias de gracia con aviso; despues se bloquea como una prueba
--     terminada (la IA deja de responder y la app pide contactar). Los datos no se borran.

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS pagado_hasta DATE;

COMMENT ON COLUMN public.empresas.pagado_hasta IS
  'Ultimo dia cubierto por los pagos (fecha de Chile). Con plan = pago: vencida + 7 dias de gracia = bloqueo.';

CREATE TABLE IF NOT EXISTS public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  monto NUMERIC(12, 0) NOT NULL CHECK (monto > 0),
  moneda TEXT NOT NULL DEFAULT 'CLP' CHECK (moneda = 'CLP'),
  meses INTEGER NOT NULL CHECK (meses IN (1, 3, 6, 12)),
  periodo_desde DATE NOT NULL,
  periodo_hasta DATE NOT NULL,
  metodo TEXT NOT NULL CHECK (metodo IN ('transferencia', 'efectivo', 'tarjeta', 'otro')),
  referencia TEXT CHECK (length(referencia) <= 120),
  nota TEXT CHECK (length(nota) <= 500),
  registrado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulado_at TIMESTAMPTZ,
  anulado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo_anulacion TEXT CHECK (length(motivo_anulacion) <= 300),
  CHECK (periodo_hasta > periodo_desde),
  CHECK ((anulado_at IS NULL) = (motivo_anulacion IS NULL))
);

CREATE INDEX IF NOT EXISTS pagos_empresa_idx ON public.pagos (empresa_id, created_at DESC);

-- Leer: el Admin de la empresa ve los suyos; el Owner, todos. Escribir: solo la service role
-- (sin politicas de insert/update/delete, la app no puede).
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pagos_select ON public.pagos;
CREATE POLICY pagos_select ON public.pagos
  FOR SELECT TO authenticated
  USING (es_admin_empresa(empresa_id) OR es_owner());

-- La proteccion de 062 cubre tambien la fecha de vencimiento.
CREATE OR REPLACE FUNCTION public.proteger_plan_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.prueba_hasta IS DISTINCT FROM OLD.prueba_hasta
      OR NEW.pagado_hasta IS DISTINCT FROM OLD.pagado_hasta)
     AND auth.uid() IS NOT NULL
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'El plan de la empresa solo lo cambia la administración de la plataforma'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

/** Registra un cobro y deja la empresa pagada hasta el fin del nuevo periodo. */
CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_empresa UUID,
  p_monto NUMERIC,
  p_meses INTEGER,
  p_metodo TEXT,
  p_referencia TEXT,
  p_nota TEXT,
  p_por UUID
)
RETURNS public.pagos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hoy DATE := (now() AT TIME ZONE 'America/Santiago')::date;
  actual DATE;
  desde DATE;
  fila public.pagos;
BEGIN
  SELECT pagado_hasta INTO actual FROM empresas WHERE id = p_empresa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa no encontrada';
  END IF;
  -- Si aun no vence, el periodo nuevo empieza al dia siguiente del vencimiento.
  desde := CASE WHEN actual IS NOT NULL AND actual >= hoy THEN actual + 1 ELSE hoy END;

  INSERT INTO pagos (empresa_id, monto, meses, periodo_desde, periodo_hasta, metodo, referencia,
                     nota, registrado_por)
  VALUES (p_empresa, p_monto, p_meses, desde, (desde + make_interval(months => p_meses))::date - 1,
          p_metodo, nullif(btrim(p_referencia), ''), nullif(btrim(p_nota), ''), p_por)
  RETURNING * INTO fila;

  UPDATE empresas SET plan = 'pago', pagado_hasta = fila.periodo_hasta WHERE id = p_empresa;
  RETURN fila;
END;
$$;

/**
 * Anula un cobro (no lo borra) y recalcula el vencimiento con los pagos que quedan. Sin pagos
 * vigentes la empresa queda en 'pago' sin fecha: vencida (el Owner decide si la deja gratis).
 */
CREATE OR REPLACE FUNCTION public.anular_pago(p_pago UUID, p_motivo TEXT, p_por UUID)
RETURNS public.pagos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  fila public.pagos;
BEGIN
  UPDATE pagos
    SET anulado_at = now(), anulado_por = p_por, motivo_anulacion = btrim(p_motivo)
    WHERE id = p_pago AND anulado_at IS NULL
    RETURNING * INTO fila;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado o ya anulado';
  END IF;

  UPDATE empresas
    SET pagado_hasta = (SELECT max(periodo_hasta) FROM pagos
                        WHERE empresa_id = fila.empresa_id AND anulado_at IS NULL)
    WHERE id = fila.empresa_id;
  RETURN fila;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_pago(UUID, NUMERIC, INTEGER, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.anular_pago(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago(UUID, NUMERIC, INTEGER, TEXT, TEXT, TEXT, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.anular_pago(UUID, TEXT, UUID) TO service_role;
