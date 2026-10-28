import { NextRequest } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { HttpError, fail, handleError, json, readJson } from '@/lib/api'
import { guardAdminWrite } from '@/lib/auth'
import { policyForPath } from '@/lib/upload-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_TTL_MS = 10 * 60 * 1000

function isTokenRequest(b: unknown): b is HandleUploadBody {
  if (typeof b !== 'object' || b === null) return false
  const { type, payload } = b as { type?: unknown; payload?: unknown }
  if (type !== 'blob.generate-client-token' || typeof payload !== 'object' || payload === null) return false
  const p = payload as { pathname?: unknown; multipart?: unknown; clientPayload?: unknown }
  return typeof p.pathname === 'string' && typeof p.multipart === 'boolean'
    && (p.clientPayload === null || typeof p.clientPayload === 'string')
}

// Emite um token de upload direto (navegador → Vercel Blob) restrito ao caminho, tipo e tamanho.
// O BLOB_READ_WRITE_TOKEN fica só no servidor; o navegador recebe apenas o token restrito.
// Sem onUploadCompleted: o callback viria sem cookie e não é necessário (a URL é gravada via /api/projects|documents).
export async function POST(req: NextRequest) {
  try {
    // Autorização ANTES de qualquer outra coisa: origem permitida + sessão de admin válida.
    const denied = guardAdminWrite(req)
    if (denied) return denied

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (!blobToken) {
      console.error('[api:upload] configuração ausente: BLOB_READ_WRITE_TOKEN')
      return fail(500, 'Servidor não configurado.')
    }

    const body = await readJson(req)
    if (!isTokenRequest(body)) throw new HttpError(400, 'Requisição inválida.')

    const result = await handleUpload({
      token: blobToken,
      request: req,
      body,
      onBeforeGenerateToken: async pathname => {
        const policy = policyForPath(pathname)
        if (!policy) throw new HttpError(400, 'Caminho de arquivo inválido.')
        return { ...policy, addRandomSuffix: true, validUntil: Date.now() + TOKEN_TTL_MS }
      },
    })
    return json(result)
  } catch (err) {
    return handleError(err, 'upload')
  }
}
