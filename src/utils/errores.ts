import type { ErrorRequestHandler, Response } from 'express'

// Error con el código HTTP que corresponde devolver y un mensaje que se puede mostrar al usuario
export class ErrorApi extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const MENSAJE_INTERNO = 'Error interno del servidor'

// Respuesta de error de los endpoints con formato { ok, message }.
// Los errores internos no se exponen: quedan en el log y se devuelve un mensaje genérico.
export const responderError = (res: Response, error: unknown, generico = MENSAJE_INTERNO): void => {
  if (error instanceof ErrorApi) {
    res.status(error.status).json({ ok: false, message: error.message })
    return
  }
  console.error(`${generico}:`, error instanceof Error ? error.message : error)
  res.status(500).json({ ok: false, message: generico })
}

// Último middleware de la app: errores que no atrapó ningún controlador
export const manejadorDeErrores: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  responderError(res, error)
}
