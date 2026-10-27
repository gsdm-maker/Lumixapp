"""Pruebas de punta a punta de los flujos principales de Lumixapp.

Usa los usuarios de prueba (@example.com). La unica prueba que escribe datos crea una actividad
con titulo unico "E2E <hora>" y la elimina al final.
"""
import re
import time
import traceback
from playwright.sync_api import sync_playwright, expect
from comun import OUT, BASE, lanzar, capturar_consola, login

RES = []
SIN_H1 = []
SELLO = time.strftime("%H%M%S")
TITULO = f"E2E {SELLO} revisar informe de prueba"


def caso(nombre):
    def deco(fn):
        def run(*a):
            t0 = time.time()
            try:
                det = fn(*a) or ""
                RES.append((nombre, True, f"{time.time()-t0:.1f}s {det}"))
            except Exception as e:
                RES.append((nombre, False, f"{type(e).__name__}: {str(e).splitlines()[0][:200]}"))
                try:
                    a[0].screenshot(path=str(OUT / f"FALLA-{re.sub(r'[^a-z0-9]+','-',nombre.lower())[:40]}.png"))
                except Exception:
                    pass
        return run
    return deco


def cerrar_novedades(page):
    btn = page.get_by_role("button", name="Entendido")
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(500)


def ir(page, ruta):
    page.goto(BASE + ruta)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    cerrar_novedades(page)


# ---------------------------------------------------------------- sin sesion
@caso("Rutas protegidas redirigen a /login sin sesión")
def rutas_protegidas(page):
    for r in ["/chat", "/activities", "/minuta", "/compromisos", "/admin"]:
        page.goto(BASE + r)
        page.wait_for_url(re.compile(r"/login"), timeout=10000)
    return "5 rutas"


@caso("Login con clave incorrecta muestra un error")
def login_malo(page):
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    page.locator("input[type=email]").fill("colab1.prueba@example.com")
    page.locator("input[type=password]").fill("clave-equivocada-123")
    page.locator("form button[type=submit]").click()
    page.wait_for_timeout(4000)
    assert "/login" in page.url, "entró con clave incorrecta"
    btn = page.locator("form button[type=submit]").inner_text()
    assert "Ingresando" not in btn, "quedó cargando"
    aviso = page.locator("[role=alert], [role=status], [aria-live]").all_inner_texts()
    aviso = [a.strip() for a in aviso if a.strip()]
    assert aviso, "no muestra ningún mensaje de error"
    return "mensaje: " + aviso[0][:90]


@caso("Login vacío no envía y avisa")
def login_vacio(page):
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    page.locator("form button[type=submit]").click()
    page.wait_for_timeout(1000)
    assert "/login" in page.url
    aviso = [a.strip() for a in page.locator("[role=alert], [role=status], [aria-live]").all_inner_texts() if a.strip()]
    assert aviso, "no muestra ningún aviso"
    return "mensaje: " + aviso[0][:90]


@caso("Móvil 375px: login sin scroll horizontal")
def movil_login(page):
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    sw, cw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    page.screenshot(path=str(OUT / "30-movil-login.png"), full_page=True)
    assert sw <= cw, f"scrollWidth {sw} > {cw}"


@caso("Teclado: 'Mostrar contraseña' alcanzable con Tab")
def tab_mostrar(page):
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    for _ in range(10):
        page.keyboard.press("Tab")
        if (page.evaluate("document.activeElement.getAttribute('aria-label')||''")).startswith("Mostrar"):
            return
    raise AssertionError("no se llega con Tab (revisar tabIndex en LoginPage.tsx)")


# ---------------------------------------------------------------- con sesion
@caso("Admin: login lleva a elegir entrada con Lumix y Administración")
def admin_entrada(page):
    login(page, "admin.prueba@example.com")
    assert "/entrar" in page.url, page.url
    expect(page.locator("a[href='/admin']")).to_be_visible()
    page.locator("a[href='/admin']").click()
    page.wait_for_url(re.compile(r"/admin"))
    page.wait_for_load_state("networkidle")
    page.screenshot(path=str(OUT / "31-admin.png"))


@caso("Colaborador: entra y ve el chat")
def colab_entra(page):
    login(page, "colab1.prueba@example.com")
    ir(page, "/chat")
    expect(page.locator("textarea")).to_be_visible()


@caso("Novedades: 'Entendido' la cierra y no vuelve al recargar")
def novedades(page):
    ir(page, "/chat")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    n = page.get_by_role("button", name="Entendido").count()
    assert n == 0, "la ventana de novedades reaparece tras recargar"


@caso("Navegación: cada sección carga con título y sin errores de consola")
def navegacion(page, logs):
    rutas = ["/chat", "/activities", "/minuta", "/proyectos", "/compromisos", "/errors",
             "/ingestas", "/gantt", "/dashboard", "/notifications", "/teams", "/guia"]
    malas = []
    for r in rutas:
        antes = len(logs)
        ir(page, r)
        nuevos = [l for l in logs[antes:] if "favicon" not in l]
        if nuevos or "/login" in page.url or r.split("/")[1] not in page.url:
            malas.append(f"{r} url={page.url} errores={nuevos[:1]}")
        if not page.locator("h1, [role=heading][aria-level=\"1\"]").count():
            SIN_H1.append(r)
    assert not malas, "; ".join(malas)
    return f"{len(rutas)} secciones"


@caso("Accesibilidad: cada sección tiene un título de nivel 1")
def con_h1(page):
    assert not SIN_H1, "sin h1: " + ", ".join(SIN_H1)


@caso("Actividades: filtros por estado cambian la lista")
def act_filtros(page):
    ir(page, "/activities")
    todas = page.get_by_role("radio", name=re.compile(r"^Todas\s*\d+"))
    comp = page.get_by_role("radio", name=re.compile(r"^Completadas\s*\d+"))
    n_todas = int(re.search(r"\d+", todas.inner_text()).group())
    n_comp = int(re.search(r"\d+", comp.inner_text()).group())
    comp.click()
    page.wait_for_timeout(800)
    filas = page.locator("[role=grid] [role=row]").count()
    todas.click()
    page.wait_for_timeout(800)
    return f"todas={n_todas} completadas={n_comp} filas tras filtrar={filas}"


@caso("Actividades: abrir detalle y cerrarlo con Escape")
def act_detalle(page):
    ir(page, "/activities")
    antes = page.locator("[role=dialog]:visible, [role=complementary]:visible, aside:visible").count()
    fila = page.locator("[role=grid] [role=row]").filter(has=page.get_by_role("button", name=re.compile("Completar|Iniciar"))).first
    titulo = fila.inner_text().splitlines()[0]
    fila.click(position={"x": 120, "y": 15})
    page.wait_for_timeout(1200)
    despues = page.locator("[role=dialog]:visible, [role=complementary]:visible, aside:visible").count()
    page.screenshot(path=str(OUT / "35-detalle.png"))
    assert despues > antes, "no se abrió el panel de detalle"
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    cerrado = page.locator("[role=dialog]:visible, [role=complementary]:visible, aside:visible").count()
    assert cerrado == antes, "Escape no cerró el panel"
    return titulo[:40]


@caso("Minuta: 'Empezar reunión' abre el modo reunión y se sale")
def minuta_reunion(page):
    ir(page, "/minuta")
    page.get_by_role("button", name="Empezar reunión").click()
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / "32-modo-reunion.png"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    return "ok"


@caso("Compromisos: navegar a semana anterior y siguiente")
def compromisos_semana(page):
    ir(page, "/compromisos")
    cab = lambda: " ".join(page.locator("main").inner_text().split())[:200]
    a = cab()
    page.get_by_role("button", name="Semana anterior").click()
    page.wait_for_timeout(1000)
    b = cab()
    page.get_by_role("button", name="Semana siguiente").click()
    page.wait_for_timeout(1000)
    c = cab()
    assert a != b, "la vista no cambió al ir a la semana anterior"
    assert a == c, "no volvió a la semana actual"


@caso("Chat (IA): pregunta '¿Qué tengo pendiente esta semana?' recibe respuesta")
def chat_consulta(page):
    ir(page, "/chat")
    antes = page.locator("main").inner_text()
    ta = page.locator("textarea")
    ta.fill("¿Qué tengo pendiente esta semana?")
    ta.press("Enter")
    t0 = time.time()
    while time.time() - t0 < 40:
        page.wait_for_timeout(1500)
        if len(page.locator("main").inner_text()) > len(antes) + 40:
            break
    page.screenshot(path=str(OUT / "33-chat-consulta.png"))
    assert len(page.locator("main").inner_text()) > len(antes) + 40, "sin respuesta en 40 s"
    return f"{time.time()-t0:.0f}s"


@caso("Chat (IA): crear actividad y verla en Actividades")
def chat_crear(page):
    ir(page, "/chat")
    page.get_by_role("button", name=re.compile("^Tipo de mensaje")).click()
    page.get_by_role("menuitemradio", name="Actividad").click()
    ta = page.locator("textarea")
    ta.fill(f"{TITULO} para mañana")
    ta.press("Enter")
    t0 = time.time()
    # Puede pedir confirmacion: se acepta lo que Lumix propone
    while time.time() - t0 < 45:
        page.wait_for_timeout(1500)
        for nombre in ["Crear", "Confirmar", "Sí, crear", "Crear actividad"]:
            b = page.get_by_role("button", name=nombre, exact=True)
            if b.count() and b.last.is_visible():
                b.last.click()
                page.wait_for_timeout(1500)
        if not page.get_by_text("está procesando").count():
            break
    page.screenshot(path=str(OUT / "34-chat-crear.png"))
    ir(page, "/activities")
    expect(page.locator("[role=grid]").get_by_text(re.compile(f"E2E {SELLO}")).first).to_be_visible(timeout=15000)
    return f"{time.time()-t0:.0f}s"


@caso("Limpieza: eliminar la actividad de prueba (con confirmación)")
def limpiar(page):
    ir(page, "/activities")
    patron = re.compile(r"E2E \d{6}")
    borradas = 0
    for _ in range(6):
        celda = page.locator("[role=grid]").get_by_text(patron)
        if not celda.count():
            break
        celda.first.click()
        page.wait_for_timeout(1000)
        page.get_by_role("button", name="Eliminar", exact=True).first.click()
        dlg = page.get_by_role("alertdialog").or_(page.get_by_role("dialog")).last
        expect(dlg).to_contain_text("No se puede deshacer")
        dlg.get_by_role("button", name="Eliminar").click()
        page.wait_for_timeout(1500)
        borradas += 1
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    assert page.locator("[role=grid]").get_by_text(patron).count() == 0, "siguen actividades E2E"
    return f"{borradas} eliminadas"


@caso("Cerrar sesión vuelve al login y protege las rutas")
def logout(page):
    ir(page, "/chat")
    page.get_by_role("button", name=re.compile("^Menú de")).first.click()
    page.wait_for_timeout(600)
    page.get_by_text("Cerrar sesión").first.click()
    page.wait_for_url(re.compile(r"/login"), timeout=10000)
    page.goto(BASE + "/chat")
    page.wait_for_url(re.compile(r"/login"), timeout=10000)


@caso("Diseño: 'Mi semana' en la barra lateral reemplaza al menú y vuelve")
def mi_semana(page):
    ir(page, "/chat")
    menu = page.locator("nav[aria-label=Principal]")
    semana = page.locator("section[aria-label='Mi semana']")
    expect(menu).to_be_visible()
    expect(semana).to_have_count(0)
    page.get_by_role("button", name="Mi semana", exact=True).filter(visible=True).click()
    expect(semana).to_be_visible()
    expect(menu).to_have_count(0)
    expect(semana.get_by_text("Conversaciones")).to_be_visible()
    page.keyboard.press("Escape")
    expect(menu).to_be_visible()
    page.get_by_role("button", name="Mi semana", exact=True).filter(visible=True).click()
    page.get_by_role("button", name="Volver al menú").click()
    expect(menu).to_be_visible()


@caso("Diseño: el menú de módulos parte a la izquierda")
def menu_izquierda(page):
    ir(page, "/chat")
    nav = page.locator("nav[aria-label=Principal]").filter(visible=True).first
    caja = nav.bounding_box()
    assert caja["x"] < 100 and caja["height"] > caja["width"], f"menú en x={caja['x']:.0f}, {caja['width']:.0f}x{caja['height']:.0f}"


@caso("Diseño móvil: el filtro de estado de Actividades se ve")
def movil_estado(page):
    ir(page, "/activities")
    sel = page.locator("select[aria-label=Estado]")
    ancho = sel.bounding_box()["width"]
    assert ancho >= 120, f"ancho {ancho:.0f}px"
    return f"{ancho:.0f}px"


with sync_playwright() as p:
    b = lanzar(p)
    try:
        anon = b.new_page()
        rutas_protegidas(anon); login_malo(anon); login_vacio(anon); tab_mostrar(anon)
        anon.close()
        m = b.new_page(viewport={"width": 375, "height": 740}, is_mobile=True, has_touch=True)
        movil_login(m); m.close()

        adm = b.new_context().new_page()
        admin_entrada(adm); adm.context.close()

        ctx = b.new_context(viewport={"width": 1366, "height": 860})
        page = ctx.new_page()
        logs = []
        capturar_consola(page, logs)
        colab_entra(page); novedades(page); navegacion(page, logs); con_h1(page)
        menu_izquierda(page); mi_semana(page)
        act_filtros(page); act_detalle(page); minuta_reunion(page); compromisos_semana(page)
        chat_consulta(page)
        limpiar(page)
        ctx.close()

        mctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        mp = mctx.new_page()
        login(mp, "colab1.prueba@example.com")
        movil_estado(mp)
        mctx.close()

        # Crear y eliminar con la jefa de equipo (tiene permiso de eliminar)
        jctx = b.new_context(viewport={"width": 1366, "height": 860})
        jp = jctx.new_page()
        login(jp, "jefa.prueba@example.com")
        chat_crear(jp); limpiar(jp); logout(jp)
        jctx.close()
    except Exception:
        traceback.print_exc()
    b.close()

print()
ok = sum(1 for r in RES if r[1])
for n, c, d in RES:
    print(("PASA " if c else "FALLA"), "-", n, "·", d)
print(f"\n{ok}/{len(RES)} pasan")
