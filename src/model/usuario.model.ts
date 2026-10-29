import { DataTypes, Model } from 'sequelize'
import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import { sequelize } from '../database/database'

// Usuario del tablero. Se crean, desactivan y cambian de contraseña con el comando
// "npm run usuarios" (no hay registro desde la web).
export class Usuario extends Model<InferAttributes<Usuario>, InferCreationAttributes<Usuario>> {
  declare id: CreationOptional<string>
  declare username: string
  declare nombre: string
  declare password_hash: string
  declare activo: CreationOptional<boolean>
  // Sube al cambiar la contraseña, desactivar o cerrar sesiones: invalida las sesiones abiertas
  declare token_version: CreationOptional<number>
  declare ultimo_ingreso: CreationOptional<Date | null>
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Usuario.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    token_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ultimo_ingreso: { type: DataTypes.DATE, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'metricas_usuarios', // nombre propio: la base puede ser compartida con otros sistemas de la DiPEC
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
)
