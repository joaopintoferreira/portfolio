import 'server-only'
import { neon } from '@neondatabase/serverless'

// Somente servidor: o import 'server-only' faz o build falhar se este módulo
// for importado por um componente de cliente. DATABASE_URL nunca deve ser
// exposta via NEXT_PUBLIC_*.
// Use sempre a forma parametrizada: sql`SELECT ... WHERE id = ${id}`
export function sql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada.')
  return neon(url)
}
