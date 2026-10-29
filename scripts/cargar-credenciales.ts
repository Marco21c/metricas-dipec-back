// Carga en el .env el correo y la clave de la cuenta de servicio de Google,
// leyéndolos del archivo .json que descarga Google Cloud.
//
// Uso:  npm run cargar-credenciales -- "C:\ruta\al\archivo.json"
//
// No muestra la clave en pantalla. El .json conviene guardarlo FUERA del proyecto.

import fs from 'node:fs'
import path from 'node:path'

const archivoJson = process.argv[2]
if (!archivoJson) {
  console.error('Falta la ruta del archivo .json. Ejemplo:')
  console.error('  npm run cargar-credenciales -- "C:\\Users\\user\\Downloads\\metricas-dipec-xxxx.json"')
  process.exit(1)
}
if (!fs.existsSync(archivoJson)) {
  console.error(`No se encontró el archivo: ${archivoJson}`)
  process.exit(1)
}

let datos: { client_email?: string; private_key?: string; type?: string }
try {
  datos = JSON.parse(fs.readFileSync(archivoJson, 'utf8'))
} catch {
  console.error('El archivo no es un .json válido.')
  process.exit(1)
}
if (datos.type !== 'service_account' || !datos.client_email || !datos.private_key) {
  console.error('El archivo no parece una clave de cuenta de servicio de Google (faltan "client_email" o "private_key").')
  process.exit(1)
}

// En el .env la clave va en una sola línea: los saltos de línea se escriben como \n
const claveEnUnaLinea = datos.private_key.replace(/\r?\n/g, '\\n')

const rutaEnv = path.resolve(__dirname, '..', '.env')
let env = fs.existsSync(rutaEnv) ? fs.readFileSync(rutaEnv, 'utf8') : ''

function fijar(nombre: string, valor: string) {
  const linea = `${nombre}=${valor}`
  const regex = new RegExp(`^${nombre}=.*$`, 'm')
  env = regex.test(env) ? env.replace(regex, () => linea) : `${env.trimEnd()}\n${linea}\n`
}

fijar('GA_CLIENT_EMAIL', datos.client_email)
fijar('GA_PRIVATE_KEY', `"${claveEnUnaLinea}"`)
fs.writeFileSync(rutaEnv, env)

console.log('Listo. Se cargaron en el .env:')
console.log(`  GA_CLIENT_EMAIL = ${datos.client_email}`)
console.log('  GA_PRIVATE_KEY  = (cargada, no se muestra)')
console.log('Falta completar GA_PROPERTY_ID si todavía no lo tenés.')
