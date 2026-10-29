import { readFileSync } from 'node:fs'
import { Sequelize } from 'sequelize'
import { env } from '../config/env'

// Conexión cifrada (Supabase la exige; la base local de Docker no).
// Se verifica el certificado del servidor con la CA de Supabase:
//   DATABASE_SSL_CA=ruta/al/archivo.crt  (Supabase → Project Settings → Database → SSL → Download certificate)
// Sin ese archivo, DATABASE_SSL=true usa las autoridades públicas del sistema.
function opcionesSsl() {
  const ca = process.env.DATABASE_SSL_CA?.trim()
  if (ca) return { ssl: { ca: readFileSync(ca, 'utf8') } }
  if (process.env.DATABASE_SSL === 'true') return { ssl: true }
  return {}
}

// Conexión a Postgres (DATABASE_URL). Por ahora solo guarda los usuarios del tablero.
export const sequelize = new Sequelize(env.databaseUrl || 'postgres://localhost:5432/metricas_dipec', {
  dialect: 'postgres',
  logging: false,
  dialectOptions: opcionesSsl(),
})
