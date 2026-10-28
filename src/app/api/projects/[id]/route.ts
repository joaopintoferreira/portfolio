import { NextRequest } from 'next/server'
import { deleteRow, updateRow } from '@/lib/crud'
import { projectTable } from '../table'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return updateRow(req, id, projectTable, 'projects:update')
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return deleteRow(req, id, projectTable, 'projects:delete')
}
