import { createServer } from 'node:http'
import app from './app'
import { secretoValido } from './auth/jwt'
import { env } from './config/env'
import { prepararBaseDeDatos } from './database/preparar'
import { precargarResumenesService } from './services/metricas.service'
import { iniciarWebSocket } from './websocket/metricas.socket'

// Un mismo servidor atiende la API (Express) y el tiempo real (WebSocket)
const servidor = createServer(app)
iniciarWebSocket(servidor)

servidor.listen(env.port, () => {
  // En local se muestra la dirección para abrirla; en el servidor, la dirección pública la da el hosting
  console.log(env.isProduction ? `metricas-dipec-back escuchando en el puerto ${env.port}` : `metricas-dipec-back escuchando en http://localhost:${env.port}`)

  // Login: hace falta la clave de las sesiones y la base de datos de usuarios
  if (!secretoValido()) console.error('[login] Falta JWT_SECRET en el .env (una clave aleatoria de 32 caracteres o más). Nadie va a poder ingresar.')
  prepararBaseDeDatos()
    .then(() => console.log('[login] Base de datos de usuarios lista'))
    .catch((error: Error) =>
      console.error(`[login] No se pudo conectar con la base de datos (DATABASE_URL): ${error.message}. Nadie va a poder ingresar hasta que se resuelva.`),
    )

  // Comprueba la conexión con Google y deja listo el período por defecto
  void precargarResumenesService()
})
