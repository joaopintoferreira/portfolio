// Testes HTTP das rotas /api (Fase 2). Não imprime senhas, tokens nem cookies.
//
// Uso (servidor de desenvolvimento já em execução com SESSION_SECRET >= 32 caracteres):
//   node --env-file=.env.local scripts/test-api.mjs [http://localhost:3100]
//
// Isolamento: cada execução usa IPs aleatórios (cabeçalho x-real-ip) por cenário, então o
// rate limit de login é independente entre cenários e entre execuções.
//
// Escrita no banco: este script NÃO escreve no banco (apenas leituras e requisições que devem ser
// recusadas antes de qualquer consulta). O CRUD completo está em scripts/test-crud.mjs.
import { createHmac, randomBytes } from 'node:crypto'

const BASE = process.argv[2] || 'http://localhost:3100'
const PASSWORD = process.env.ADMIN_PASSWORD
const SECRET = process.env.SESSION_SECRET
if (!PASSWORD || !SECRET || SECRET.length < 32) {
  console.error('Defina ADMIN_PASSWORD e SESSION_SECRET (>= 32 caracteres) no ambiente do teste e do servidor.')
  process.exit(2)
}

let passed = 0
let failed = 0
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}
const rnd = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`

async function call(method, path, { body, raw, cookie, origin = BASE, ip, type = 'application/json' } = {}) {
  const headers = {}
  if (origin !== null) headers.Origin = origin
  if (cookie) headers.Cookie = cookie
  if (ip) headers['x-real-ip'] = ip
  let payload
  if (raw !== undefined) { payload = raw; headers['Content-Type'] = type }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = type }
  const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') || '' }
}
const sessionCookieFrom = r => (r.setCookie.match(/admin_session=[^;]+/) || [''])[0]

// Gera tokens no formato de src/lib/auth.ts (somente para teste; nunca impressos).
const b64u = b => Buffer.from(b).toString('base64url')
function forge(payload, secret = SECRET) {
  const p = b64u(JSON.stringify(payload))
  const sig = createHmac('sha256', secret).update(`v1.${p}`).digest('base64url')
  return `v1.${p}.${sig}`
}
const now = () => Math.floor(Date.now() / 1000)
const asCookie = t => `admin_session=${t}`

const VALID_PROJECT = { title: 't', description: 'd' }
const VALID_DOC = { title: 't', type: 'doc', file_url: 'https://example.com/a.pdf' }
const UUID = '00000000-0000-4000-8000-000000000000'

async function counts() {
  const [p, d] = await Promise.all([call('GET', '/api/projects'), call('GET', '/api/documents')])
  return [Array.isArray(p.data) ? p.data.length : -1, Array.isArray(d.data) ? d.data.length : -1]
}

async function main() {
  console.log(`Servidor: ${BASE}\n`)

  console.log('A. Leitura pública')
  const [p0, d0] = await Promise.all([call('GET', '/api/projects'), call('GET', '/api/documents')])
  check('GET /api/projects → 200 e array', p0.status === 200 && Array.isArray(p0.data))
  check('GET /api/documents → 200 e array', d0.status === 200 && Array.isArray(d0.data))
  const rec = await call('GET', '/api/projects?sort=recent')
  check('GET /api/projects?sort=recent → 200 e array', rec.status === 200 && Array.isArray(rec.data))
  const [pCount, dCount] = await counts()

  console.log('\nB. Escrita sem autenticação é recusada (e nada muda)')
  const unauth = [
    ['POST', '/api/projects', VALID_PROJECT], ['PATCH', `/api/projects/${UUID}`, { title: 'x' }], ['DELETE', `/api/projects/${UUID}`],
    ['POST', '/api/documents', VALID_DOC], ['PATCH', `/api/documents/${UUID}`, { title: 'x' }], ['DELETE', `/api/documents/${UUID}`],
  ]
  for (const [m, path, body] of unauth) {
    const r = await call(m, path, { body })
    check(`${m} ${path.replace(UUID, ':id')} sem sessão → 401`, r.status === 401)
  }
  check('contagens inalteradas após pedidos não autenticados', (await counts()).join() === [pCount, dCount].join())

  console.log('\nC. Política de origem')
  const okToken = forge({ exp: now() + 3600, n: 'teste' })
  const authed = asCookie(okToken)
  for (const [label, origin] of [['sem Origin', null], ['origem externa', 'https://evil.example'], ['Origin "null"', 'null'], ['Origin com caminho', `${BASE}/x`], ['Origin com barra final', `${BASE}/`]]) {
    const r = await call('POST', '/api/projects', { body: { title: 'x' }, cookie: authed, origin })
    check(`POST com sessão válida e ${label} → 403`, r.status === 403)
  }
  check('login com origem externa → 403', (await call('POST', '/api/auth', { body: { password: 'x' }, origin: 'https://evil.example' })).status === 403)
  check('logout com origem externa → 403', (await call('DELETE', '/api/auth', { origin: 'https://evil.example' })).status === 403)

  console.log('\nD. Login e sessão')
  const ipA = rnd()
  const wrong = await call('POST', '/api/auth', { body: { password: 'senha-errada-' + randomBytes(4).toString('hex') }, ip: ipA })
  check('senha errada → 401 {ok:false}', wrong.status === 401 && wrong.data?.ok === false && Object.keys(wrong.data).length === 1)
  const noPw = await call('POST', '/api/auth', { body: {}, ip: ipA })
  check('sem senha → 401 com a mesma resposta', noPw.status === 401 && JSON.stringify(noPw.data) === JSON.stringify(wrong.data))
  const notJson = await call('POST', '/api/auth', { raw: 'x', type: 'text/plain', ip: ipA })
  check('corpo não-JSON → 401 com a mesma resposta', notJson.status === 401 && JSON.stringify(notJson.data) === JSON.stringify(wrong.data))
  const good = await call('POST', '/api/auth', { body: { password: PASSWORD }, ip: rnd() })
  check('senha correta → 200 {ok:true}', good.status === 200 && good.data?.ok === true)
  const sc = good.setCookie
  check('cookie HttpOnly', /HttpOnly/i.test(sc))
  check('cookie SameSite=Lax', /SameSite=Lax/i.test(sc))
  check('cookie com Max-Age de 8 h', /Max-Age=28800/i.test(sc))
  check('cookie Path=/', /Path=\//i.test(sc))
  check('resposta não contém o token', !JSON.stringify(good.data).includes('v1.'))
  const real = sessionCookieFrom(good)
  check('GET /api/auth com cookie → ok:true', (await call('GET', '/api/auth', { cookie: real })).data?.ok === true)
  check('GET /api/auth sem cookie → ok:false', (await call('GET', '/api/auth')).data?.ok === false)

  console.log('\nE. Tokens inválidos (nenhum deve gerar erro 500)')
  const sessionOk = async t => (await call('GET', '/api/auth', { cookie: asCookie(t) }))
  check('token forjado válido é aceito (valida o gerador do teste)', (await sessionOk(okToken)).data?.ok === true)
  const parts = okToken.split('.')
  const cases = {
    expirado: forge({ exp: now() - 10, n: 'x' }),
    'exp muito no futuro': forge({ exp: now() + 10 * 24 * 3600, n: 'x' }),
    'assinado com outro segredo': forge({ exp: now() + 3600, n: 'x' }, 'outro-segredo-qualquer-com-mais-de-32-caracteres'),
    'assinatura adulterada': `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${parts[2].endsWith('A') ? 'B' : 'A'}`,
    'payload adulterado': `${parts[0]}.${b64u(JSON.stringify({ exp: now() + 99999, n: 'x' }))}.${parts[2]}`,
    'exp não numérico': forge({ exp: 'amanhã', n: 'x' }),
    'exp fracionário': forge({ exp: now() + 100.5, n: 'x' }),
    'sem campo n': forge({ exp: now() + 3600 }),
    'payload não é objeto': forge('texto'),
    'payload null': forge(null),
    'lixo': 'abc',
    'partes vazias': 'v1..',
    'versão errada': okToken.replace(/^v1/, 'v2'),
    'caracteres inválidos': 'v1.@@@.###',
    'token enorme': 'v1.' + 'A'.repeat(5000) + '.' + 'B'.repeat(43),
  }
  for (const [label, token] of Object.entries(cases)) {
    const r = await sessionOk(token)
    check(`${label} → recusado sem erro`, r.status === 200 && r.data?.ok === false)
    // Corpo propositalmente INVÁLIDO (sem description): se a autenticação falhar em recusar o
    // token, a resposta será 400 (teste falha) e nenhuma escrita é possível.
    const w = await call('POST', '/api/projects', { body: { title: 'x' }, cookie: asCookie(token) })
    check(`${label} → escrita recusada (401)`, w.status === 401)
  }
  check('contagens inalteradas após tokens inválidos', (await counts()).join() === [pCount, dCount].join())

  console.log('\nF. Validação de entrada (sessão válida; rejeitada antes de qualquer consulta)')
  const post = (path, body, extra = {}) => call('POST', path, { body, cookie: authed, ...extra })
  const expect400 = async (label, r, code = 400) => check(`${label} → ${code}`, r.status === code, `recebido ${r.status}`)
  await expect400('projeto sem title', await post('/api/projects', { description: 'd' }))
  await expect400('projeto sem description', await post('/api/projects', { title: 't' }))
  await expect400('title vazio', await post('/api/projects', { ...VALID_PROJECT, title: '   ' }))
  await expect400('title longo demais', await post('/api/projects', { ...VALID_PROJECT, title: 'x'.repeat(201) }))
  await expect400('category inválida', await post('/api/projects', { ...VALID_PROJECT, category: 'desktop' }))
  await expect400('featured como string', await post('/api/projects', { ...VALID_PROJECT, featured: 'true' }))
  await expect400('tags não é array', await post('/api/projects', { ...VALID_PROJECT, tags: 'a,b' }))
  await expect400('tags com 31 itens', await post('/api/projects', { ...VALID_PROJECT, tags: Array(31).fill('a') }))
  await expect400('tags com item não-string', await post('/api/projects', { ...VALID_PROJECT, tags: [1] }))
  await expect400('gallery_urls com URL inválida', await post('/api/projects', { ...VALID_PROJECT, gallery_urls: ['nao-e-url'] }))
  await expect400('image_url com javascript:', await post('/api/projects', { ...VALID_PROJECT, image_url: 'javascript:alert(1)' }))
  await expect400('demo_url com protocolo ftp', await post('/api/projects', { ...VALID_PROJECT, demo_url: 'ftp://x.com/a' }))
  await expect400('campo desconhecido (id)', await post('/api/projects', { ...VALID_PROJECT, id: UUID }))
  await expect400('campo desconhecido (created_at)', await post('/api/projects', { ...VALID_PROJECT, created_at: '2020-01-01' }))
  await expect400('corpo é array', await post('/api/projects', [VALID_PROJECT]))
  await expect400('corpo é string', await post('/api/projects', 'oi'))
  await expect400('JSON malformado', await call('POST', '/api/projects', { raw: '{"title":', cookie: authed }))
  await expect400('Content-Type errado', await call('POST', '/api/projects', { raw: '{}', type: 'text/plain', cookie: authed }), 415)
  await expect400('corpo grande demais', await call('POST', '/api/projects', { raw: JSON.stringify({ ...VALID_PROJECT, long_description: 'x'.repeat(70000) }), cookie: authed }), 413)
  await expect400('documento sem file_url', await post('/api/documents', { title: 't', type: 'cv' }))
  await expect400('documento com type inválido', await post('/api/documents', { ...VALID_DOC, type: 'pdf' }))
  await expect400('documento com file_url inválida', await post('/api/documents', { ...VALID_DOC, file_url: 'file:///etc/passwd' }))
  await expect400('PATCH projeto com UUID inválido', await call('PATCH', '/api/projects/nao-uuid', { body: { title: 'x' }, cookie: authed }))
  await expect400('PATCH projeto com UUID de injeção', await call('PATCH', `/api/projects/${encodeURIComponent("1' OR '1'='1")}`, { body: { title: 'x' }, cookie: authed }))
  await expect400('DELETE projeto com UUID inválido', await call('DELETE', '/api/projects/123', { cookie: authed }))
  await expect400('PATCH documento com UUID inválido', await call('PATCH', '/api/documents/xyz', { body: { title: 'x' }, cookie: authed }))
  await expect400('DELETE documento com UUID inválido', await call('DELETE', '/api/documents/xyz', { cookie: authed }))
  await expect400('PATCH vazio', await call('PATCH', `/api/projects/${UUID}`, { body: {}, cookie: authed }))
  await expect400('PATCH com campo desconhecido', await call('PATCH', `/api/projects/${UUID}`, { body: { id: UUID }, cookie: authed }))
  await expect400('PATCH com category inválida', await call('PATCH', `/api/projects/${UUID}`, { body: { category: 'x' }, cookie: authed }))
  check('contagens inalteradas após entradas inválidas', (await counts()).join() === [pCount, dCount].join())

  console.log('\nG. Logout')
  const out = await call('DELETE', '/api/auth', { cookie: real })
  check('logout → 200', out.status === 200 && out.data?.ok === true)
  check('logout limpa o cookie (Max-Age=0, HttpOnly)', /Max-Age=0/i.test(out.setCookie) && /HttpOnly/i.test(out.setCookie))

  console.log('\nH. Rate limit de login (por instância; IP isolado)')
  const ipL = rnd()
  let allWrong = true
  for (let i = 0; i < 5; i++) {
    const r = await call('POST', '/api/auth', { body: { password: 'errada-' + i }, ip: ipL })
    if (r.status !== 401) allWrong = false
  }
  check('5 tentativas erradas → 401 cada', allWrong)
  const locked = await call('POST', '/api/auth', { body: { password: PASSWORD }, ip: ipL })
  check('6ª tentativa (mesmo com senha correta) → 429', locked.status === 429 && !sessionCookieFrom(locked))
  const other = await call('POST', '/api/auth', { body: { password: PASSWORD }, ip: rnd() })
  check('outro IP não é afetado → 200', other.status === 200)

  console.log('\nI. CRUD completo (escrita)')
  console.log('  SKIP este script nunca escreve no banco. O CRUD completo roda em scripts/test-crud.mjs,')
  console.log('       que exige um banco de teste isolado e prova o isolamento antes de qualquer escrita.')

  console.log(`\nResultado: ${passed} ok, ${failed} falhas`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error('Erro no teste:', e.message); process.exit(2) })
