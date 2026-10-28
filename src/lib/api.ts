import { NextResponse } from 'next/server'

const MAX_BODY_BYTES = 64 * 1024

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function fail(status: number, error: string) {
  return json({ error }, status)
}

// Lê o corpo JSON com limite de tamanho. Lança HttpError (400/413/415).
export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get('content-type') || ''
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type deve ser application/json.')
  }
  const declared = Number(req.headers.get('content-length') || 0)
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Corpo muito grande.')
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Corpo muito grande.')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'JSON inválido.')
  }
}

// Resposta única para qualquer falha inesperada: nada interno vai ao cliente.
// O log registra apenas o contexto e o código/nome do erro (sem mensagem, URL ou SQL).
export function handleError(err: unknown, ctx: string) {
  if (err instanceof HttpError) return fail(err.status, err.message)
  const e = err as { code?: unknown; name?: unknown } | null
  const tag = typeof e?.code === 'string' ? e.code : typeof e?.name === 'string' ? e.name : 'erro'
  console.error(`[api:${ctx}] falha (${tag})`)
  return fail(500, 'Erro interno.')
}
