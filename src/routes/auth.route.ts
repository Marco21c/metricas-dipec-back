import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, logout, me } from '../controller/auth.controller'

const router = Router()

// Contra quien prueba contraseñas: 10 intentos fallidos por IP cada 15 minutos.
// Solo cuentan los 401 (un ingreso correcto o un error del servidor no suman).
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Probá de nuevo en 15 minutos.' },
})

router.post('/auth/login', limiteLogin, login)
router.post('/auth/logout', logout)
router.get('/auth/me', me)

export default router
