import 'server-only'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { HttpError, fail, handleError, json, readJson } from '@/lib/api'
import { guardAdminWrite } from '@/lib/auth'
import { isUuid, validate } from '@/lib/validation'

// Colunas permitidas por tabela. Nomes de tabela/coluna vêm SEMPRE destas constantes;
// valores do cliente só entram como parâmetros $n.
type Table = { name: 'projects' | 'documents'; columns: string[]; spec: Parameters<typeof validate>[1] }

export async function createRow(req: NextRequest, t: Table, ctx: string) {
  try {
    const denied = guardAdminWrite(req)
    if (denied) return denied
    const data = validate(await readJson(req), t.spec, 'create')
    const cols = t.columns
    const text = `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`
    const rows = await sql().query(text, cols.map(c => data[c]))
    return json(rows[0], 201)
  } catch (err) {
    return handleError(err, ctx)
  }
}

export async function updateRow(req: NextRequest, id: string, t: Table, ctx: string) {
  try {
    const denied = guardAdminWrite(req)
    if (denied) return denied
    if (!isUuid(id)) throw new HttpError(400, 'Identificador inválido.')
    const data = validate(await readJson(req), t.spec, 'partial')
    const keys = Object.keys(data)
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const text = `UPDATE ${t.name} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`
    const rows = await sql().query(text, [...keys.map(k => data[k]), id])
    return rows.length ? json(rows[0]) : fail(404, 'Não encontrado.')
  } catch (err) {
    return handleError(err, ctx)
  }
}

export async function deleteRow(req: NextRequest, id: string, t: Table, ctx: string) {
  try {
    const denied = guardAdminWrite(req)
    if (denied) return denied
    if (!isUuid(id)) throw new HttpError(400, 'Identificador inválido.')
    const rows = await sql().query(`DELETE FROM ${t.name} WHERE id = $1 RETURNING id`, [id])
    return rows.length ? json({ ok: true }) : fail(404, 'Não encontrado.')
  } catch (err) {
    return handleError(err, ctx)
  }
}
