// Páginas del WordPress que NO son contenido para el público (técnicas, internas o de prueba).
// No se muestran en "Lo más consultado" ni en "Lo que casi nadie mira".
// Si aparece en el tablero una página que no debería, agregá acá una parte de su dirección.

export const PAGINAS_EXCLUIDAS: RegExp[] = [
  /prueba|copy|test|borrador/, // pruebas y copias
  /-ifr(-|\/|$)|^\/ifr/, // páginas "ifr": gráficos que se incrustan dentro de otras páginas
  /carga-interna/, // formularios de carga interna
  /login-customizer/,
  /event-directory/,
  /wp-file-download-search/,
  /pagina-generica/,
  /nuevapagina/,
  /^\/exp[a-z]/, // páginas experimentales (ExpPBG, etc.)
  /^\/\d+(-\d+)?\/$/, // páginas sin nombre (por ejemplo /7743-2/)
]

export function esPaginaExcluida(ruta: string, titulo = '') {
  return !titulo.trim() || PAGINAS_EXCLUIDAS.some((re) => re.test(ruta))
}
