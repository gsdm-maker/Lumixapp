"""Configuracion compartida de las pruebas de punta a punta (ver README.md)."""
import os
from pathlib import Path

OUT = Path(__file__).parent / "resultados"
OUT.mkdir(exist_ok=True)

BASE = os.environ.get("E2E_BASE", "http://localhost:5180")
CLAVE = os.environ["E2E_CLAVE"]  # clave de los usuarios de prueba: nunca en el codigo

# Opcional. Si el DNS local todavia guarda "no existe" (pasa justo despues de reactivar una base
# pausada), se fija la IP solo dentro del Chromium de prueba, sin tocar el sistema.
#   E2E_SUPABASE_HOST=xxxx.supabase.co  E2E_SUPABASE_IP=104.18.38.10
ARGS = []
if os.environ.get("E2E_SUPABASE_HOST") and os.environ.get("E2E_SUPABASE_IP"):
    ARGS.append(f"--host-resolver-rules=MAP {os.environ['E2E_SUPABASE_HOST']} {os.environ['E2E_SUPABASE_IP']}")


def lanzar(p):
    return p.chromium.launch(headless=True, args=ARGS)


def capturar_consola(page, logs):
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))


def login(page, email):
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    page.locator("input[type=email]").fill(email)
    page.locator("input[type=password]").fill(CLAVE)
    page.locator("form button[type=submit]").click()
    page.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    page.wait_for_load_state("networkidle")
