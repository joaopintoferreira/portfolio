import { NextRequest } from 'next/server'
import { deleteRow, updateRow } from '@/lib/crud'
import { documentTable } from '../table'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return updateRow(req, id, documentTable, 'documents:update')
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return deleteRow(req, id, documentTable, 'documents:delete')
}
