import { NextRequest, NextResponse } from 'next/server'
import { HttpError, fail, json, readJson, handleError } from '@/lib/api'
import {
  SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, guardOrigin, isAuthenticated,
  missingAuthConfig, passwordMatches, sessionCookieOptions,
} from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Rate limit de login: MITIGAÇÃO TEMPORÁRIA, apenas por instância ──
// O estado fica na memória do processo. Em ambiente serverless (Vercel) cada instância
// tem seu próprio contador, que é perdido quando a instância é reciclada; portanto isto
// NÃO garante um limite global. Reduz tentativas em rajada contra uma mesma instância,
// mas um limite real exige armazenamento compartilhado (fase futura, com autorização).
const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000
const FAILURE_DELAY_MS = 400
const MAX_TRACKED = 1000
const failures = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: NextRequest) {
  // Na Vercel, x-real-ip e x-forwarded-for são definidos pela plataforma.
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

function isLimited(key: string, now: number) {
  const e = failures.get(key)
  if (!e) return false
  if (e.resetAt <= now) { failures.delete(key); return false }
  return e.count >= MAX_FAILURES
}

function recordFailure(key: string, now: number) {
  if (failures.size >= MAX_TRACKED) {
    failures.forEach((v, k) => { if (v.resetAt <= now) failures.delete(k) })
    if (failures.size >= MAX_TRACKED) failures.clear()
  }
  const e = failures.get(key)
  failures.set(key, e && e.resetAt > now ? { count: e.count + 1, resetAt: e.resetAt } : { count: 1, resetAt: now + WINDOW_MS })
}

// Verificação de sessão
export async function GET(req: NextRequest) {
  return json({ ok: isAuthenticated(req) })
}

// Login
export async function POST(req: NextRequest) {
  try {
    const denied = guardOrigin(req)
    if (denied) return denied

    const missing = missingAuthConfig()
    if (missing.length) {
      console.error(`[api:auth] configuração ausente: ${missing.join(', ')}`)
      return fail(500, 'Servidor não configurado.')
    }

    const key = clientKey(req)
    const now = Date.now()
    if (isLimited(key, now)) return json({ ok: false, error: 'Muitas tentativas. Tente mais tarde.' }, 429)

    const body = await readJson(req)
    const password = typeof body === 'object' && body !== null ? (body as { password?: unknown }).password : undefined
    const valid = typeof password === 'string' && password.length <= 256 && passwordMatches(password)

    if (!valid) {
      recordFailure(key, now)
      await new Promise(r => setTimeout(r, FAILURE_DELAY_MS))
      return json({ ok: false }, 401) // mesma resposta para qualquer credencial inválida
    }

    failures.delete(key)
    const res = json({ ok: true })
    res.cookies.set(SESSION_COOKIE, createSessionToken()!, { ...sessionCookieOptions, maxAge: SESSION_TTL_SECONDS })
    return res
  } catch (err) {
    if (err instanceof HttpError) {
      // corpo inválido: mesma forma de resposta de credencial inválida
      await new Promise(r => setTimeout(r, FAILURE_DELAY_MS))
      return json({ ok: false }, 401)
    }
    return handleError(err, 'auth')
  }
}

// Logout (stateless: apenas remove o cookie; não revoga tokens já emitidos)
export async function DELETE(req: NextRequest) {
  const denied = guardOrigin(req)
  if (denied) return denied
  const res: NextResponse = json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 })
  return res
}
