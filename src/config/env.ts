// Variables de entorno en un solo lugar

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5175',
  jwtSecret: process.env.JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  wordpressUrl: process.env.WORDPRESS_URL ?? 'https://dipec.jujuy.gob.ar',
  isProduction: process.env.NODE_ENV === 'production',

  // Google Analytics 4
  ga: {
    propertyId: (process.env.GA_PROPERTY_ID ?? '').trim(),
    clientEmail: (process.env.GA_CLIENT_EMAIL ?? '').trim(),
    // En el .env la clave va en una sola línea con "\n": acá se convierten en saltos de línea reales
    privateKey: (process.env.GA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim(),
    // El plugin WP File Download registra cada descarga como evento "Download"
    // y guarda la dirección del archivo en "event_label".
    // (Si la página nueva usa la medición estándar de Google: "file_download" y "linkUrl")
    eventoDescarga: process.env.GA_EVENTO_DESCARGA ?? 'Download',
    dimensionArchivo: process.env.GA_DIMENSION_ARCHIVO ?? 'customEvent:event_label',
  },

  // Categoría de WordPress de las noticias (el resto de las entradas no cuenta como noticia)
  categoriaNoticias: process.env.WP_CATEGORIA_NOTICIAS ?? 'noticias',
}

// Qué datos de Google Analytics faltan completar (vacío = está todo)
export function faltantesGoogle() {
  const faltan: string[] = []
  if (!env.ga.propertyId) faltan.push('GA_PROPERTY_ID')
  if (!env.ga.clientEmail) faltan.push('GA_CLIENT_EMAIL')
  if (!env.ga.privateKey) faltan.push('GA_PRIVATE_KEY')
  return faltan
}
