import { Usuario } from '../model/usuario.model'
import { sequelize } from './database'

// Supabase publica las tablas de "public" en su API REST para los roles anon y authenticated
// (la clave "anon" es pública). La tabla de usuarios solo la usa este backend: se activa RLS sin
// políticas y se quitan esos permisos, así la API de Supabase no puede leerla ni modificarla.
// El backend se conecta como dueño de la tabla y no se ve afectado.
// En una base sin esos roles (Docker local) solo se activa RLS.
const CERRAR_TABLA_USUARIOS = `
  ALTER TABLE metricas_usuarios ENABLE ROW LEVEL SECURITY;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON TABLE metricas_usuarios FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON TABLE metricas_usuarios FROM authenticated;
    END IF;
  END $$;
`

// Se conecta a Postgres, crea la tabla de usuarios si todavía no existe
// (no modifica ni borra una tabla que ya existe) y la cierra a accesos externos.
export async function prepararBaseDeDatos() {
  await sequelize.authenticate()
  await Usuario.sync()
  await sequelize.query(CERRAR_TABLA_USUARIOS)
}
