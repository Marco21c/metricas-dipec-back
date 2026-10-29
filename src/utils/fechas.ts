import type { DiasPeriodo, Periodo } from '../interfaces/metricas.interface'

export const NOMBRES_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// "AAAA-MM-DD" en hora local
export function isoDia(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function sumarDias(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// "20261023" (formato de Google) → "2026-10-23"
export const desdeFechaGA = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`

// El período termina HOY (el día en curso, con los datos que Google ya procesó).
// El período anterior es el mismo tramo de días justo antes.
export function calcularPeriodo(dias: DiasPeriodo, hoy = fechaArgentina()): Periodo {
  const desde = sumarDias(hoy, -(dias - 1))
  const anteriorHasta = sumarDias(desde, -1)
  const anteriorDesde = sumarDias(anteriorHasta, -(dias - 1))
  return {
    dias,
    desde: isoDia(desde),
    hasta: isoDia(hoy),
    anteriorDesde: isoDia(anteriorDesde),
    anteriorHasta: isoDia(anteriorHasta),
    incluyeHoy: true,
    hastaHora: dias === 1 ? horaArgentina() : null,
  }
}

// Todas las fechas "AAAA-MM-DD" entre desde y hasta (incluidas)
export function diasEntre(desde: string, hasta: string) {
  const out: string[] = []
  for (let d = new Date(desde + 'T00:00:00'); d <= new Date(hasta + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
    out.push(isoDia(d))
  }
  return out
}

// Índice con lunes = 0 (getDay() de JavaScript empieza en domingo)
export function indiceLunes(fecha: string) {
  return (new Date(fecha + 'T00:00:00').getDay() + 6) % 7
}

// Busca las 2 horas seguidas con más visitas
export function mejorFranja(porHora: number[]): { desde: number; hasta: number } {
  let mejor = 0
  for (let h = 1; h < 23; h++) {
    if (porHora[h] + porHora[h + 1] > porHora[mejor] + porHora[mejor + 1]) mejor = h
  }
  return { desde: mejor, hasta: mejor + 2 }
}

// Hora y fecha en Argentina (la del sitio), aunque el servidor esté en otra zona horaria
const ZONA = 'America/Argentina/Jujuy'
export function horaArgentina(ahora = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: ZONA }).format(ahora))
}
export function fechaArgentina(ahora = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora).split('-').map(Number)
  return new Date(y, m - 1, d)
}
