// Coordenadas de las ciudades para el mapa del tablero.
// Google Analytics da el nombre de la ciudad, pero no dónde queda: se busca una sola vez
// en OpenStreetMap (Nominatim, gratis) y se guarda en un archivo para no volver a pedirla.
//
// Reglas de uso de Nominatim: como máximo 1 consulta por segundo e identificarse.
// Por eso las ciudades nuevas se buscan de a una, por detrás, sin demorar al tablero:
// si todavía no tiene coordenadas, aparecen en el mapa en la próxima actualización.

import fs from 'node:fs'
import path from 'node:path'

export interface Coordenadas {
  lat: number
  lng: number
}

const ARCHIVO = path.resolve(__dirname, '..', '..', 'data', 'coordenadas-ciudades.json')
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const IDENTIFICACION = 'metricas-dipec/1.0 (tablero de métricas de dipec.jujuy.gob.ar)'

// null = se buscó y no se encontró (no se vuelve a buscar mientras el servidor siga andando).
// Al reiniciar se descartan los null, así se reintentan.
let guardadas: Record<string, Coordenadas | null> = {}
try {
  const archivo = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) as Record<string, Coordenadas | null>
  guardadas = Object.fromEntries(Object.entries(archivo).filter(([, v]) => v !== null))
} catch {
  /* todavía no hay archivo */
}

const pendientes = new Map<string, { ciudad: string; region: string; pais: string }>()
let buscando = false

const clave = (ciudad: string, region: string, pais: string) => `${ciudad}|${region}|${pais}`.toLowerCase()

function guardar() {
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true })
  fs.writeFileSync(ARCHIVO, JSON.stringify(guardadas, null, 2))
}

// Google nombra las provincias en inglés y con sufijo ('Jujuy Province', 'State of Espirito Santo'):
// se dejan solo el nombre, que es como lo entiende OpenStreetMap
function limpiarRegion(region: string) {
  return region.replace(/\s+(Province|Prefecture|Department|Region)$/i, '').replace(/^(State|Province|Region) of\s+/i, '').trim()
}

async function consultarOSM(params: Record<string, string>): Promise<Coordenadas | null> {
  const res = await fetch(`${NOMINATIM}?${new URLSearchParams({ ...params, format: 'json', limit: '1' })}`, {
    headers: { 'User-Agent': IDENTIFICACION, 'Accept-Language': 'es' },
  })
  if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`)
  const [lugar] = (await res.json()) as { lat: string; lon: string }[]
  return lugar ? { lat: Number(lugar.lat), lng: Number(lugar.lon) } : null
}

// Ciudades que Google y OpenStreetMap nombran distinto (se agregan acá si alguna no aparece en el mapa)
const NOMBRE_EN_OSM: Record<string, string> = {
  'ciudad perico': 'Perico',
}

// Primero con ciudad, provincia y país; si no aparece, solo con ciudad y país
async function buscarEnOSM(nombre: string, region: string, pais: string): Promise<Coordenadas | null> {
  const ciudad = NOMBRE_EN_OSM[nombre.toLowerCase()] ?? nombre
  const conProvincia = await consultarOSM({ city: ciudad, state: limpiarRegion(region), country: pais })
  if (conProvincia) return conProvincia
  await new Promise((r) => setTimeout(r, 1100)) // respetar 1 consulta por segundo
  return consultarOSM({ city: ciudad, country: pais })
}

// Busca las ciudades pendientes de a una, con 1,1 segundos entre consultas
async function procesarPendientes() {
  if (buscando) return
  buscando = true
  try {
    for (const [k, c] of pendientes) {
      try {
        guardadas[k] = await buscarEnOSM(c.ciudad, c.region, c.pais)
        guardar()
      } catch (error) {
        console.warn(`[mapa] No se pudo ubicar ${c.ciudad}:`, error instanceof Error ? error.message : error)
      }
      pendientes.delete(k)
      await new Promise((r) => setTimeout(r, 1100))
    }
  } finally {
    buscando = false
  }
}

// Ubicación de una ciudad:
//   'ok'        → con coordenadas
//   'buscando'  → todavía no se buscó (queda pendiente y aparece en una próxima actualización)
//   'no-existe' → se buscó y OpenStreetMap no la conoce (por ejemplo, un código postal)
export function ubicacionDe(ciudad: string, region: string, pais: string): { estado: 'ok' | 'buscando' | 'no-existe'; coords: Coordenadas | null } {
  const k = clave(ciudad, region, pais)
  if (k in guardadas) return { estado: guardadas[k] ? 'ok' : 'no-existe', coords: guardadas[k] }
  if (!pendientes.has(k)) pendientes.set(k, { ciudad, region, pais })
  void procesarPendientes()
  return { estado: 'buscando', coords: null }
}
