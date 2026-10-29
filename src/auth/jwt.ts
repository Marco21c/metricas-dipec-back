import jwt from 'jsonwebtoken'
import type { CookieOptions } from 'express'
import { env } from '../config/env'

export interface DatosToken {
  sub: string // id del usuario
  tv: number // token_version: si cambia en la base, la sesión deja de valer
  exp?: number
}

export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60 // una jornada de trabajo

// Nombre propio: en localhost las cookies se comparten entre puertos (otros sistemas de la DiPEC)
export const NOMBRE_COOKIE = 'metricas_sesion'

export const secretoValido = () => env.jwtSecret.length >= 32

const secreto = () => {
  if (!secretoValido()) throw new Error('JWT_SECRET no está configurado (o tiene menos de 32 caracteres)')
  return env.jwtSecret
}

export const firmarToken = (datos: DatosToken) =>
  jwt.sign({ sub: datos.sub, tv: datos.tv }, secreto(), { expiresIn: DURACION_SESION_SEGUNDOS, algorithm: 'HS256' })

export const verificarToken = (token: string): DatosToken | null => {
  try {
    return jwt.verify(token, secreto(), { algorithms: ['HS256'] }) as unknown as DatosToken
  } catch {
    return null
  }
}

// La cookie no la puede leer JavaScript (httpOnly) y en producción solo viaja por HTTPS.
// En producción el tablero y el backend están en dominios distintos (por ejemplo, dos sitios de Render):
// SameSite=None permite que el navegador la envíe igual (exige Secure). En local alcanza con Lax.
export const opcionesCookie: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: DURACION_SESION_SEGUNDOS * 1000,
}

// Lee una cookie de la cabecera "Cookie" (para el WebSocket, que no pasa por cookie-parser)
export const leerCookie = (cabecera: string | undefined, nombre: string): string | undefined => {
  for (const parte of (cabecera ?? '').split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim())
      } catch {
        return undefined
      }
    }
  }
  return undefined
}
