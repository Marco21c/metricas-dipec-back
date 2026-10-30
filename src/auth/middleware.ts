import type { NextFunction, Request, Response } from 'express'
import { usuarioDeTokenService } from '../services/usuario.service'
import { responderError } from '../utils/errores'
import { NOMBRE_COOKIE } from './jwt'

// Exige una sesión válida; si no, 401
export const requiereSesion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sesion = await usuarioDeTokenService(req.cookies?.[NOMBRE_COOKIE])
    if (!sesion) {
      res.status(401).json({ ok: false, message: 'Sesión no iniciada o vencida' })
      return
    }
    res.locals.usuario = sesion.usuario
    next()
  } catch (error) {
    responderError(res, error, 'No se pudo comprobar la sesión')
  }
}
