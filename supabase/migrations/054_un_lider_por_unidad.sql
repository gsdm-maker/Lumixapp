-- Migration 054: un solo Lider por unidad (como RACI: un solo dueno por cosa).
-- Nombrar a otro Lider pasa al anterior a Integrante; eso lo hace la consola (admin-users) en
-- el orden correcto. Este indice es la garantia en la base.

-- Si ya hubiera mas de uno, se queda el mas antiguo y el resto pasa a Integrante.
UPDATE public.team_members tm SET role = 'integrante'
WHERE tm.role = 'lider'
  AND EXISTS (
    SELECT 1 FROM public.team_members o
    WHERE o.team_id = tm.team_id AND o.role = 'lider'
      AND (o.joined_at, o.id) < (tm.joined_at, tm.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS team_members_un_lider
  ON public.team_members (team_id) WHERE role = 'lider';
