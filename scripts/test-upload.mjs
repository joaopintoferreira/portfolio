// Testes de /api/upload e do upload real para o Vercel Blob. Não imprime senha, token nem cookie.
//
// Uso (servidor de desenvolvimento em execução):
//   node --env-file=.env.local scripts/test-upload.mjs [http://localhost:3100]
//
// Escreve SOMENTE na Blob store (arquivos "__test__" apagados ao final). Não toca no NeonDB.
import { randomBytes } from 'node:crypto'
import { upload } from '@vercel/blob/client'
import { del } from '@vercel/blob'

const BASE = process.argv[2] || 'http://localhost:3100'
const PASSWORD = process.env.ADMIN_PASSWORD
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!PASSWORD || !BLOB_TOKEN) {
  console.error('Defina ADMIN_PASSWORD e BLOB_READ_WRITE_TOKEN no ambiente.')
  process.exit(2)
}

let passed = 0, failed = 0
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}
const created = [] // URLs criadas (para limpeza garantida)

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')

async function tokenReq({ cookie, origin = BASE, body, ip }) {
  const headers = { 'Content-Type': 'application/json' }
  if (origin !== null) headers.Origin = origin
  if (cookie) headers.Cookie = cookie
  if (ip) headers['x-real-ip'] = ip
  const res = await fetch(BASE + '/api/upload', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}
const ev = (pathname, extra = {}) => ({ type: 'blob.generate-client-token', payload: { pathname, multipart: false, clientPayload: null, ...extra } })

async function tryUpload(pathname, data, contentType, cookie) {
  try {
    const b = await upload(pathname, data, { access: 'public', handleUploadUrl: BASE + '/api/upload', contentType, headers: { Cookie: cookie, Origin: BASE } })
    created.push(b.url)
    return { ok: true, blob: b }
  } catch (e) {
    return { ok: false, error: e }
  }
}

async function main() {
  console.log(`Servidor: ${BASE}\n`)

  // Sessão
  const login = await fetch(BASE + '/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, 'x-real-ip': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
    body: JSON.stringify({ password: PASSWORD }),
  })
  const cookie = ((login.headers.get('set-cookie') || '').match(/admin_session=[^;]+/) || [''])[0]
  if (login.status !== 200 || !cookie) { console.error('Login de teste falhou; abortando.'); process.exit(2) }

  console.log('A. Autorização do endpoint')
  const good = ev(`projects/__test__${Date.now()}.png`)
  check('sem sessão → 401', (await tokenReq({ body: good })).status === 401)
  check('sessão válida + origem externa → 403', (await tokenReq({ cookie, origin: 'https://evil.example', body: good })).status === 403)
  check('sessão válida sem Origin → 403', (await tokenReq({ cookie, origin: null, body: good })).status === 403)
  check('cookie adulterado → 401', (await tokenReq({ cookie: cookie.slice(0, -2) + 'xx', body: good })).status === 401)

  console.log('\nB. Corpo e caminho inválidos (sem emitir token)')
  const bad = {
    'JSON malformado': '{"type":',
    'evento upload-completed': { type: 'blob.upload-completed', payload: { blob: {}, tokenPayload: null } },
    'evento desconhecido': { type: 'x', payload: {} },
    'sem payload': { type: 'blob.generate-client-token' },
    'pathname não-string': ev(123),
    'multipart não-booleano': ev('projects/a.png', { multipart: 'sim' }),
    'path traversal': ev('projects/../x.png'),
    'pasta não permitida': ev('evil/a.png'),
    'subpasta extra': ev('projects/a/b.png'),
    'sem pasta': ev('a.png'),
    'extensão svg': ev('projects/a.svg'),
    'extensão html': ev('projects/a.html'),
    'imagem em docs': ev('docs/a.png'),
    'pdf em projects': ev('projects/a.pdf'),
    'extensão em maiúsculas': ev('projects/a.PNG'),
    'espaço no nome': ev('projects/a b.png'),
    'nome longo demais': ev('projects/' + 'a'.repeat(81) + '.png'),
    'sem extensão': ev('projects/abc'),
  }
  for (const [label, body] of Object.entries(bad)) {
    const r = await tokenReq({ cookie, body })
    check(`${label} → 400`, r.status === 400 && !r.data?.clientToken, `recebido ${r.status}`)
  }

  console.log('\nC. Token válido')
  const t = await tokenReq({ cookie, body: good })
  check('sessão + origem válidas → 200 com clientToken', t.status === 200 && typeof t.data?.clientToken === 'string')
  check('token entregue é o restrito do cliente (não o de leitura/escrita)', t.data?.clientToken?.startsWith('vercel_blob_client_') && !t.data.clientToken.includes(BLOB_TOKEN))

  console.log('\nD. Upload real (Vercel Blob)')
  const img = await tryUpload(`projects/__test__${Date.now()}.png`, PNG, 'image/png', cookie)
  check('PNG em projects/ enviado', img.ok, img.error?.message)
  if (img.ok) {
    check('URL pública no domínio esperado', /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(img.blob.url), new URL(img.blob.url).host.split('.').slice(1).join('.'))
    const r = await fetch(img.blob.url)
    const body = Buffer.from(await r.arrayBuffer())
    check('download da imagem → 200, mesmos bytes e image/png', r.status === 200 && body.equals(PNG) && (r.headers.get('content-type') || '').startsWith('image/png'))
  }
  const gal = await tryUpload(`gallery/__test__${Date.now()}.png`, PNG, 'image/png', cookie)
  check('PNG em gallery/ enviado', gal.ok, gal.error?.message)
  const pdf = await tryUpload(`docs/__test__${Date.now()}.pdf`, PDF, 'application/pdf', cookie)
  check('PDF em docs/ enviado', pdf.ok, pdf.error?.message)
  if (pdf.ok) {
    const r = await fetch(pdf.blob.url)
    const body = Buffer.from(await r.arrayBuffer())
    check('download do PDF → 200, mesmos bytes e application/pdf', r.status === 200 && body.equals(PDF) && (r.headers.get('content-type') || '').startsWith('application/pdf'))
  }

  console.log('\nE. Uploads que devem ser recusados')
  const svg = await tryUpload(`projects/__test__${Date.now()}.png`, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml', cookie)
  check('tipo svg com token de PNG → recusado', !svg.ok)
  const txt = await tryUpload(`projects/__test__${Date.now()}.png`, Buffer.from('texto'), 'text/plain', cookie)
  check('text/plain com token de imagem → recusado', !txt.ok)
  const pngInDocs = await tryUpload(`docs/__test__${Date.now()}.pdf`, PNG, 'image/png', cookie)
  check('PNG com token de PDF → recusado', !pngInDocs.ok)
  const big = await tryUpload(`projects/__test__${Date.now()}.png`, Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png', cookie)
  check('imagem acima de 10 MB → recusada', !big.ok)
  const noSession = await tryUpload(`projects/__test__${Date.now()}.png`, PNG, 'image/png', '')
  check('upload sem sessão → recusado', !noSession.ok)

  console.log('\nF. Limpeza')
  if (created.length) {
    await del(created, { token: BLOB_TOKEN })
    check(`${created.length} arquivo(s) de teste removido(s) da store`, true)
    let gone = false
    for (let i = 0; i < 14 && !gone; i++) {
      const codes = await Promise.all(created.map(async u => (await fetch(u, { cache: 'no-store' })).status))
      gone = codes.every(c => c === 404)
      if (!gone) await new Promise(r => setTimeout(r, 5000))
    }
    check('URLs removidas passam a responder 404 (até 70 s por cache de CDN)', gone)
  }

  console.log(`\nResultado: ${passed} ok, ${failed} falhas`)
  process.exit(failed ? 1 : 0)
}
main().catch(async e => {
  console.error('Erro no teste:', e.message)
  try { if (created.length) await del(created, { token: BLOB_TOKEN }); console.error('Arquivos de teste removidos.') } catch {}
  process.exit(2)
})
