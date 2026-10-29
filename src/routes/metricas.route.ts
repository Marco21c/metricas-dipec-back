import { Router } from 'express'
import { requiereSesion } from '../auth/middleware'
import { getEnVivo, getResumen } from '../controller/metricas.controller'

const router = Router()

// Solo con sesión iniciada
router.get('/metricas/resumen', requiereSesion, getResumen)
router.get('/metricas/en-vivo', requiereSesion, getEnVivo)

export default router
