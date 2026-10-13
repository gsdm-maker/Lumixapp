-- Migration 059: completa H1 (058). Varias funciones nunca tuvieron REVOKE ... FROM PUBLIC, y
-- `anon` las seguia pudiendo ejecutar por ese camino (todo rol es miembro de PUBLIC). Se quita
-- EXECUTE a PUBLIC en todas las funciones de public y se da explicito solo a quienes las usan:
-- usuarios con sesion (authenticated) y el servidor (service_role). Lo mismo para las que se
-- creen despues. Los triggers no necesitan EXECUTE para dispararse.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
