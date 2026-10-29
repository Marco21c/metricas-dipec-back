import { ConnectionError } from 'sequelize'
import { verificarToken } from '../auth/jwt'
import { verificarPassword } from '../auth/password'
import type { UsuarioSesion } from '../interfaces/usuario.interface'
import { Usuario } from '../model/usuario.model'
import { ErrorApi } from '../utils/errores'

export const normalizarUsername = (username: unknown) => (typeof username === 'string' ? username.trim().toLowerCase() : '')

export const datosDeSesion = (u: Usuario): UsuarioSesion => ({ id: u.id, username: u.username, nombre: u.nombre })

// Hash de una contraseña cualquiera: si el usuario no existe se compara contra este,
// para que la respuesta tarde lo mismo y no revele qué usuarios existen.
const HASH_FALSO = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5vZJ0n6Q9tUu0eZyVv8bC9yJvR6m5lO'

// Si la base no responde, se avisa claro en vez de un error genérico
const sinBase = (error: unknown): never => {
  if (error instanceof ConnectionError) {
    console.error('[usuarios] No se pudo conectar con la base de datos:', error.message)
    throw new ErrorApi('No se pudo conectar con la base de datos de usuarios. Probá de nuevo en unos minutos.', 503)
  }
  throw error
}

// Login: el usuario si existe, está activo y la contraseña es correcta; si no, null
// (sin decir cuál de las tres falló). Registra la fecha de ingreso.
export const validarCredencialesService = async (username: unknown, password: unknown) => {
  const nombre = normalizarUsername(username)
  if (!nombre || typeof password !== 'string' || !password || password.length > 72) return null

  const usuario = await Usuario.findOne({ where: { username: nombre } }).catch(sinBase)
  const coincide = await verificarPassword(password, usuario?.password_hash ?? HASH_FALSO)
  if (!usuario || !usuario.activo || !coincide) return null

  usuario
    .update({ ultimo_ingreso: new Date() }, { silent: true })
    .catch((e: Error) => console.error('[usuarios] No se pudo registrar el ingreso:', e.message))
  return usuario
}

// Usuario de una sesión (cookie): firma válida y vigente, usuario activo y sin sesiones invalidadas.
// Devuelve también cuándo vence (milisegundos), para cortar el tiempo real a esa hora.
export const usuarioDeTokenService = async (token: string | undefined): Promise<{ usuario: UsuarioSesion; vence: number } | null> => {
  const datos = token ? verificarToken(token) : null
  if (!datos) return null
  const usuario = await Usuario.findByPk(datos.sub).catch(sinBase)
  if (!usuario || !usuario.activo || usuario.token_version !== datos.tv) return null
  return { usuario: datosDeSesion(usuario), vence: (datos.exp ?? 0) * 1000 }
}
