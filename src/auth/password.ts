import bcrypt from 'bcryptjs'

const COSTO = 12
export const LARGO_MINIMO = 10
const LARGO_MAXIMO = 72 // bcrypt ignora lo que pase de 72 bytes

// Requisitos de una contraseña nueva (los mismos que el sistema de estadísticas de la DiPEC)
const REQUISITOS: [RegExp, string][] = [
  [/[a-z]/, 'una minúscula'],
  [/[A-Z]/, 'una mayúscula'],
  [/[0-9]/, 'un número'],
  [/[^A-Za-z0-9\s]/, 'un signo (por ejemplo ! # $ % & * ?)'],
]

// Qué le falta a la contraseña, o null si cumple todo
export const errorPassword = (password: unknown): string | null => {
  if (typeof password !== 'string' || password.length < LARGO_MINIMO || password.length > LARGO_MAXIMO) {
    return `La contraseña debe tener entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} caracteres`
  }
  const faltan = REQUISITOS.filter(([regla]) => !regla.test(password)).map(([, texto]) => texto)
  return faltan.length ? `A la contraseña le falta: ${faltan.join(', ')}` : null
}

export const hashearPassword = (password: string) => bcrypt.hash(password, COSTO)
export const verificarPassword = (password: string, hash: string) => bcrypt.compare(password, hash)
