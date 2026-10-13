-- Migration 061: endurecimiento posterior a la revision de seguridad
-- (docs/seguridad-wstg-2026-10-09.md).
--
-- handle_new_user() es SECURITY DEFINER y era la UNICA funcion de public sin SET search_path
-- (verificado contra la base el 13 oct 2026: 27 de 28 funciones ya lo fijan, casi todas desde
-- la 017). Sin search_path, una funcion SECURITY DEFINER hereda el search_path del llamador, lo
-- que habilita "search_path hijacking": si alguien consigue crear objetos en un esquema que
-- quede antes en la ruta, la funcion podria resolver nombres no calificados a esos objetos.
-- Se fija a public, igual que el resto de las funciones del proyecto.
--
-- Es idempotente: ALTER FUNCTION ... SET search_path se puede repetir sin efecto.

ALTER FUNCTION public.handle_new_user() SET search_path = public;
