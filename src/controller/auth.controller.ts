import type { Request, Response } from 'express'
import { NOMBRE_COOKIE, firmarToken, opcionesCookie } from '../auth/jwt'
import { datosDeSesion, usuarioDeTokenService, validarCredencialesService } from '../services/usuario.service'
import { responderError } from '../utils/errores'

// POST /auth/login { username, password } → cookie de sesión + datos del usuario
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = await validarCredencialesService(req.body?.username, req.body?.password)
    if (!usuario) {
      // Mismo mensaje para usuario inexistente, desactivado o contraseña incorrecta
      res.status(401).json({ ok: false, message: 'Usuario o contraseña incorrectos' })
      return
    }
    res.cookie(NOMBRE_COOKIE, firmarToken({ sub: usuario.id, tv: usuario.token_version }), opcionesCookie)
    res.json({ ok: true, data: datosDeSesion(usuario) })
  } catch (error) {
    responderError(res, error, 'No se pudo iniciar sesión')
  }
}

// POST /auth/logout → borra la cookie
export const logout = (_req: Request, res: Response): void => {
  const { maxAge: _maxAge, ...sinVencimiento } = opcionesCookie
  res.clearCookie(NOMBRE_COOKIE, sinVencimiento)
  res.json({ ok: true })
}

// GET /auth/me → usuario de la sesión, o null si no hay (el tablero no puede leer la cookie).
// "Sin sesión" es una respuesta normal (200), no un error: así la consola del navegador no
// muestra un 401 cada vez que se abre la pantalla de ingreso.
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const sesion = await usuarioDeTokenService(req.cookies?.[NOMBRE_COOKIE])
    res.json({ ok: true, data: sesion?.usuario ?? null })
  } catch (error) {
    responderError(res, error, 'No se pudo comprobar la sesión')
  }
}
