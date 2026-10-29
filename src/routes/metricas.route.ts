import { Router } from 'express'
import { getEnVivo, getResumen } from '../controller/metricas.controller'

const router = Router()

router.get('/metricas/resumen', getResumen)
router.get('/metricas/en-vivo', getEnVivo)

export default router
