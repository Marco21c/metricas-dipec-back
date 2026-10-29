import type { CorsOptions } from 'cors'
import { env } from './env'

// Direcciones del tablero que pueden consultar esta API (separadas por coma en FRONTEND_URL),
// por ejemplo: FRONTEND_URL=http://localhost:5174,https://metricas.dipec.jujuy.gob.ar
export const origenesPermitidos = env.frontendUrl
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

// Solo el tablero puede consultar esta API (y el WebSocket), enviando la cookie de sesión
export const corsOptions: CorsOptions = {
  origin: origenesPermitidos,
  credentials: true,
}
