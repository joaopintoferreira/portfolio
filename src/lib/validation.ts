import { HttpError } from '@/lib/api'

export const CATEGORIES = ['web', 'mobile', 'iot', 'other'] as const
export const DOC_TYPES = ['cv', 'doc', 'cert'] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

type Parser = (v: unknown) => unknown // lança HttpError(400) se inválido

const bad = (msg: string): never => { throw new HttpError(400, msg) }

const text = (min: number, max: number): Parser => v => {
  if (typeof v !== 'string') return bad('Campo de texto inválido.')
  const t = v.trim()
  if (t.length < min || t.length > max) return bad('Tamanho de texto inválido.')
  return t
}

const rawText = (max: number): Parser => v => {
  if (typeof v !== 'string' || v.length > max) return bad('Campo de texto inválido.')
  return v
}

function checkUrl(v: unknown): string {
  if (typeof v !== 'string' || v.length > 2048) return bad('URL inválida.')
  let u: URL
  try { u = new URL(v) } catch { return bad('URL inválida.') }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return bad('URL inválida.')
  return v
}

// Aceita '' porque o painel atual envia string vazia para campos sem URL.
const urlOrEmpty: Parser = v => (v === '' ? '' : checkUrl(v))
const url: Parser = checkUrl

const list = (maxItems: number, item: Parser): Parser => v => {
  if (!Array.isArray(v) || v.length > maxItems) return bad('Lista inválida.')
  return v.map(item)
}

const oneOf = (values: readonly string[]): Parser => v => {
  if (typeof v !== 'string' || !values.includes(v)) return bad('Valor não permitido.')
  return v
}

const bool: Parser = v => (typeof v === 'boolean' ? v : bad('Valor booleano inválido.'))

type Spec = Record<string, { parse: Parser; required?: boolean; default?: unknown }>

export const projectSpec: Spec = {
  title: { parse: text(1, 200), required: true },
  description: { parse: text(1, 1000), required: true },
  long_description: { parse: rawText(10000), default: '' },
  tags: { parse: list(30, text(1, 50)), default: [] },
  image_url: { parse: urlOrEmpty, default: '' },
  gallery_urls: { parse: list(30, url), default: [] },
  demo_url: { parse: urlOrEmpty, default: '' },
  repo_url: { parse: urlOrEmpty, default: '' },
  doc_url: { parse: urlOrEmpty, default: '' },
  category: { parse: oneOf(CATEGORIES), default: 'web' },
  featured: { parse: bool, default: false },
}

export const documentSpec: Spec = {
  title: { parse: text(1, 200), required: true },
  type: { parse: oneOf(DOC_TYPES), default: 'doc' },
  file_url: { parse: url, required: true },
}

// Valida o corpo contra a whitelist de campos. Campos desconhecidos são rejeitados.
// create: exige os obrigatórios e aplica os padrões do esquema. partial (PATCH): exige ≥1 campo.
export function validate(body: unknown, spec: Spec, mode: 'create' | 'partial'): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) bad('Corpo inválido.')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(spec, key)) bad('Campo não permitido.')
  }
  const out: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(spec)) {
    if (input[key] !== undefined) out[key] = def.parse(input[key])
    else if (mode === 'create') {
      if (def.required) bad('Campo obrigatório ausente.')
      out[key] = def.default
    }
  }
  if (mode === 'partial' && Object.keys(out).length === 0) bad('Nenhum campo para atualizar.')
  return out
}
