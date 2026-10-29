// Tiempo real con WebSocket (socket.io).
// El backend consulta a Google UNA vez por intervalo (para todos los que miran) y avisa
// al instante a todas las pantallas abiertas. Solo se consultan los períodos que alguien está mirando.
//
// Mensajes que manda el tablero:
//   "resumen:suscribir" (dias)  → empieza a recibir el resumen de ese período (7, 30, 90 o 365)
//   "en-vivo:suscribir"         → empieza a recibir las personas activas
// Mensajes que manda el backend:
//   "resumen"             { dias, data }         datos nuevos (al suscribirse y cuando algo cambió)
//   "resumen:sin-cambios" { dias, comprobado }   se consultó a Google y no hubo cambios
//   "resumen:error"       { dias, message }
//   "en-vivo"             data
//   "en-vivo:error"       { message }

import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'
import { corsOptions } from '../config/cors'
import { PERIODOS_VALIDOS } from '../interfaces/metricas.interface'
import type { DiasPeriodo, ResumenMetricas } from '../interfaces/metricas.interface'
import { obtenerEnVivoService, obtenerResumenService, validarDias } from '../services/metricas.service'

const INTERVALO_RESUMEN = 60 * 1000 // 1 minuto
const INTERVALO_EN_VIVO = 30 * 1000 // 30 segundos

const salaResumen = (dias: DiasPeriodo) => `resumen:${dias}`
const SALA_EN_VIVO = 'en-vivo'

// Mensaje claro para el tablero, sin exponer detalles internos
const mensajeDeError = (error: unknown) =>
  error instanceof Error && 'status' in error ? error.message : 'No se pudieron obtener las métricas. Se reintenta en un minuto.'

// "Huella" de los datos sin la hora de consulta: sirve para saber si algo cambió de verdad
const huella = (r: ResumenMetricas) => JSON.stringify({ ...r, actualizado: undefined })

export function iniciarWebSocket(servidor: HttpServer) {
  const io = new Server(servidor, { cors: corsOptions })
  const ultimaHuella = new Map<DiasPeriodo, string>()

  // ---------- Conexión de cada pantalla ----------
  io.on('connection', (socket: Socket) => {
    socket.on('resumen:suscribir', async (valor: unknown) => {
      let dias: DiasPeriodo
      try {
        dias = validarDias(valor)
      } catch (error) {
        socket.emit('resumen:error', { dias: valor, message: mensajeDeError(error) })
        return
      }
      // Una pantalla mira un solo período a la vez
      for (const d of PERIODOS_VALIDOS) if (d !== dias) socket.leave(salaResumen(d))
      socket.join(salaResumen(dias))

      try {
        socket.emit('resumen', { dias, data: await obtenerResumenService(dias) })
      } catch (error) {
        socket.emit('resumen:error', { dias, message: mensajeDeError(error) })
      }
    })

    socket.on('en-vivo:suscribir', async () => {
      socket.join(SALA_EN_VIVO)
      try {
        socket.emit('en-vivo', await obtenerEnVivoService())
      } catch (error) {
        socket.emit('en-vivo:error', { message: mensajeDeError(error) })
      }
    })
  })

  // ---------- Cada minuto: resumen de los períodos que alguien está mirando ----------
  let actualizandoResumen = false
  setInterval(async () => {
    if (actualizandoResumen) return // la vuelta anterior todavía no terminó
    actualizandoResumen = true
    try {
      for (const dias of PERIODOS_VALIDOS) {
        const sala = salaResumen(dias)
        if (!io.sockets.adapter.rooms.get(sala)?.size) continue // nadie mira este período
        try {
          const data = await obtenerResumenService(dias)
          const nueva = huella(data)
          if (nueva !== ultimaHuella.get(dias)) {
            ultimaHuella.set(dias, nueva)
            io.to(sala).emit('resumen', { dias, data })
          } else {
            io.to(sala).emit('resumen:sin-cambios', { dias, comprobado: new Date().toISOString() })
          }
        } catch (error) {
          io.to(sala).emit('resumen:error', { dias, message: mensajeDeError(error) })
        }
      }
    } finally {
      actualizandoResumen = false
    }
  }, INTERVALO_RESUMEN)

  // ---------- Cada 30 segundos: personas activas ----------
  setInterval(async () => {
    if (!io.sockets.adapter.rooms.get(SALA_EN_VIVO)?.size) return
    try {
      io.to(SALA_EN_VIVO).emit('en-vivo', await obtenerEnVivoService())
    } catch (error) {
      io.to(SALA_EN_VIVO).emit('en-vivo:error', { message: mensajeDeError(error) })
    }
  }, INTERVALO_EN_VIVO)

  console.log('[websocket] Tiempo real activo (resumen cada 1 min, en vivo cada 30 s)')
  return io
}
