// Caché en memoria con vencimiento.
// - Guarda la PROMESA: si llegan varias consultas iguales a la vez, se hace una sola a Google.
// - Si una consulta falla (Google caído, límite de consultas alcanzado), se devuelven
//   los ÚLTIMOS DATOS BUENOS en lugar del error. El error solo llega si nunca hubo datos.

interface Entrada<T> {
  vence: number
  valor: Promise<T>
}

const entradas = new Map<string, Entrada<unknown>>()
const ultimosBuenos = new Map<string, unknown>()

export function conCache<T>(clave: string, duracionMs: number, obtener: () => Promise<T>): Promise<T> {
  const actual = entradas.get(clave) as Entrada<T> | undefined
  if (actual && actual.vence > Date.now()) return actual.valor

  const valor = obtener()
    .then((dato) => {
      ultimosBuenos.set(clave, dato)
      return dato
    })
    .catch((error) => {
      entradas.delete(clave) // se reintenta en la próxima consulta
      if (ultimosBuenos.has(clave)) {
        console.warn(`[caché] Falló "${clave}", se usan los últimos datos buenos:`, error instanceof Error ? error.message : error)
        return ultimosBuenos.get(clave) as T
      }
      throw error
    })

  entradas.set(clave, { vence: Date.now() + duracionMs, valor })
  return valor
}

export function vaciarCache(prefijo = '') {
  for (const clave of entradas.keys()) if (clave.startsWith(prefijo)) entradas.delete(clave)
}
