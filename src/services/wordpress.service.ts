// Lista de páginas y noticias del sitio, desde la API pública de WordPress (sin login).
// Google Analytics solo conoce las páginas que alguien visitó: cruzando con esta lista
// se detectan también las páginas con CERO visitas.

import { env } from '../config/env'
import { esPaginaExcluida } from '../config/paginas-excluidas'
import { conCache } from '../utils/cache'
import { limpiarHtml, normalizarRuta } from '../utils/formato'

// Cada 15 minutos: así una noticia o página nueva aparece en el tablero el mismo día
const CADA_15_MINUTOS = 15 * 60 * 1000

export interface EntradaWP {
  titulo: string
  ruta: string // "/indicadores-economicos/indice-de-precios-al-consumidor/"
  url: string
}

async function traerTodo(tipo: 'pages' | 'posts', maxPaginas: number, filtro = ''): Promise<EntradaWP[]> {
  const out: EntradaWP[] = []
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const res = await fetch(`${env.wordpressUrl}/wp-json/wp/v2/${tipo}?per_page=100&page=${pagina}&_fields=link,title${filtro}`)
    if (!res.ok) break
    const items = (await res.json()) as { link: string; title: { rendered: string } }[]
    for (const it of items) {
      out.push({ titulo: limpiarHtml(it.title.rendered), url: it.link, ruta: normalizarRuta(it.link) })
    }
    const totalPaginas = Number(res.headers.get('x-wp-totalpages') ?? 1)
    if (pagina >= totalPaginas) break
  }
  return out
}

// Número de la categoría de noticias (por su nombre corto, por ejemplo "noticias")
async function idCategoriaNoticias(): Promise<number | null> {
  const res = await fetch(`${env.wordpressUrl}/wp-json/wp/v2/categories?slug=${encodeURIComponent(env.categoriaNoticias)}&_fields=id`)
  if (!res.ok) return null
  const [categoria] = (await res.json()) as { id: number }[]
  return categoria?.id ?? null
}

// La lista se renueva cada 15 minutos (la consulta a WordPress es liviana)
export function obtenerContenidoDelSitio() {
  return conCache('wordpress', CADA_15_MINUTOS, async () => {
    const categoria = await idCategoriaNoticias()
    const [paginas, noticias] = await Promise.all([
      traerTodo('pages', 10),
      // Solo las entradas de la categoría de noticias (no los "operativos" u otras)
      categoria ? traerTodo('posts', 3, `&categories=${categoria}`) : Promise.resolve([]),
    ])
    return {
      paginas: paginas.filter((p) => !esPaginaExcluida(p.ruta, p.titulo)),
      noticias,
    }
  })
}
