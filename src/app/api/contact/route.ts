import { NextRequest } from 'next/server'
import { fail, handleError, json, readJson } from '@/lib/api'
import { buildEmail, validateContact } from '@/lib/contact'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESEND_URL = 'https://api.resend.com/emails'
const SEND_TIMEOUT_MS = 10_000

// ── Limite de envios: MITIGAÇÃO TEMPORÁRIA, apenas por instância ──
// O contador fica na memória do processo. Em ambiente serverless (Vercel) cada instância tem o
// seu e o perde ao ser reciclada; portanto NÃO é um limite global e não impede abuso distribuído.
// Um limite real exige armazenamento compartilhado (fase futura, com autorização).
const MAX_PER_WINDOW = 5
const WINDOW_MS = 10 * 60 * 1000
const MAX_TRACKED = 1000
const sent = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: NextRequest) {
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

function isLimited(key: string, now: number) {
  const e = sent.get(key)
  if (!e) return false
  if (e.resetAt <= now) { sent.delete(key); return false }
  return e.count >= MAX_PER_WINDOW
}

function record(key: string, now: number) {
  if (sent.size >= MAX_TRACKED) {
    sent.forEach((v, k) => { if (v.resetAt <= now) sent.delete(k) })
    if (sent.size >= MAX_TRACKED) sent.clear()
  }
  const e = sent.get(key)
  sent.set(key, e && e.resetAt > now ? { count: e.count + 1, resetAt: e.resetAt } : { count: 1, resetAt: now + WINDOW_MS })
}

// A URL do Resend é fixa; só fora de produção pode ser trocada (testes com servidor falso local).
function resendUrl() {
  return process.env.NODE_ENV !== 'production' && process.env.RESEND_API_URL ? process.env.RESEND_API_URL : RESEND_URL
}

export async function POST(req: NextRequest) {
  try {
    const key = clientKey(req)
    const now = Date.now()
    if (isLimited(key, now)) return fail(429, 'Muitas mensagens. Tente novamente mais tarde.')

    const data = validateContact(await readJson(req))

    const RESEND_KEY = process.env.RESEND_API_KEY
    const TO_EMAIL = process.env.CONTACT_EMAIL
    if (!RESEND_KEY || !TO_EMAIL) {
      if (process.env.NODE_ENV === 'production') {
        const missing = [!RESEND_KEY && 'RESEND_API_KEY', !TO_EMAIL && 'CONTACT_EMAIL'].filter(Boolean).join(', ')
        console.error(`[api:contact] configuração ausente: ${missing}`)
        return fail(500, 'Serviço de contato indisponível.')
      }
      // Desenvolvimento sem Resend: não registra o conteúdo (dados pessoais), só metadados.
      console.log(`[api:contact] (dev, sem Resend) nome=${data.name.length} email=${data.email.length} mensagem=${data.message.length} caracteres`)
      record(key, now)
      return json({ ok: true })
    }

    record(key, now)
    const mail = buildEmail(data)
    try {
      const res = await fetch(resendUrl(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Portfolio <onboarding@resend.dev>',
          to: [TO_EMAIL],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      })
      if (!res.ok) {
        // Não lê nem registra o corpo da resposta do serviço (pode conter detalhes internos).
        console.error(`[api:contact] serviço de e-mail respondeu ${res.status}`)
        return fail(500, 'Erro ao enviar mensagem.')
      }
      return json({ ok: true })
    } catch (err) {
      console.error(`[api:contact] falha ao chamar o serviço de e-mail (${(err as { name?: string })?.name || 'erro'})`)
      return fail(500, 'Erro ao enviar mensagem.')
    }
  } catch (err) {
    return handleError(err, 'contact')
  }
}
