import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { corsOptions } from './config/cors'
import metricasRoute from './routes/metricas.route'
import { manejadorDeErrores } from './utils/errores'

const app = express()

// Detrás de un proxy HTTPS: para ver la IP real del usuario (límite de intentos de login)
app.set('trust proxy', 1)

app.use(helmet())
app.use(compression())
app.use(cors(corsOptions))
app.use(cookieParser())
app.use(express.json())

// Para comprobar que el servidor está andando
app.get('/salud', (_req, res) => {
  res.json({ ok: true, servicio: 'metricas-dipec-back' })
})

app.use(metricasRoute)

// Al final: errores que no atrapó ningún controlador
app.use(manejadorDeErrores)

export default app
