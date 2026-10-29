import type { Request, Response } from 'express'
import { obtenerEnVivoService, obtenerResumenService, validarDias } from '../services/metricas.service'
import { responderError } from '../utils/errores'

// GET /metricas/resumen?dias=30   (dias: 7, 30, 90 o 365)
export const getResumen = async (req: Request, res: Response): Promise<void> => {
  try {
    const dias = validarDias(req.query.dias)
    const resultado = await obtenerResumenService(dias)
    res.status(200).json({ ok: true, data: resultado })
  } catch (error) {
    responderError(res, error, 'No se pudieron obtener las métricas')
  }
}

// GET /metricas/en-vivo
export const getEnVivo = async (_req: Request, res: Response): Promise<void> => {
  try {
    const resultado = await obtenerEnVivoService()
    res.status(200).json({ ok: true, data: resultado })
  } catch (error) {
    responderError(res, error, 'No se pudo obtener la actividad en vivo')
  }
}
