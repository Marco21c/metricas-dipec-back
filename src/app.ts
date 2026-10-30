import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { corsOptions, origenesPermitidos } from './config/cors'
import authRoute from './routes/auth.route'
import metricasRoute from './routes/metricas.route'
import { manejadorDeErrores } from './utils/errores'

const app = express()

// Detrás de un proxy HTTPS: para ver la IP real del usuario (límite de intentos de login)
app.set('trust proxy', 1)

app.use(helmet())
app.use(compression())
app.use(cors(corsOptions))

// En producción la cookie va con SameSite=None (tablero y backend en dominios distintos), así que
// otro sitio podría mandar un formulario a esta API con la cookie de quien tiene la sesión abierta.
// Los pedidos que cambian algo (POST) solo se aceptan desde el tablero: los navegadores siempre
// envían "Origin" en esos pedidos (sin Origin, por ejemplo curl, no hay cookie de un navegador).
app.use((req, res, next) => {
  const origen = req.headers.origin
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !origen || origenesPermitidos.includes(origen)) return next()
  res.status(403).json({ ok: false, message: 'Origen no permitido' })
})

app.use(cookieParser())
app.use(express.json({ limit: '10kb' })) // solo se recibe el usuario y la contraseña

// Para comprobar que el servidor está andando
app.get('/salud', (_req, res) => {
  res.json({ ok: true, servicio: 'metricas-dipec-back' })
})

app.use(authRoute)
app.use(metricasRoute)

// Al final: errores que no atrapó ningún controlador
app.use(manejadorDeErrores)

export default app
