// Única parte del backend que habla con Google Analytics 4 (API "Google Analytics Data").
// Devuelve filas simples; armar el resumen para el tablero es tarea de metricas.service.

import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { env, faltantesGoogle } from '../config/env'
import type { ConsultaGA, FilaGA, FiltroGA } from '../interfaces/google-analytics.interface'
import type { DiasPeriodo } from '../interfaces/metricas.interface'
import { ErrorApi } from '../utils/errores'
import { calcularPeriodo } from '../utils/fechas'

// Filtro para contar solo las descargas de archivos (el nombre del evento se configura en el .env)
export const SOLO_DESCARGAS: FiltroGA = { filter: { fieldName: 'eventName', stringFilter: { value: env.ga.eventoDescarga } } }

let cliente: BetaAnalyticsDataClient | null = null

// Crea el cliente la primera vez; si faltan datos en el .env, avisa cuáles
function obtenerCliente() {
  const faltan = faltantesGoogle()
  if (faltan.length) {
    throw new ErrorApi(`Google Analytics no está configurado. Completar en el .env: ${faltan.join(', ')}`, 503)
  }
  cliente ??= new BetaAnalyticsDataClient({
    credentials: { client_email: env.ga.clientEmail, private_key: env.ga.privateKey },
  })
  return cliente
}

const propiedad = () => `properties/${env.ga.propertyId}`

// Google permite hasta 10 consultas simultáneas por propiedad: se hacen de a 4 como máximo
const MAX_SIMULTANEAS = 4
let enCurso = 0
const enEspera: (() => void)[] = []

async function deAPocas<T>(tarea: () => Promise<T>): Promise<T> {
  if (enCurso >= MAX_SIMULTANEAS) await new Promise<void>((listo) => enEspera.push(listo))
  enCurso++
  try {
    return await tarea()
  } finally {
    enCurso--
    enEspera.shift()?.()
  }
}

// Solo las horas 0 a 'hasta' (para comparar "hoy" con "ayer hasta la misma hora")
function filtroHasta(hasta?: number): FiltroGA | undefined {
  if (hasta === undefined) return undefined
  // Todavía no hay ninguna hora procesada hoy: un valor que no coincide con nada (todo da 0)
  if (hasta < 0) return { filter: { fieldName: 'hour', inListFilter: { values: ['-1'] } } }
  // Google guarda la hora como texto sin cero adelante ("9"); se incluyen las dos formas por las dudas
  const horas = Array.from({ length: hasta + 1 }, (_, h) => [String(h), String(h).padStart(2, '0')]).flat()
  return { filter: { fieldName: 'hour', inListFilter: { values: horas } } }
}

function combinarFiltros(...filtros: (FiltroGA | undefined)[]): FiltroGA | undefined {
  const validos = filtros.filter((f): f is FiltroGA => !!f)
  if (validos.length <= 1) return validos[0]
  return { andGroup: { expressions: validos } }
}

// Ejecuta un informe para el período elegido (y opcionalmente el anterior)
export async function consultarInforme(dias: DiasPeriodo, c: ConsultaGA): Promise<FilaGA[]> {
  const p = calcularPeriodo(dias)
  const dateRanges = [{ startDate: p.desde, endDate: p.hasta }]
  if (c.conAnterior) dateRanges.push({ startDate: p.anteriorDesde, endDate: p.anteriorHasta })

  const [res] = await deAPocas(() =>
    obtenerCliente().runReport(
      {
        property: propiedad(),
        dateRanges,
        dimensions: (c.dimensiones ?? []).map((name) => ({ name })),
        metrics: c.metricas.map((name) => ({ name })),
        dimensionFilter: combinarFiltros(c.filtro, filtroHasta(c.hastaHora)),
        orderBys: c.ordenarPor ? [{ metric: { metricName: c.ordenarPor }, desc: true }] : undefined,
        limit: c.limite,
      },
      { timeout: 120_000 }, // los informes de un año pueden tardar más
    ),
  )

  // Con dos períodos, Google agrega una dimensión "dateRange" (date_range_0 / date_range_1)
  const nombres = (res.dimensionHeaders ?? []).map((h) => h.name)
  const iRango = nombres.indexOf('dateRange')
  return (res.rows ?? []).map((row) => {
    const dims = (row.dimensionValues ?? []).map((d) => d.value ?? '')
    return {
      dims: iRango >= 0 ? dims.filter((_, i) => i !== iRango) : dims,
      mets: (row.metricValues ?? []).map((m) => Number(m.value ?? 0)),
      rango: iRango >= 0 && dims[iRango] === 'date_range_1' ? 1 : 0,
    }
  })
}

// Tiempo real:
// - activos: personas DISTINTAS en los últimos 5 minutos (si alguien estuvo los 5 minutos, cuenta 1 vez)
// - porMinuto: personas activas en cada uno de los últimos 30 minutos (índice 0 = hace 29 min, 29 = ahora)
export async function consultarTiempoReal(): Promise<{ activos: number; porMinuto: number[] }> {
  const cliente = obtenerCliente()
  const [[ultimos5], [detalle]] = await Promise.all([
    cliente.runRealtimeReport({
      property: propiedad(),
      metrics: [{ name: 'activeUsers' }],
      minuteRanges: [{ startMinutesAgo: 4, endMinutesAgo: 0 }],
    }),
    cliente.runRealtimeReport({
      property: propiedad(),
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  const porMinuto = Array(30).fill(0)
  for (const row of detalle.rows ?? []) {
    const hace = Number(row.dimensionValues?.[0]?.value ?? 99)
    if (hace < 30) porMinuto[29 - hace] = Number(row.metricValues?.[0]?.value ?? 0)
  }
  const activos = Number(ultimos5.rows?.[0]?.metricValues?.[0]?.value ?? 0)
  return { activos, porMinuto }
}
