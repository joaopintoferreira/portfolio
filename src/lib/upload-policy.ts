// Regras de upload compartilhadas: o servidor as impõe ao emitir o token (fonte de verdade);
// o navegador as usa só para dar uma mensagem rápida antes de enviar.
// Sem 'server-only' de propósito: não contém segredos.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_PDF_BYTES = 25 * 1024 * 1024 // 25 MB

// SVG fica de fora de propósito (pode conter scripts).
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}
export const PDF_TYPES: Record<string, string> = { 'application/pdf': 'pdf' }

export type UploadKind = 'image' | 'pdf'

const FOLDERS: Record<string, UploadKind> = { projects: 'image', gallery: 'image', docs: 'pdf' }
const PATH_RE = /^(projects|gallery|docs)\/[A-Za-z0-9_-]{1,80}\.([a-z0-9]{2,5})$/

const typesFor = (kind: UploadKind) => (kind === 'image' ? IMAGE_TYPES : PDF_TYPES)
const limitFor = (kind: UploadKind) => (kind === 'image' ? MAX_IMAGE_BYTES : MAX_PDF_BYTES)

// Servidor: valida o pathname pedido e devolve as restrições do token, ou null se inválido.
export function policyForPath(pathname: unknown) {
  if (typeof pathname !== 'string') return null
  const m = PATH_RE.exec(pathname)
  if (!m) return null
  const kind = FOLDERS[m[1]]
  const allowed = Object.entries(typesFor(kind))
  if (!allowed.some(([, ext]) => ext === m[2])) return null
  return { allowedContentTypes: allowed.map(([type]) => type), maximumSizeInBytes: limitFor(kind) }
}

// Navegador: valida o arquivo escolhido e devolve a extensão a usar no caminho.
export function checkFile(file: File, kind: UploadKind): string {
  const ext = typesFor(kind)[file.type]
  if (!ext) {
    throw new Error(kind === 'image'
      ? 'Tipo de imagem não permitido (use JPG, PNG, WebP, GIF ou AVIF).'
      : 'Apenas arquivos PDF são permitidos.')
  }
  if (file.size === 0) throw new Error('Arquivo vazio.')
  if (file.size > limitFor(kind)) {
    throw new Error(`Arquivo maior que o limite de ${limitFor(kind) / 1024 / 1024} MB.`)
  }
  return ext
}
