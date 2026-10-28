// Teste de CRUD completo (projetos e documentos) contra um banco de teste ISOLADO.
//
// ESCREVE dados — somente no banco indicado por TEST_DATABASE_URL, e só depois de provar o isolamento.
// Nunca imprime URLs, senhas, tokens nem cookies.
//
// Pré-requisitos (variáveis; valores só com você):
//   TEST_DATABASE_URL     string de conexão de um banco/branch de teste do Neon (diferente do real)
//   TEST_DB_CONFIRM_HOST  host dessa URL, digitado por você (confirma que sabe qual banco é)
//   ALLOW_WRITE_TESTS=1   consentimento explícito
//   (de .env.local, via --env-file) DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
//
// Uso:
//   ALLOW_WRITE_TESTS=1 TEST_DATABASE_URL='...' TEST_DB_CONFIRM_HOST='...' \
//     node --env-file=.env.local scripts/test-crud.mjs
//
// Como funciona o isolamento:
//   1. Pré-voo sem escrita: confere variáveis, compara os endpoints (teste x real) e o esquema do teste.
//   2. Sobe o PRÓPRIO `next dev` (porta 3300) com DATABASE_URL = banco de teste e Blob/Resend neutralizados.
//   3. Handshake: grava uma linha sentinela direto no banco de teste e exige que o servidor a enxergue
//      e que o banco real NÃO a tenha. Se falhar, aborta antes de qualquer escrita via API.
//   4. Só altera/exclui linhas criadas pelo próprio teste (conjunto `owned`); hash das linhas
//      pré-existentes (teste e real) é comparado antes/depois.
// Pare outros `next dev` deste projeto antes (compartilham a pasta .next).
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { checkIsolation } from './crud-guard.mjs'

const PORT = 3300
const BASE = `http://localhost:${PORT}`
const PREFIX = '__crud_'
const TAG = randomBytes(4).toString('hex')
const T = `${PREFIX}test__${TAG}`
const NOPE = '00000000-0000-4000-8000-0000000000aa' // UUID válido que não deve existir

let passed = 0, failed = 0
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}
const refuse = msg => { console.error(`RECUSADO (nenhuma escrita foi feita): ${msg}`); process.exit(2) }

// ── Pré-voo (sem escrita, sem rede) ──
const g = checkIsolation({
  allow: process.env.ALLOW_WRITE_TESTS,
  testUrl: process.env.TEST_DATABASE_URL,
  confirmHost: process.env.TEST_DB_CONFIRM_HOST,
  realUrl: process.env.DATABASE_URL,
})
if (!g.ok) refuse(g.reason)
if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) refuse('ADMIN_PASSWORD e SESSION_SECRET são necessários (use --env-file=.env.local).')

const testDb = neon(process.env.TEST_DATABASE_URL)
const realDb = neon(process.env.DATABASE_URL)

const SNAP = {
  projects: s => s.query("select md5(coalesce(string_agg(t::text, '|' order by id), '')) as h, count(*)::int as n from projects t where not starts_with(title, $1)", [PREFIX]),
  documents: s => s.query("select md5(coalesce(string_agg(t::text, '|' order by id), '')) as h, count(*)::int as n from documents t where not starts_with(title, $1)", [PREFIX]),
}
const snapshot = async s => ({ p: (await SNAP.projects(s))[0], d: (await SNAP.documents(s))[0] })

// ── servidor próprio ──
let server = null
const stopServer = () => { if (server) { try { process.kill(-server.pid, 'SIGTERM') } catch {} server = null } }
function startServer() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL, // o servidor só enxerga o banco de teste
    BLOB_READ_WRITE_TOKEN: '', RESEND_API_KEY: '', CONTACT_EMAIL: '', RESEND_API_URL: 'http://127.0.0.1:9/emails',
  }
  delete env.NODE_ENV
  delete env.TEST_DATABASE_URL
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { env, detached: true, stdio: 'ignore' })
}
async function waitUp() {
  for (let i = 0; i < 90; i++) {
    try { await fetch(`${BASE}/api/auth`); return true } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

// ── cliente HTTP com regra de posse ──
const owned = new Set()
const ipRand = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`
let cookie = ''
async function api(method, path, { body, auth = true, origin = BASE } = {}) {
  const m = path.match(/^\/api\/(?:projects|documents)\/([^/?]+)/)
  if (m && (method === 'PATCH' || method === 'DELETE') && !owned.has(m[1]) && m[1] !== NOPE) {
    throw new Error('Bloqueado pelo teste: tentativa de alterar um id que ele não criou.')
  }
  const headers = { 'x-real-ip': ipRand() }
  if (origin) headers.Origin = origin
  if (auth && cookie) headers.Cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  let data = null
  try { data = await res.json() } catch {}
  if (method === 'POST' && res.status === 201 && data?.id) owned.add(data.id)
  return { status: res.status, data }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function main() {
  console.log('Pré-voo (sem escrita)')
  // Esquema do banco de teste
  const cols = async (s, table) => (await s.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by 1", [table])).map(r => r.column_name)
  const wantP = ['category', 'created_at', 'demo_url', 'description', 'doc_url', 'featured', 'gallery_urls', 'id', 'image_url', 'long_description', 'repo_url', 'tags', 'title']
  const wantD = ['created_at', 'file_url', 'id', 'title', 'type']
  const [cp, cd] = [await cols(testDb, 'projects'), await cols(testDb, 'documents')]
  if (!same(cp, wantP) || !same(cd, wantD)) refuse('o esquema do banco de teste não corresponde a neon-schema.sql (aplique o esquema no banco de teste).')
  check('banco de teste tem o esquema esperado', true)
  const leftovers = (await testDb.query("select (select count(*) from projects where starts_with(title,$1))::int + (select count(*) from documents where starts_with(title,$1))::int as n", [PREFIX]))[0].n
  if (leftovers) refuse('o banco de teste já tem linhas com prefixo __crud_ (sobras); limpe-as manualmente antes.')

  const before = { test: await snapshot(testDb), real: await snapshot(realDb) }
  check('instantâneos das linhas pré-existentes (teste e real) coletados', true)

  startServer()
  const sentinel = `${PREFIX}sentinel__${TAG}`
  let sentinelId = null
  try {
    if (!(await waitUp())) refuse('o servidor de teste não iniciou.')

    console.log('\nHandshake de isolamento')
    const ins = await testDb.query('insert into projects (title, description) values ($1, $2) returning id', [sentinel, 'sentinela'])
    sentinelId = ins[0].id
    const login = await fetch(`${BASE}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, 'x-real-ip': ipRand() }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) })
    cookie = ((login.headers.get('set-cookie') || '').match(/admin_session=[^;]+/) || [''])[0]
    const listed = await fetch(`${BASE}/api/projects`).then(r => r.json()).catch(() => [])
    const serverSees = Array.isArray(listed) && listed.some(p => p.id === sentinelId)
    const realHas = (await realDb.query('select count(*)::int as n from projects where id = $1', [sentinelId]))[0].n
    check('login de teste ok', login.status === 200 && !!cookie)
    check('o servidor de teste enxerga a sentinela (usa o banco de teste)', serverSees)
    check('o banco real NÃO tem a sentinela', realHas === 0)
    await testDb.query('delete from projects where id = $1 and title = $2', [sentinelId, sentinel])
    sentinelId = null
    if (!(login.status === 200 && cookie && serverSees && realHas === 0)) {
      console.error('Isolamento NÃO comprovado: nenhuma escrita via API foi executada.')
      process.exitCode = 2
      return
    }

    console.log('\nProjetos — criar')
    const min = await api('POST', '/api/projects', { body: { title: `${T}_min`, description: 'd' } })
    check('criar mínimo → 201', min.status === 201 && /^[0-9a-f-]{36}$/.test(min.data?.id ?? ''))
    check('padrões: category=web, featured=false, listas vazias, strings vazias', min.data?.category === 'web' && min.data?.featured === false && same(min.data?.tags, []) && same(min.data?.gallery_urls, []) && min.data?.image_url === '' && min.data?.long_description === '' && !!min.data?.created_at)
    const longText = 'linha1\n"aspas" \'simples\' <b>x</b> ' + 'ç✓日本'.repeat(300)
    const full = await api('POST', '/api/projects', { body: {
      title: `${T}_full ção ✓ 日本`, description: 'desc completa', long_description: longText, tags: ['React', 'Node.js', 'IoT'],
      image_url: 'https://example.com/capa.png', gallery_urls: ['https://example.com/g1.png', 'https://example.com/g2.jpg'],
      demo_url: 'https://example.com/demo', repo_url: 'https://github.com/x/y', doc_url: 'https://example.com/d.pdf', category: 'iot', featured: true,
    } })
    check('criar completo → 201', full.status === 201)
    const dbFull = full.data?.id ? (await testDb.query('select * from projects where id = $1', [full.data.id]))[0] : null
    check('persistido igual ao enviado (texto longo, unicode, arrays, categoria)', !!dbFull && dbFull.long_description === longText && dbFull.title.endsWith('ção ✓ 日本') && same(dbFull.tags, ['React', 'Node.js', 'IoT']) && same(dbFull.gallery_urls, ['https://example.com/g1.png', 'https://example.com/g2.jpg']) && dbFull.category === 'iot' && dbFull.featured === true)
    const evil = `${T}_'; DROP TABLE projects;--`
    const inj = await api('POST', '/api/projects', { body: { title: evil, description: "x'); DELETE FROM projects;--" } })
    const dbInj = inj.data?.id ? (await testDb.query('select title, description from projects where id = $1', [inj.data.id]))[0] : null
    check('texto com SQL é guardado literalmente', inj.status === 201 && dbInj?.title === evil && dbInj?.description === "x'); DELETE FROM projects;--")
    check('tabelas intactas após o texto com SQL', (await testDb.query("select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('projects','documents')"))[0].n === 2)

    console.log('\nProjetos — leitura e ordenação')
    const mk = async (suffix, featured) => { const r = await api('POST', '/api/projects', { body: { title: `${T}_ord_${suffix}`, description: 'o', featured } }); await sleep(30); return r.data?.id }
    const oA = await mk('A', false), oB = await mk('B', true), oC = await mk('C', false)
    const ords = new Set([oA, oB, oC])
    const byFeatured = (await api('GET', '/api/projects', { auth: false })).data
    check('GET público inclui os criados', Array.isArray(byFeatured) && [min.data.id, full.data.id, oA, oB, oC].every(id => byFeatured.some(p => p.id === id)))
    check('ordem padrão: destaque primeiro, depois mais recentes (B, C, A)', same(byFeatured.filter(p => ords.has(p.id)).map(p => p.id), [oB, oC, oA]))
    const recent = (await api('GET', '/api/projects?sort=recent', { auth: false })).data
    check('?sort=recent: mais recentes primeiro (C, B, A)', same(recent.filter(p => ords.has(p.id)).map(p => p.id), [oC, oB, oA]))

    console.log('\nProjetos — editar')
    const id = full.data.id
    const base = (await testDb.query('select * from projects where id = $1', [id]))[0]
    const p1 = await api('PATCH', `/api/projects/${id}`, { body: { featured: false } })
    check('PATCH parcial (featured) → 200 e só ele muda', p1.status === 200 && p1.data?.featured === false && p1.data?.title === base.title && same(p1.data?.tags, base.tags) && p1.data?.id === base.id && new Date(p1.data?.created_at).getTime() === new Date(base.created_at).getTime())
    const p2 = await api('PATCH', `/api/projects/${id}`, { body: { tags: ['novo'], gallery_urls: [], image_url: '', category: 'mobile', title: `${T}_full editado` } })
    const dbP2 = (await testDb.query('select * from projects where id = $1', [id]))[0]
    check('PATCH múltiplos campos (tags, galeria vazia, capa limpa, categoria, título)', p2.status === 200 && same(dbP2.tags, ['novo']) && same(dbP2.gallery_urls, []) && dbP2.image_url === '' && dbP2.category === 'mobile' && dbP2.title === `${T}_full editado` && dbP2.demo_url === base.demo_url && dbP2.long_description === base.long_description)
    check('PATCH de UUID inexistente → 404', (await api('PATCH', `/api/projects/${NOPE}`, { body: { featured: true } })).status === 404)
    check('PATCH com dado inválido → 400 e nada muda', (await api('PATCH', `/api/projects/${id}`, { body: { category: 'desktop' } })).status === 400 && (await testDb.query('select category from projects where id = $1', [id]))[0].category === 'mobile')

    console.log('\nProjetos — excluir')
    const del = await api('DELETE', `/api/projects/${id}`)
    check('DELETE → 200', del.status === 200 && del.data?.ok === true)
    check('some do GET e do banco', !(await api('GET', '/api/projects', { auth: false })).data.some(p => p.id === id) && (await testDb.query('select count(*)::int as n from projects where id = $1', [id]))[0].n === 0)
    check('DELETE repetido → 404', (await api('DELETE', `/api/projects/${id}`)).status === 404)
    check('DELETE de UUID inexistente → 404', (await api('DELETE', `/api/projects/${NOPE}`)).status === 404)

    console.log('\nDocumentos')
    const docs = []
    for (const type of ['cv', 'doc', 'cert']) {
      const r = await api('POST', '/api/documents', { body: { title: `${T}_doc_${type}`, type, file_url: `https://example.com/${type}.pdf` } })
      await sleep(30)
      check(`criar documento ${type} → 201`, r.status === 201 && r.data?.type === type)
      docs.push(r.data?.id)
    }
    const dmin = await api('POST', '/api/documents', { body: { title: `${T}_doc_default`, file_url: 'https://example.com/x.pdf' } })
    check('tipo padrão = doc', dmin.status === 201 && dmin.data?.type === 'doc')
    const dset = new Set([...docs, dmin.data?.id])
    const dl = (await api('GET', '/api/documents', { auth: false })).data
    check('GET ordena por data decrescente (default, cert, doc, cv)', same(dl.filter(d => dset.has(d.id)).map(d => d.id), [dmin.data.id, docs[2], docs[1], docs[0]]))
    const pd = await api('PATCH', `/api/documents/${docs[0]}`, { body: { title: `${T}_doc_editado`, type: 'cert', file_url: 'https://example.com/novo.pdf' } })
    const dbD = (await testDb.query('select * from documents where id = $1', [docs[0]]))[0]
    check('PATCH documento (título, tipo, URL) → 200 e persistido', pd.status === 200 && dbD.title === `${T}_doc_editado` && dbD.type === 'cert' && dbD.file_url === 'https://example.com/novo.pdf')
    check('PATCH documento com tipo inválido → 400', (await api('PATCH', `/api/documents/${docs[0]}`, { body: { type: 'pdf' } })).status === 400)
    check('PATCH documento inexistente → 404', (await api('PATCH', `/api/documents/${NOPE}`, { body: { title: 'x' } })).status === 404)
    check('DELETE documento → 200', (await api('DELETE', `/api/documents/${docs[0]}`)).status === 200)
    check('DELETE documento repetido → 404', (await api('DELETE', `/api/documents/${docs[0]}`)).status === 404)
    check('documento some do GET', !(await api('GET', '/api/documents', { auth: false })).data.some(d => d.id === docs[0]))

    console.log('\nRestrições do banco (inserção direta, só no banco de teste)')
    const rej = async (sqlText, params) => { try { await testDb.query(sqlText, params); return false } catch (e) { return e?.code === '23514' } }
    check('CHECK de projects.category rejeita valor inválido', await rej('insert into projects (title, description, category) values ($1, $2, $3)', [`${T}_chk`, 'd', 'desktop']))
    check('CHECK de documents.type rejeita valor inválido', await rej('insert into documents (title, type, file_url) values ($1, $2, $3)', [`${T}_chk`, 'pdf', 'https://example.com/x']))

    console.log('\nSessão e origem (nenhuma linha deve ser criada)')
    const countOwn = async () => (await testDb.query('select count(*)::int as n from projects where starts_with(title, $1)', [PREFIX]))[0].n
    const c0 = await countOwn()
    check('POST sem cookie → 401', (await api('POST', '/api/projects', { body: { title: `${T}_x`, description: 'd' }, auth: false })).status === 401)
    check('POST com origem inválida → 403', (await api('POST', '/api/projects', { body: { title: `${T}_x`, description: 'd' }, origin: 'https://evil.example' })).status === 403)
    check('nenhuma linha criada pelas requisições recusadas', (await countOwn()) === c0)
  } finally {
    // Limpeza: só linhas criadas por este teste (ids + prefixo), só no banco de teste.
    try {
      const ids = [...owned]
      const dp = await testDb.query('delete from projects where id = any($1::uuid[]) and starts_with(title, $2) returning id', [ids, PREFIX])
      const dd = await testDb.query('delete from documents where id = any($1::uuid[]) and starts_with(title, $2) returning id', [ids, PREFIX])
      if (sentinelId) await testDb.query('delete from projects where id = $1 and starts_with(title, $2)', [sentinelId, PREFIX])
      // linhas do teste inseridas diretamente (ex.: se um CHECK falhasse em rejeitar): remove só pelo prefixo deste teste
      await testDb.query('delete from projects where starts_with(title, $1)', [`${T}`])
      await testDb.query('delete from documents where starts_with(title, $1)', [`${T}`])
      console.log(`\nLimpeza: ${dp.length} projeto(s) e ${dd.length} documento(s) restante(s) removidos do banco de teste.`)
    } catch { console.error('Falha na limpeza do banco de teste: remova manualmente as linhas com prefixo __crud_.') }
    stopServer()
  }

  console.log('\nVerificação final')
  const after = { test: await snapshot(testDb), real: await snapshot(realDb) }
  check('linhas pré-existentes do banco de teste inalteradas', same(before.test, after.test))
  check('banco real inalterado (hash e contagem)', same(before.real, after.real))
  const rest = (await testDb.query("select (select count(*) from projects where starts_with(title,$1))::int + (select count(*) from documents where starts_with(title,$1))::int as n", [PREFIX]))[0].n
  check('nenhuma linha de teste sobrou', rest === 0)

  console.log(`\nResultado: ${passed} ok, ${failed} falhas`)
  process.exitCode = failed ? 1 : 0
}
main().catch(e => { console.error('Erro no teste:', e.message); stopServer(); process.exitCode = 2 })
process.on('exit', stopServer)
