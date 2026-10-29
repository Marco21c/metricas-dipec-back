import { createServer } from 'node:http'
import app from './app'
import { env } from './config/env'
import { precargarResumenesService } from './services/metricas.service'
import { iniciarWebSocket } from './websocket/metricas.socket'

// Un mismo servidor atiende la API (Express) y el tiempo real (WebSocket)
const servidor = createServer(app)
iniciarWebSocket(servidor)

servidor.listen(env.port, () => {
  console.log(`metricas-dipec-back escuchando en http://localhost:${env.port}`)
  // Comprueba la conexión con Google y deja listo el período por defecto
  void precargarResumenesService()
})
