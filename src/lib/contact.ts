import { HttpError } from '@/lib/api'

export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000 } as const

export type ContactData = { name: string; email: string; message: string }

// Caracteres de controle (inclui CR/LF) e separadores de linha Unicode.
const CONTROL_ALL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/
// Na mensagem, \n e \t legítimos são mantidos; \r é normalizado antes.
const CONTROL_MESSAGE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g

// Formato conservador: local@dominio.tld (sem espaços, aspas, <>, controle). Valida formato, não existência.
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

const bad = (msg: string): never => { throw new HttpError(400, msg) }

// Valida e normaliza o corpo. Lança HttpError(400). HTML/aspas/<script> NÃO são rejeitados:
// são dados, tratados como texto e escapados na geração do e-mail.
export function validateContact(body: unknown): ContactData {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return bad('Dados inválidos.')
  const { name, email, message } = body as Record<string, unknown>

  const missing = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
  if (missing(name) || missing(email) || missing(message)) return bad('Campos obrigatórios faltando.')
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') return bad('Dados inválidos.')

  const n = name.trim()
  const e = email.trim()
  if (CONTROL_ALL.test(n) || CONTROL_ALL.test(e)) return bad('Caracteres inválidos.')
  if (n.length > CONTACT_LIMITS.name) return bad(`Nome muito longo (máx. ${CONTACT_LIMITS.name} caracteres).`)
  if (e.length > CONTACT_LIMITS.email || !EMAIL_RE.test(e)) return bad('E-mail inválido.')

  const m = message.replace(/\r\n?/g, '\n').replace(CONTROL_MESSAGE, '').trim()
  if (m === '') return bad('Campos obrigatórios faltando.')
  if (m.length > CONTACT_LIMITS.message) return bad(`Mensagem muito longa (máx. ${CONTACT_LIMITS.message} caracteres).`)

  return { name: n, email: e, message: m }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Monta o e-mail. Todo conteúdo do usuário é escapado; o assunto não tem quebras de linha
// (nome já validado sem caracteres de controle).
export function buildEmail({ name, email, message }: ContactData) {
  const n = escapeHtml(name)
  const e = escapeHtml(email)
  const m = escapeHtml(message).replace(/\n/g, '<br>')
  return {
    subject: `[Portfolio] Mensagem de ${name}`.slice(0, 120),
    html: `
          <div style="font-family:monospace;max-width:500px;margin:0 auto;padding:24px;background:#0a0a0f;color:#fff;border:1px solid #2a2a3f;border-radius:8px">
            <h2 style="color:#00ff9f;margin-top:0">Nova mensagem do portfólio</h2>
            <p><strong style="color:#888">Nome:</strong> ${n}</p>
            <p><strong style="color:#888">Email:</strong> <a href="mailto:${e}" style="color:#00ff9f">${e}</a></p>
            <p><strong style="color:#888">Mensagem:</strong></p>
            <p style="background:#12121a;padding:12px;border-radius:6px;border-left:3px solid #00ff9f">${m}</p>
          </div>
        `,
    text: `Nova mensagem do portfólio\n\nNome: ${name}\nEmail: ${email}\n\nMensagem:\n${message}\n`,
  }
}
