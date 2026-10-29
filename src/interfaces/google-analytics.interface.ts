// Tipos internos para consultar Google Analytics (no salen al tablero)

import type { protos } from '@google-analytics/data'

// Filtro de Google Analytics (por ejemplo: solo el evento de descarga, o solo ciertas horas)
export type FiltroGA = protos.google.analytics.data.v1beta.IFilterExpression

export interface ConsultaGA {
  dimensiones?: string[]
  metricas: string[]
  conAnterior?: boolean // también trae el período anterior (para comparar)
  filtro?: FiltroGA
  ordenarPor?: string // métrica por la que se ordena de mayor a menor
  hastaHora?: number // solo cuenta las horas 00 a hastaHora (para comparar "hoy" con "ayer a la misma hora")
  limite?: number
}

// Una fila del informe, ya convertida a textos y números
export interface FilaGA {
  dims: string[]
  mets: number[]
  rango: number // 0 = período actual, 1 = período anterior
}
