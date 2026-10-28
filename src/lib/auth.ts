import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextResponse } from 'next/server'
import { fail } from '@/lib/api'

export const SESSION_COOKIE = 'admin_session'
export const SESSION_TTL_SECONDS = 8 * 60 * 60 // 8 horas
const MIN_SECRET_LENGTH = 32
const TOKEN_VERSION = 'v1'
// Formato do token: v1.<payload base64url>.<assinatura HMAC-SHA256 base64url (43 chars)>
const TOKEN_RE = /^v1\.[A-Za-z0-9_-]{1,200}\.[A-Za-z0-9_-]{43}$/

function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET
  return s && s.length >= MIN_SECRET_LENGTH ? s : null
}

function hmac(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest()
}

// Nomes (nunca valores) das variáveis ausentes ou inválidas.
export function missingAuthConfig(): string[] {
  const missing: string[] = []
  if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD')
  if (!sessionSecret()) missing.push(`SESSION_SECRET (mínimo ${MIN_SECRET_LENGTH} caracteres)`)
  return missing
}

// ── Senha ──
// Compara digests SHA-256 (32 bytes fixos) com timingSafeEqual: sem vazar tamanho nem conteúdo.
export function passwordMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const a = createHash('sha256').update(candidate, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Sessão ──
export function createSessionToken(now = Date.now()): string | null {
  const secret = sessionSecret()
  if (!secret) return null
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS, n: randomBytes(12).toString('base64url') })
  ).toString('base64url')
  const data = `${TOKEN_VERSION}.${payload}`
  return `${data}.${hmac(secret, data).toString('base64url')}`
}

// Nunca lança: qualquer token malformado, adulterado ou expirado devolve false.
export function verifySessionToken(token: unknown, now = Date.now()): boolean {
  try {
    const secret = sessionSecret()
    if (!secret || typeof token !== 'string' || token.length > 400 || !TOKEN_RE.test(token)) return false
    const [version, payloadB64, sigB64] = token.split('.')
    const given = Buffer.from(sigB64, 'base64url')
    const expected = hmac(secret, `${version}.${payloadB64}`)
    // Exige a forma canônica do base64url: o último caractere de 43 tem bits sobrando e
    // aceitaria variantes não canônicas da mesma assinatura.
    if (given.toString('base64url') !== sigB64) return false
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false

    // Só depois da assinatura válida o payload é interpretado.
    const payload: unknown = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    if (typeof payload !== 'object' || payload === null) return false
    const { exp, n } = payload as { exp?: unknown; n?: unknown }
    if (typeof exp !== 'number' || !Number.isInteger(exp) || typeof n !== 'string') return false
    const nowSec = Math.floor(now / 1000)
    return exp > nowSec && exp <= nowSec + SESSION_TTL_SECONDS
  } catch {
    return false
  }
}

export function isAuthenticated(req: Request & { cookies: { get(name: string): { value: string } | undefined } }): boolean {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

// ── Origem (proteção CSRF para métodos de escrita) ──
// Política: o cabeçalho Origin é OBRIGATÓRIO e deve coincidir exatamente com uma origem
// permitida, definida só pela configuração do servidor — nunca por Host/X-Forwarded-Host,
// que o cliente ou um proxy mal configurado podem controlar. Sem fallback para Referer.
// Navegadores sempre enviam Origin em POST/PATCH/DELETE; clientes sem Origin (curl, scripts)
// são recusados de propósito (não há exceção).
// Origens permitidas:
//   - ALLOWED_ORIGINS (opcional, lista separada por vírgulas, ex.: https://meusite.com)
//   - URLs fornecidas pela própria Vercel: VERCEL_PROJECT_PRODUCTION_URL e VERCEL_URL
//   - fora de produção: http://localhost e http://127.0.0.1 em qualquer porta
export function allowedOrigins(): Set<string> {
  const set = new Set<string>()
  for (const o of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    try {
      const u = new URL(o.trim())
      if (u.protocol === 'https:' || u.protocol === 'http:') set.add(u.origin)
    } catch {}
  }
  for (const host of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    if (host && /^[A-Za-z0-9.-]+$/.test(host)) set.add(`https://${host}`)
  }
  return set
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin || origin === 'null' || origin.length > 300) return false
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  if (parsed.origin !== origin) return false // rejeita caminhos, credenciais, barras finais etc.
  if (allowedOrigins().has(origin)) return true
  if (process.env.NODE_ENV !== 'production') {
    return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  }
  return false
}

// Guarda única para toda operação de escrita: origem válida + sessão válida.
// Retorna uma resposta de erro, ou null se autorizado. Reutilizável por futuras rotas (ex.: upload).
export function guardAdminWrite(req: Request & { cookies: { get(name: string): { value: string } | undefined } }): NextResponse | null {
  if (!isOriginAllowed(req.headers.get('origin'))) return fail(403, 'Origem não permitida.')
  if (!isAuthenticated(req)) return fail(401, 'Não autorizado.')
  return null
}

// Apenas valida a origem (login/logout).
export function guardOrigin(req: Request): NextResponse | null {
  return isOriginAllowed(req.headers.get('origin')) ? null : fail(403, 'Origem não permitida.')
}
