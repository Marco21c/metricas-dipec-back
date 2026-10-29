import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { Sequelize } from 'sequelize'
import { env } from '../config/env'

// Certificado de Supabase (Database → SSL Configuration → Download certificate) para verificar
// la conexión cifrada. DATABASE_SSL_CA acepta:
//   - el CONTENIDO del certificado (-----BEGIN CERTIFICATE----- ...): lo recomendado en Vercel y similares,
//     donde los archivos sueltos del proyecto no se suben
//   - o la ruta a un archivo .crt (relativa a la carpeta del proyecto), cómodo en local
function certificado(valor: string) {
  // En una sola línea con "\n" escritos a mano → saltos de línea reales
  const texto = valor.replace(/\\n/g, '\n')
  if (texto.includes('-----BEGIN CERTIFICATE-----')) return texto
  const ruta = resolve(process.cwd(), texto)
  if (!existsSync(ruta)) {
    throw new Error(`DATABASE_SSL_CA: no se encontró el archivo "${texto}". En el servidor, poné el contenido del certificado en la variable en vez de la ruta.`)
  }
  return readFileSync(ruta, 'utf8')
}

// Conexión cifrada (Supabase la exige; la base local de Docker no).
// Sin certificado, DATABASE_SSL=true usa las autoridades públicas del sistema.
function opcionesSsl() {
  const ca = process.env.DATABASE_SSL_CA?.trim()
  if (ca) return { ssl: { ca: certificado(ca) } }
  if (process.env.DATABASE_SSL === 'true') return { ssl: true }
  return {}
}

// Conexión a Postgres (DATABASE_URL). Por ahora solo guarda los usuarios del tablero.
export const sequelize = new Sequelize(env.databaseUrl || 'postgres://localhost:5432/metricas_dipec', {
  dialect: 'postgres',
  // Se pasa "pg" explícitamente: si no, Vercel no lo incluye al empaquetar ("Please install pg package manually")
  dialectModule: pg,
  logging: false,
  dialectOptions: opcionesSsl(),
  // Conexiones sin uso se cierran pronto: la red (VPN, pooler de Supabase) suele cortarlas
  // y reusarlas daba "ECONNRESET"
  pool: { max: 5, min: 0, idle: 10_000, evict: 10_000, acquire: 20_000 },
  // Si igual se corta una conexión, se reintenta la consulta antes de dar error
  retry: { max: 3, match: [/ECONNRESET/, /ETIMEDOUT/, /EPIPE/, /Connection terminated/, /SequelizeConnectionError/] },
})
