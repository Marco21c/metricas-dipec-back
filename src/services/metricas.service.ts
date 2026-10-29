// Arma los datos del tablero a partir de Google Analytics y del WordPress.

import { env, faltantesGoogle } from '../config/env'
import type { FilaGA } from '../interfaces/google-analytics.interface'
import { PERIODOS_VALIDOS } from '../interfaces/metricas.interface'
import type { DiasPeriodo, EnVivo, Pagina, ResumenMetricas, Totales } from '../interfaces/metricas.interface'
import { conCache } from '../utils/cache'
import { ErrorApi } from '../utils/errores'
import { NOMBRES_DIAS, calcularPeriodo, desdeFechaGA, diasEntre, indiceLunes, mejorFranja } from '../utils/fechas'
import { esPaginaExcluida } from '../config/paginas-excluidas'
import { aPorcentajes, datosArchivo, limpiarTituloPagina, normalizarRuta } from '../utils/formato'
import { SOLO_DESCARGAS, consultarInforme, consultarTiempoReal } from './google-analytics.service'
import { ubicacionDe } from './geocodificacion.service'
import { obtenerContenidoDelSitio } from './wordpress.service'
import type { EntradaWP } from './wordpress.service'

// Cuánto se guarda cada dato. Un poco menos que el intervalo del WebSocket (60 s y 30 s),
// así cada vuelta trae datos nuevos de Google.
const CACHE_RESUMEN = 55 * 1000
const CACHE_EN_VIVO = 25 * 1000

const CANALES: Record<string, string> = {
  'Organic Search': 'Desde buscadores (Google u otros)',
  'Paid Search': 'Desde buscadores (Google u otros)',
  Direct: 'Entrando directo al sitio',
  'Organic Social': 'Desde redes sociales',
  'Paid Social': 'Desde redes sociales',
  Referral: 'Desde otros sitios',
}

// Cuántas páginas manda el backend para "Lo más consultado" y "Lo que casi nadie mira"
// (el tablero muestra 5 y abre una ventana con todas al tocar +)
const CANTIDAD_PAGINAS = 15

// Cuántos archivos y noticias manda el backend (el tablero muestra 5 y abre una ventana con todos)
const CANTIDAD_TOP = 10

const DISPOSITIVOS: Record<string, string> = { mobile: 'Celular', desktop: 'Computadora', tablet: 'Tablet' }

/* ================= Funciones públicas (las usa el controlador) ================= */

export function validarDias(valor: unknown): DiasPeriodo {
  const dias = Number(valor ?? 30)
  if (!(PERIODOS_VALIDOS as readonly number[]).includes(dias)) {
    throw new ErrorApi('El parámetro "dias" debe ser 1, 7, 30, 90 o 365', 400)
  }
  return dias as DiasPeriodo
}

// Si muchas personas miran a la vez, a Google le llega una sola consulta por minuto.
export function obtenerResumenService(dias: DiasPeriodo) {
  return conCache(`resumen:${dias}`, CACHE_RESUMEN, () => armarResumen(dias))
}

// Personas activas en los últimos minutos
export function obtenerEnVivoService(): Promise<EnVivo> {
  return conCache('en-vivo', CACHE_EN_VIVO, async () => {
    const { activos, porMinuto } = await consultarTiempoReal()
    return { actualizado: new Date().toISOString(), activos, porMinuto }
  })
}

// Al arrancar el servidor: avisa si falta configurar Google y precarga el período por defecto (30 días)
export async function precargarResumenesService() {
  const faltan = faltantesGoogle()
  if (faltan.length) {
    console.warn(`[métricas] Google Analytics sin configurar. Faltan en el .env: ${faltan.join(', ')}`)
    return
  }
  console.log(`[métricas] Consultando Google Analytics (propiedad ${env.ga.propertyId})...`)
  try {
    await obtenerResumenService(30)
    console.log('[métricas] Google Analytics responde correctamente')
  } catch (error) {
    console.error('[métricas] Google Analytics no respondió:', error instanceof Error ? error.message : error)
  }
}

/* ================= Armado del resumen ================= */

async function armarResumen(dias: DiasPeriodo): Promise<ResumenMetricas> {
  const q = (c: Parameters<typeof consultarInforme>[1]) => consultarInforme(dias, c)
  // En "hoy", ayer se cuenta solo hasta la ÚLTIMA HORA QUE GOOGLE YA PROCESÓ de hoy.
  // Google tarda en procesar las últimas horas: si se comparara hasta la hora actual,
  // hoy siempre parecería una caída.
  const hastaHora = dias === 1 ? await ultimaHoraProcesadaHoy() : undefined

  const [generales, descargas, porDia, descargasPorDia, porHora, descargasPorHora, nuevos, paginas, archivos, dispositivos, origen, ciudades, canales, sitio] =
    await Promise.all([
      q({ metricas: ['totalUsers', 'sessions', 'screenPageViews', 'averageSessionDuration'], conAnterior: true, hastaHora }),
      q({ metricas: ['eventCount'], filtro: SOLO_DESCARGAS, conAnterior: true, hastaHora }),
      q({ dimensiones: ['date'], metricas: ['sessions'] }),
      q({ dimensiones: ['date'], metricas: ['eventCount'], filtro: SOLO_DESCARGAS }),
      q({ dimensiones: ['hour'], metricas: ['sessions'] }),
      q({ dimensiones: ['hour'], metricas: ['eventCount'], filtro: SOLO_DESCARGAS }),
      q({ dimensiones: ['newVsReturning'], metricas: ['totalUsers'] }),
      q({ dimensiones: ['pagePath', 'pageTitle'], metricas: ['screenPageViews', 'totalUsers'], ordenarPor: 'screenPageViews', limite: 10000 }),
      q({ dimensiones: [env.ga.dimensionArchivo], metricas: ['eventCount'], filtro: SOLO_DESCARGAS, ordenarPor: 'eventCount', limite: 30 }), // de más, por si el mismo archivo viene repetido
      q({ dimensiones: ['deviceCategory'], metricas: ['totalUsers'] }),
      q({ dimensiones: ['country', 'region'], metricas: ['sessions'] }),
      q({ dimensiones: ['city', 'region', 'country'], metricas: ['sessions'], ordenarPor: 'sessions', limite: 50 }),
      q({ dimensiones: ['sessionDefaultChannelGroup'], metricas: ['sessions'] }),
      // Si WordPress no responde, se sigue sin la lista (solo se pierden las páginas con 0 visitas)
      obtenerContenidoDelSitio().catch(() => ({ paginas: [] as EntradaWP[], noticias: [] as EntradaWP[] })),
    ])

  const periodo = { ...calcularPeriodo(dias), hastaHora: hastaHora ?? null }
  const serie = armarSerieDiaria(periodo.desde, periodo.hasta, porDia, descargasPorDia)
  const mejorDia = serie.reduce((a, d) => (d.visitas > a.visitas ? d : a), serie[0])
  const { masVistas, menosVistas, noticias } = armarPaginas(paginas, sitio)

  return {
    actualizado: new Date().toISOString(),
    periodo,
    totales: { actual: armarTotales(generales, descargas, 0), anterior: armarTotales(generales, descargas, 1) },
    porDia: serie,
    porHora: armarPorHora(porHora, descargasPorHora, periodo.hastaHora),
    diaConMasVisitas: { fecha: mejorDia.fecha, visitas: mejorDia.visitas },
    diasDeLaSemana: armarDiasDeLaSemana(serie),
    horarioPico: armarHorarioPico(porHora),
    personasQueVuelven: armarPersonasQueVuelven(nuevos),
    paginasMasVistas: masVistas,
    paginasMenosVistas: menosVistas,
    archivosMasDescargados: armarArchivos(archivos),
    noticiasMasLeidas: noticias,
    dispositivos: aPorcentajes(
      Object.entries(DISPOSITIVOS).map(([clave, label]) => ({
        label,
        cantidad: dispositivos.find((f) => f.dims[0] === clave)?.mets[0] ?? 0,
      })),
    ),
    origen: armarOrigen(origen),
    ciudades: armarCiudades(ciudades),
    comoLlegan: armarComoLlegan(canales),
  }
}

// Totales de un período (0 = actual, 1 = anterior)
function armarTotales(generales: FilaGA[], descargas: FilaGA[], rango: number): Totales {
  const g = generales.find((f) => f.rango === rango)?.mets ?? [0, 0, 0, 0]
  return {
    visitantes: g[0],
    visitas: g[1],
    paginas: g[2],
    duracion: Math.round(g[3]),
    descargas: descargas.find((f) => f.rango === rango)?.mets[0] ?? 0,
  }
}

// Google omite los días sin datos: se completan con 0
function armarSerieDiaria(desde: string, hasta: string, visitas: FilaGA[], descargas: FilaGA[]) {
  const v = new Map(visitas.map((f) => [desdeFechaGA(f.dims[0]), f.mets[0]]))
  const d = new Map(descargas.map((f) => [desdeFechaGA(f.dims[0]), f.mets[0]]))
  return diasEntre(desde, hasta).map((fecha) => ({ fecha, visitas: v.get(fecha) ?? 0, descargas: d.get(fecha) ?? 0 }))
}

function armarDiasDeLaSemana(serie: { fecha: string; visitas: number }[]) {
  const suma = Array(7).fill(0)
  const cuenta = Array(7).fill(0)
  for (const d of serie) {
    suma[indiceLunes(d.fecha)] += d.visitas
    cuenta[indiceLunes(d.fecha)]++
  }
  return NOMBRES_DIAS.map((dia, i) => ({ dia, promedio: cuenta[i] ? Math.round(suma[i] / cuenta[i]) : 0 }))
}

// Última hora de hoy con visitas ya procesadas por Google (-1 si todavía no hay ninguna).
// Nunca pasa de la hora actual.
async function ultimaHoraProcesadaHoy() {
  const filas = await consultarInforme(1, { dimensiones: ['hour'], metricas: ['sessions'] })
  const conDatos = filas.filter((f) => f.mets[0] > 0).map((f) => Number(f.dims[0]))
  const ultima = conDatos.length ? Math.max(...conDatos) : -1
  return Math.min(ultima, calcularPeriodo(1).hastaHora ?? 23)
}

// Visitas y descargas por hora del día (en 'hoy' solo hasta la última hora procesada)
function armarPorHora(visitas: FilaGA[], descargas: FilaGA[], hastaHora: number | null) {
  const v = new Map(visitas.map((f) => [Number(f.dims[0]), f.mets[0]]))
  const d = new Map(descargas.map((f) => [Number(f.dims[0]), f.mets[0]]))
  return Array.from({ length: hastaHora === null ? 24 : Math.max(0, hastaHora + 1) }, (_, hora) => ({ hora, visitas: v.get(hora) ?? 0, descargas: d.get(hora) ?? 0 }))
}

function armarHorarioPico(porHora: FilaGA[]) {
  const horas = Array(24).fill(0)
  for (const f of porHora) horas[Number(f.dims[0])] = f.mets[0]
  return mejorFranja(horas)
}

function armarPersonasQueVuelven(nuevos: FilaGA[]) {
  const vuelven = nuevos.find((f) => f.dims[0] === 'returning')?.mets[0] ?? 0
  const total = nuevos.filter((f) => f.dims[0] !== '(not set)').reduce((a, f) => a + f.mets[0], 0)
  return total ? vuelven / total : 0
}

// Separa noticias del resto y cruza con la lista de WordPress (para incluir páginas con 0 visitas)
function armarPaginas(filas: FilaGA[], sitio: { paginas: EntradaWP[]; noticias: EntradaWP[] }) {
  // Títulos reales del WordPress (los de Google a veces vienen cortados o repetidos)
  const tituloWP = new Map([...sitio.paginas, ...sitio.noticias].map((e) => [e.ruta, e.titulo]))

  // WordPress abre la misma página con una dirección corta (/cartografia-provincial/)
  // y con la completa (/cartografia-y-sig/cartografia-provincial/): se cuentan como UNA sola.
  const porNombreCorto = new Map<string, string | null>()
  for (const e of [...sitio.paginas, ...sitio.noticias]) {
    const corto = e.ruta.split('/').filter(Boolean).pop() ?? ''
    porNombreCorto.set(corto, porNombreCorto.has(corto) ? null : e.ruta) // null = nombre repetido, no se une
  }
  const rutaReal = (ruta: string) => {
    if (tituloWP.has(ruta)) return ruta
    const corto = ruta.split('/').filter(Boolean).pop() ?? ''
    return porNombreCorto.get(corto) ?? ruta
  }

  const vistasPorRuta = new Map<string, Pagina>()
  for (const f of filas) {
    const ruta = rutaReal(normalizarRuta(f.dims[0]))
    if (esPaginaExcluida(ruta, f.dims[1])) continue // páginas técnicas o internas
    const previa = vistasPorRuta.get(ruta)
    vistasPorRuta.set(ruta, {
      titulo: previa?.titulo ?? limpiarTituloPagina(tituloWP.get(ruta) ?? f.dims[1], ruta),
      url: env.wordpressUrl + ruta,
      visitas: (previa?.visitas ?? 0) + f.mets[0],
      visitantes: (previa?.visitantes ?? 0) + f.mets[1],
    })
  }

  const rutasNoticias = new Set(sitio.noticias.map((n) => n.ruta))
  const masVistas = [...vistasPorRuta.entries()]
    .filter(([ruta]) => !rutasNoticias.has(ruta))
    .map(([, p]) => p)
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, CANTIDAD_PAGINAS)

  const candidatas: Pagina[] = sitio.paginas.length
    ? sitio.paginas.map((wp) => vistasPorRuta.get(wp.ruta) ?? { titulo: limpiarTituloPagina(wp.titulo, wp.ruta), url: wp.url, visitas: 0, visitantes: 0 })
    : [...vistasPorRuta.values()]
  const menosVistas = candidatas.sort((a, b) => a.visitas - b.visitas).slice(0, CANTIDAD_PAGINAS)

  const noticias = sitio.noticias
    .map((n) => ({ titulo: n.titulo, url: n.url, lecturas: vistasPorRuta.get(n.ruta)?.visitas ?? 0 }))
    .filter((n) => n.lecturas > 0)
    .sort((a, b) => b.lecturas - a.lecturas)
    .slice(0, CANTIDAD_TOP)

  return { masVistas, menosVistas, noticias }
}

// Archivos más descargados (se juntan las descargas del mismo archivo)
function armarArchivos(filas: FilaGA[]) {
  const porUrl = new Map<string, { nombre: string; url: string; formato: string; descargas: number }>()
  for (const f of filas) {
    if (!f.dims[0] || f.dims[0] === '(not set)') continue
    const datos = datosArchivo(f.dims[0])
    const previo = porUrl.get(datos.url)
    porUrl.set(datos.url, { ...datos, descargas: (previo?.descargas ?? 0) + f.mets[0] })
  }
  return [...porUrl.values()].sort((a, b) => b.descargas - a.descargas).slice(0, CANTIDAD_TOP)
}

// Ciudades con más visitas y su ubicación para el mapa
function armarCiudades(filas: FilaGA[]) {
  return filas
    .filter((f) => f.dims[0] && f.dims[0] !== '(not set)')
    .slice(0, 40)
    .map((f) => {
      const [ciudad, region, pais] = f.dims
      const { estado, coords } = ubicacionDe(ciudad, region, pais)
      return { ciudad, region, pais, visitas: f.mets[0], lat: coords?.lat ?? null, lng: coords?.lng ?? null, ubicacion: estado }
    })
}

// Jujuy, otras provincias y otros países
function armarOrigen(filas: FilaGA[]) {
  let jujuy = 0
  let provincias = 0
  let paises = 0
  for (const f of filas) {
    if (f.dims[0] !== 'Argentina') paises += f.mets[0]
    else if (/jujuy/i.test(f.dims[1])) jujuy += f.mets[0]
    else provincias += f.mets[0]
  }
  return aPorcentajes([
    { label: 'Jujuy', cantidad: jujuy },
    { label: 'Otras provincias', cantidad: provincias },
    { label: 'Otros países', cantidad: paises },
  ])
}

// Se agrupan canales parecidos (búsqueda paga y orgánica, redes pagas y orgánicas)
function armarComoLlegan(filas: FilaGA[]) {
  const llegada = new Map<string, number>()
  for (const f of filas) {
    const label = CANALES[f.dims[0]] ?? 'Desde otros sitios'
    llegada.set(label, (llegada.get(label) ?? 0) + f.mets[0])
  }
  return aPorcentajes([...llegada.entries()].map(([label, cantidad]) => ({ label, cantidad })).sort((a, b) => b.cantidad - a.cantidad))
}
