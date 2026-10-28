import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { handleError, json } from '@/lib/api'
import { createRow } from '@/lib/crud'
import { projectTable } from './table'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Público. Padrão: destaques primeiro (home). ?sort=recent: mais recentes primeiro (painel admin).
export async function GET(req: NextRequest) {
  try {
    const q = sql()
    const recent = req.nextUrl.searchParams.get('sort') === 'recent'
    const rows = recent
      ? await q`SELECT * FROM projects ORDER BY created_at DESC`
      : await q`SELECT * FROM projects ORDER BY featured DESC, created_at DESC`
    return json(rows)
  } catch (err) {
    return handleError(err, 'projects:list')
  }
}

export async function POST(req: NextRequest) {
  return createRow(req, projectTable, 'projects:create')
}
