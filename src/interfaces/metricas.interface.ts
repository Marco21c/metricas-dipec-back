// Contrato entre el backend y el tablero: el formato exacto que devuelve la API.
// Los datos salen de Google Analytics 4 y de la lista de páginas del WordPress.

// 1 = hoy (se compara con ayer hasta la misma hora)
export const PERIODOS_VALIDOS = [1, 7, 30, 90, 365] as const
export type DiasPeriodo = (typeof PERIODOS_VALIDOS)[number]

// Fechas en formato "AAAA-MM-DD"
export interface Periodo {
  dias: DiasPeriodo
  desde: string
  hasta: string
  anteriorDesde: string
  anteriorHasta: string
  incluyeHoy: boolean // el último día es hoy y todavía está en curso
  hastaHora: number | null // solo en "hoy": última hora ya procesada por Google; ayer se compara hasta esta hora (-1 = todavía sin datos)
}

export interface Totales {
  visitantes: number // personas distintas
  visitas: number // veces que se entró al sitio (sesiones)
  paginas: number // páginas consultadas
  descargas: number // archivos descargados
  duracion: number // segundos promedio por visita
}

export interface Parte {
  label: string
  value: number // porcentaje (0 a 100)
}

export interface Pagina {
  titulo: string
  url: string
  visitas: number
  visitantes: number
}

export interface Archivo {
  nombre: string // "Mapa físico de Jujuy"
  url: string // dirección del archivo
  formato: string // "pdf", "xlsx", "zip"…
  descargas: number
}

export interface Noticia {
  titulo: string
  url: string
  lecturas: number
}

export interface ResumenMetricas {
  actualizado: string // fecha y hora ISO de la consulta
  periodo: Periodo
  totales: { actual: Totales; anterior: Totales }
  porDia: { fecha: string; visitas: number; descargas: number }[]
  porHora: { hora: number; visitas: number; descargas: number }[] // total del período por hora del día (en "hoy": hasta la hora actual)
  diaConMasVisitas: { fecha: string; visitas: number }
  diasDeLaSemana: { dia: string; promedio: number }[] // lunes primero
  horarioPico: { desde: number; hasta: number } // horas, por ejemplo 10 a 12
  personasQueVuelven: number // proporción (0 a 1)
  paginasMasVistas: Pagina[]
  paginasMenosVistas: Pagina[]
  archivosMasDescargados: Archivo[]
  noticiasMasLeidas: Noticia[]
  dispositivos: Parte[]
  origen: Parte[]
  // Ciudades con más visitas (hasta 40, para el mapa). lat/lng = null si todavía no se ubicaron
  ciudades: {
    ciudad: string
    region: string
    pais: string
    visitas: number
    lat: number | null
    lng: number | null
    ubicacion: 'ok' | 'buscando' | 'no-existe'
  }[]
  comoLlegan: Parte[]
}

export interface EnVivo {
  actualizado: string
  activos: number // personas en los últimos 5 minutos
  porMinuto: number[] // últimos 30 minutos, del más viejo al más nuevo
}
