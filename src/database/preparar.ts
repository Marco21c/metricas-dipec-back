import { Usuario } from '../model/usuario.model'
import { sequelize } from './database'

// Se conecta a Postgres y crea la tabla de usuarios si todavía no existe
// (no modifica ni borra una tabla que ya existe).
export async function prepararBaseDeDatos() {
  await sequelize.authenticate()
  await Usuario.sync()
}
