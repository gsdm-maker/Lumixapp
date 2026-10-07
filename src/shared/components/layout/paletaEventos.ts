// La paleta de comandos vive en AppLayout; cualquier boton la puede abrir con este evento, sin
// tener que pasar un callback por toda la app.
export const EVENTO_PALETA = 'lumix:paleta-comandos'

export function abrirPaletaDeComandos() {
  window.dispatchEvent(new Event(EVENTO_PALETA))
}
