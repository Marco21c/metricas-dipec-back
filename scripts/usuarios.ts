// Administración de los usuarios del tablero desde la consola.
//
//   npm run usuarios -- listar
//   npm run usuarios -- crear <usuario> "<Nombre y apellido>"
//   npm run usuarios -- contrasena <usuario>
//   npm run usuarios -- nombre <usuario> "<Nombre y apellido>"
//   npm run usuarios -- desactivar <usuario>
//   npm run usuarios -- activar <usuario>
//   npm run usuarios -- cerrar-sesiones <usuario>
//
// La contraseña se pide por teclado (no se ve al escribirla ni queda en el historial).

import { createInterface } from 'node:readline'
import { UniqueConstraintError } from 'sequelize'
import { errorPassword, hashearPassword } from '../src/auth/password'
import { sequelize } from '../src/database/database'
import { prepararBaseDeDatos } from '../src/database/preparar'
import { Usuario } from '../src/model/usuario.model'
import { normalizarUsername } from '../src/services/usuario.service'

const AYUDA = `
Uso:
  npm run usuarios -- listar
  npm run usuarios -- crear <usuario> "<Nombre y apellido>"
  npm run usuarios -- contrasena <usuario>
  npm run usuarios -- nombre <usuario> "<Nombre y apellido>"
  npm run usuarios -- desactivar <usuario>
  npm run usuarios -- activar <usuario>
  npm run usuarios -- cerrar-sesiones <usuario>

El usuario: entre 3 y 50 caracteres (letras minúsculas, números, punto, guion o guion bajo).
`

class ErrorDeUso extends Error {}

// ---------- Lectura de la contraseña ----------

// Sin teclado (por ejemplo, con la contraseña enviada por una tubería): se leen líneas
let lineas: AsyncIterableIterator<string> | null = null
async function leerLinea(): Promise<string> {
  lineas ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]()
  const { value, done } = await lineas.next()
  return done ? '' : String(value)
}

// Con teclado: lo escrito no se muestra
function leerOculto(pregunta: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(pregunta + '\n')
    return leerLinea()
  }
  return new Promise((resolve) => {
    const entrada = process.stdin
    let valor = ''
    process.stdout.write(pregunta)
    entrada.setRawMode(true)
    entrada.resume()
    entrada.setEncoding('utf8')
    const alEscribir = (texto: string) => {
      for (const c of texto) {
        if (c === '\r' || c === '\n') {
          entrada.setRawMode(false)
          entrada.pause()
          entrada.off('data', alEscribir)
          process.stdout.write('\n')
          resolve(valor)
          return
        }
        if (c === '\u0003') {
          process.stdout.write('\nCancelado.\n')
          process.exit(130)
        }
        if (c === '\u007f' || c === '\b') valor = valor.slice(0, -1)
        else valor += c
      }
    }
    entrada.on('data', alEscribir)
  })
}

async function pedirContrasenaNueva(): Promise<string> {
  console.log('La contraseña debe tener 10 caracteres o más, con mayúscula, minúscula, número y un signo.')
  for (let intento = 1; intento <= 3; intento++) {
    const clave = await leerOculto('Contraseña: ')
    const falta = errorPassword(clave)
    if (falta) {
      console.log(`  ${falta}.`)
      continue
    }
    const repetida = await leerOculto('Repetila: ')
    if (repetida !== clave) {
      console.log('  Las dos contraseñas no coinciden.')
      continue
    }
    return clave
  }
  throw new ErrorDeUso('No se cambió nada (3 intentos sin una contraseña válida).')
}

// ---------- Comandos ----------

const validarUsername = (valor: string | undefined) => {
  const username = normalizarUsername(valor)
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) throw new ErrorDeUso('Usuario inválido.' + AYUDA)
  return username
}

const validarNombre = (valor: string | undefined) => {
  const nombre = (valor ?? '').trim().replace(/\s+/g, ' ')
  if (nombre.length < 2 || nombre.length > 80) throw new ErrorDeUso('Falta el nombre y apellido (entre comillas), por ejemplo: "Ana Pérez".')
  return nombre
}

async function buscar(valor: string | undefined) {
  const username = validarUsername(valor)
  const usuario = await Usuario.findOne({ where: { username } })
  if (!usuario) throw new ErrorDeUso(`No existe el usuario "${username}".`)
  return usuario
}

const fecha = (d: Date | null) => (d ? d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Jujuy' }) : 'nunca')

async function ejecutar(comando: string | undefined, a: string | undefined, b: string | undefined) {
  switch (comando) {
    case 'listar': {
      const usuarios = await Usuario.findAll({ order: [['username', 'ASC']] })
      if (!usuarios.length) {
        console.log('Todavía no hay usuarios. Creá uno con: npm run usuarios -- crear <usuario> "<Nombre y apellido>"')
        return
      }
      console.table(
        usuarios.map((u) => ({
          usuario: u.username,
          nombre: u.nombre,
          estado: u.activo ? 'activo' : 'desactivado',
          'último ingreso': fecha(u.ultimo_ingreso),
        })),
      )
      return
    }

    case 'crear': {
      const username = validarUsername(a)
      const nombre = validarNombre(b)
      if (await Usuario.findOne({ where: { username } })) throw new ErrorDeUso(`Ya existe el usuario "${username}".`)
      const clave = await pedirContrasenaNueva()
      try {
        await Usuario.create({ username, nombre, password_hash: await hashearPassword(clave) })
      } catch (error) {
        if (error instanceof UniqueConstraintError) throw new ErrorDeUso(`Ya existe el usuario "${username}".`)
        throw error
      }
      console.log(`Listo: se creó "${username}" (${nombre}). Ya puede ingresar al tablero.`)
      return
    }

    case 'contrasena': {
      const usuario = await buscar(a)
      const clave = await pedirContrasenaNueva()
      await usuario.update({ password_hash: await hashearPassword(clave), token_version: usuario.token_version + 1 })
      console.log(`Listo: se cambió la contraseña de "${usuario.username}" y se cerraron sus sesiones abiertas.`)
      return
    }

    case 'nombre': {
      const usuario = await buscar(a)
      await usuario.update({ nombre: validarNombre(b) })
      console.log(`Listo: "${usuario.username}" ahora se muestra como ${usuario.nombre}.`)
      return
    }

    case 'desactivar': {
      const usuario = await buscar(a)
      await usuario.update({ activo: false, token_version: usuario.token_version + 1 })
      console.log(`Listo: "${usuario.username}" ya no puede ingresar y se cerraron sus sesiones abiertas.`)
      return
    }

    case 'activar': {
      const usuario = await buscar(a)
      await usuario.update({ activo: true })
      console.log(`Listo: "${usuario.username}" puede volver a ingresar.`)
      return
    }

    case 'cerrar-sesiones': {
      const usuario = await buscar(a)
      await usuario.update({ token_version: usuario.token_version + 1 })
      console.log(`Listo: se cerraron las sesiones abiertas de "${usuario.username}" (tiene que volver a ingresar).`)
      return
    }

    default:
      throw new ErrorDeUso(comando ? `Comando desconocido: "${comando}".${AYUDA}` : AYUDA)
  }
}

async function main() {
  const [comando, a, b] = process.argv.slice(2)
  try {
    if (comando && comando !== 'ayuda') await prepararBaseDeDatos()
    await ejecutar(comando === 'ayuda' ? undefined : comando, a, b)
  } catch (error) {
    if (error instanceof ErrorDeUso) console.error(error.message)
    else console.error('No se pudo completar la operación:', error instanceof Error ? error.message : error, '\n(¿Está andando Postgres y bien la DATABASE_URL del .env?)')
    process.exitCode = 1
  } finally {
    await sequelize.close().catch(() => {})
  }
}

void main()
