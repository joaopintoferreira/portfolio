import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { handleError, json } from '@/lib/api'
import { createRow } from '@/lib/crud'
import { documentTable } from './table'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Público.
export async function GET() {
  try {
    return json(await sql()`SELECT * FROM documents ORDER BY created_at DESC`)
  } catch (err) {
    return handleError(err, 'documents:list')
  }
}

export async function POST(req: NextRequest) {
  return createRow(req, documentTable, 'documents:create')
}
