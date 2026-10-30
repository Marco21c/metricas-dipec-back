import { env } from '../config/env'
import type { Parte } from '../interfaces/metricas.interface'

// Dirección sin dominio, en minúsculas y con "/" final, para comparar Google Analytics con WordPress
export function normalizarRuta(urlORuta: string) {
  let ruta = urlORuta
  try {
    ruta = new URL(urlORuta, env.wordpressUrl).pathname
  } catch {
    /* ya era una ruta */
  }
  ruta = decodeURI(ruta).toLowerCase()
  return ruta.endsWith('/') || /\.[a-z0-9]{2,5}$/.test(ruta) ? ruta : ruta + '/'
}

// Quita etiquetas HTML y entidades (&#8211; → –) de los títulos de WordPress
export function limpiarHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim()
}

// Quita solo el sufijo con el nombre del sitio, sin tocar el resto del título:
//   'Índice de Precios al Consumidor – DiPEC'          → 'Índice de Precios al Consumidor'
//   'Censo 2022 – Cuadros Resultados Definitivos (Jujuy)' → se mantiene igual
export function limpiarTituloPagina(titulo: string, ruta = '') {
  if (ruta === '/') return 'Inicio'
  const limpio = titulo.replace(/\s+[–|-]\s+DiPEC(\s+Jujuy)?\s*$/i, '').trim()
  return limpio || titulo.trim()
}

// ¿La dirección es del sitio de la DiPEC (o de un subdominio)?
function esDelSitio(url: string) {
  try {
    const sitio = new URL(env.wordpressUrl).hostname.replace(/^www\./, '')
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === sitio || host.endsWith(`.${sitio}`)
  } catch {
    return false
  }
}

// Datos de un archivo a partir de su dirección:
// "dipec.jujuy.gob.ar/download/262/mapas/5969/mapa-fisico-de-jujuy.pdf"
//   → { nombre: "Mapa fisico de jujuy", formato: "pdf", url: "https://dipec.jujuy.gob.ar/download/…" }
export function datosArchivo(direccion: string) {
  const completa = /^https?:\/\//.test(direccion) ? direccion : `https://${direccion.replace(/^\/+/, '')}`
  // A Google Analytics cualquiera le puede mandar datos falsos: solo se enlazan archivos del sitio,
  // así el tablero nunca muestra un enlace a otro dominio (los demás se listan sin enlace)
  const url = esDelSitio(completa) ? completa : ''
  let archivo = direccion
  try {
    archivo = decodeURIComponent(new URL(completa).pathname.split('/').filter(Boolean).pop() ?? direccion)
  } catch {
    /* se usa el texto tal cual */
  }
  // Google guarda como máximo 100 caracteres: las direcciones largas llegan cortadas
  // (por ejemplo "…ecorregiones-de-jujuy.pd" o "…c2022_jujuy_est_c1_")
  const cortada = direccion.length >= 99
  let formato = (archivo.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? '').toLowerCase()
  if (cortada) formato = completarFormato(formato)

  const base = archivo
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const nombre = base.charAt(0).toUpperCase() + base.slice(1) + (cortada && !formato ? '…' : '')
  return { nombre, formato, url }
}

// Completa un formato cortado: "pd" → "pdf", "xl" → "xlsx"
function completarFormato(parcial: string) {
  if (!parcial) return ''
  const conocidos = ['pdf', 'xlsx', 'xls', 'csv', 'zip', 'docx', 'doc', 'kmz', 'shp']
  return conocidos.find((f) => f.startsWith(parcial)) ?? parcial
}

// Convierte cantidades en porcentajes enteros (omite las partes en 0)
export function aPorcentajes(items: { label: string; cantidad: number }[]): Parte[] {
  const total = items.reduce((a, i) => a + i.cantidad, 0) || 1
  return items.filter((i) => i.cantidad > 0).map((i) => ({ label: i.label, value: Math.round((i.cantidad / total) * 100) }))
}
