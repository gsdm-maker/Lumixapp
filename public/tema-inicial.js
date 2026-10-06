// Aplica el tema y el acento ANTES de que cargue React, para que no se vea un destello del tema
// equivocado al abrir la app.
//
// Vive en un archivo y no inline en index.html por la misma razon que registrar-sw.js: la CSP no
// permite scripts inline. Debe usar las mismas claves y valores que src/core/theme/apariencia.ts.
;(function () {
  var tema = 'light'
  var acento = 'petroleo'
  try {
    var t = localStorage.getItem('lumix-tema')
    var a = localStorage.getItem('lumix-acento')
    if (t === 'dark') tema = 'dark'
    else if (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      tema = 'dark'
    if (a === 'indigo' || a === 'azul') acento = a
  } catch (e) {
    /* almacenamiento bloqueado: quedan los defaults */
  }
  document.documentElement.setAttribute('data-theme', tema)
  document.documentElement.setAttribute('data-accent', acento)
})()
