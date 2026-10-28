// Testes de /api/contact SEM enviar e-mails reais e sem credenciais.
//
// O script sobe sozinho:
//   - um Resend FALSO (servidor HTTP local) que registra o que receberia;
//   - um `next dev` com RESEND_API_KEY=test-key, CONTACT_EMAIL=destino@example.test e
//     RESEND_API_URL apontando para o Resend falso (essas variáveis no ambiente do processo têm
//     precedência sobre o .env.local; o script NÃO lê o .env.local);
//   - um segundo `next dev` sem Resend configurado (fallback de desenvolvimento).
// Não toca no NeonDB nem na Blob store.
//
// Uso:  node scripts/test-contact.mjs
import { spawn } from 'node:child_process'
import http from 'node:http'
import { randomBytes } from 'node:crypto'

const PORT_A = 3200 // configurado (Resend falso)
const PORT_B = 3201 // sem Resend
const SENTINEL = 'SENTINELA-' + randomBytes(4).toString('hex') // aparece só em respostas do Resend falso
const MARK = 'MARCADOR-' + randomBytes(4).toString('hex') // aparece só em mensagens enviadas
const TEST_KEY = 'test-key'
const TEST_TO = 'destino@example.test'

let passed = 0, failed = 0
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}
const rndIp = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`

// ── Resend falso ──
let mode = 'ok'
let calls = []
const mock = http.createServer((req, res) => {
  let raw = ''
  req.on('data', c => (raw += c))
  req.on('end', () => {
    let body = null
    try { body = JSON.parse(raw) } catch {}
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body })
    if (mode === 'close') return req.socket.destroy()
    if (mode === 'hang') return setTimeout(() => { try { res.end('{}') } catch {} }, 12000)
    if (mode === '500') { res.writeHead(500); return res.end(`{"error":"${SENTINEL}"}`) }
    if (mode === '401') { res.writeHead(401); return res.end(`{"message":"${SENTINEL}"}`) }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{"id":"fake"}')
  })
})
const listen = () => new Promise(r => mock.listen(0, '127.0.0.1', () => r(mock.address().port)))

// ── next dev ──
function startServer(port, extraEnv) {
  const env = { ...process.env, ...extraEnv }
  delete env.NODE_ENV
  const child = spawn('npx', ['next', 'dev', '-p', String(port)], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const server = { child, log: '' }
  child.stdout.on('data', d => (server.log += d))
  child.stderr.on('data', d => (server.log += d))
  return server
}
const stop = s => { try { process.kill(-s.child.pid, 'SIGTERM') } catch {} }
async function waitUp(port) {
  for (let i = 0; i < 90; i++) {
    try { await fetch(`http://localhost:${port}/api/contact`); return true } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

async function post(port, body, { ip = rndIp(), type = 'application/json', raw } = {}) {
  const headers = { 'x-real-ip': ip }
  if (type) headers['Content-Type'] = type
  const res = await fetch(`http://localhost:${port}/api/contact`, {
    method: 'POST', headers, body: raw !== undefined ? raw : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch {}
  return { status: res.status, data, text }
}

const VALID = { name: 'Ana Silva', email: 'ana@example.com', message: 'Olá, gostei do portfólio.' }
const sent = () => calls.at(-1)?.body

async function main() {
  const mockPort = await listen()
  const A = startServer(PORT_A, { RESEND_API_KEY: TEST_KEY, CONTACT_EMAIL: TEST_TO, RESEND_API_URL: `http://127.0.0.1:${mockPort}/emails` })
  // RESEND_API_URL também aponta para o falso: se, por engano, chaves reais fossem carregadas, nada sairia da máquina.
  const B = startServer(PORT_B, { RESEND_API_KEY: '', CONTACT_EMAIL: '', RESEND_API_URL: `http://127.0.0.1:${mockPort}/emails` })
  process.on('exit', () => { stop(A); stop(B) })
  try {
    const [upA, upB] = await Promise.all([waitUp(PORT_A), waitUp(PORT_B)])
    if (!upA || !upB) { console.error('Servidores de teste não iniciaram.'); process.exitCode = 2; return }
    console.log(`Resend falso em 127.0.0.1:${mockPort}; servidores ${PORT_A} (configurado) e ${PORT_B} (sem Resend)\n`)

    console.log('A. Pedido válido')
    calls = []; mode = 'ok'
    let r = await post(PORT_A, VALID)
    check('200 {ok:true}', r.status === 200 && r.data?.ok === true)
    check('o serviço falso recebeu exatamente 1 chamada', calls.length === 1)
    check('Authorization com a chave de teste', calls[0]?.auth === `Bearer ${TEST_KEY}`)
    check('destinatário vem da configuração', JSON.stringify(sent()?.to) === JSON.stringify([TEST_TO]))
    check('assunto sem quebras de linha e com o nome', /^\[Portfolio\] Mensagem de Ana Silva$/.test(sent()?.subject))
    check('html e text presentes', typeof sent()?.html === 'string' && sent()?.text.includes(VALID.message))
    check('limites no máximo aceitos (nome 100, mensagem 5000)', (await post(PORT_A, { ...VALID, name: 'n'.repeat(100), message: 'm'.repeat(5000) })).status === 200)
    check('e-mails legítimos aceitos', (await post(PORT_A, { ...VALID, email: "o'brien+tag@mail.example.co.uk" })).status === 200)

    console.log('\nB. Campos obrigatórios, tipos e JSON')
    calls = []
    for (const [label, body] of Object.entries({
      'corpo vazio': {}, 'sem name': { email: VALID.email, message: VALID.message },
      'sem email': { name: 'A', message: 'm' }, 'sem message': { name: 'A', email: VALID.email },
      'name vazio': { ...VALID, name: '' }, 'name só espaços': { ...VALID, name: '   ' },
      'message só espaços/quebras': { ...VALID, message: ' \n\t ' }, 'campo null': { ...VALID, email: null },
    })) {
      const x = await post(PORT_A, body)
      check(`${label} → 400 "Campos obrigatórios faltando."`, x.status === 400 && x.data?.error === 'Campos obrigatórios faltando.', `recebido ${x.status}`)
    }
    for (const [label, body] of Object.entries({
      'name número': { ...VALID, name: 123 }, 'email objeto': { ...VALID, email: { a: 1 } },
      'message array': { ...VALID, message: ['x'] }, 'name booleano': { ...VALID, name: true },
      'corpo array': [VALID], 'corpo string': 'oi', 'corpo número': 5, 'corpo null': null,
    })) {
      const x = await post(PORT_A, body)
      check(`${label} → 400`, x.status === 400 && !!x.data?.error, `recebido ${x.status}`)
    }
    check('JSON inválido → 400', (await post(PORT_A, null, { raw: '{"name":' })).status === 400)
    check('Content-Type text/plain → 415', (await post(PORT_A, null, { raw: JSON.stringify(VALID), type: 'text/plain' })).status === 415)
    check('sem Content-Type → 415', (await post(PORT_A, null, { raw: JSON.stringify(VALID), type: null })).status === 415)
    check('corpo > 64 KB → 413', (await post(PORT_A, { ...VALID, message: 'x'.repeat(70000) })).status === 413)
    check('nenhuma chamada ao serviço de e-mail nos pedidos inválidos', calls.length === 0)

    console.log('\nC. E-mail e limites')
    for (const email of ['abc', 'a@b', 'a b@c.co', '@c.co', 'a@.co', 'a@b..co', 'a@@b.co', '<a>@b.co', 'a@-b.co', 'a"b@c.co', '"><script>x@y.co', 'a@b.co>']) {
      const x = await post(PORT_A, { ...VALID, email })
      check(`e-mail inválido ${JSON.stringify(email)} → 400`, x.status === 400 && x.data?.error === 'E-mail inválido.', `recebido ${x.status} ${x.data?.error ?? ''}`)
    }
    const longEmail = 'a'.repeat(64) + '@' + ('b'.repeat(63) + '.').repeat(3) + 'com' // 260 caracteres
    check(`e-mail com ${longEmail.length} caracteres (> 254) → 400`, longEmail.length > 254 && (await post(PORT_A, { ...VALID, email: longEmail })).status === 400)
    check('parte local com 65 caracteres → 400', (await post(PORT_A, { ...VALID, email: 'a'.repeat(65) + '@example.com' })).status === 400)
    check('name com 101 caracteres → 400', (await post(PORT_A, { ...VALID, name: 'n'.repeat(101) })).status === 400)
    check('message com 5001 caracteres → 400', (await post(PORT_A, { ...VALID, message: 'm'.repeat(5001) })).status === 400)
    check('nenhuma chamada ao serviço nos pedidos inválidos', calls.length === 0)

    console.log('\nD. HTML e scripts são dados, não marcação')
    calls = []
    const attack = `<script>alert(1)</script><img src=x onerror=alert(1)> "aspas" 'simples' & ${MARK}`
    r = await post(PORT_A, { name: '<b>Ana</b>', email: "a'b@example.com", message: attack })
    check('mensagem com HTML/script é aceita → 200', r.status === 200 && r.data?.ok === true)
    const html = sent()?.html || ''
    check('<script> do usuário não aparece cru no html', !html.includes('<script>') && !html.includes('</script>'))
    check('<img ...> do usuário não aparece cru', !/<img/i.test(html))
    check('<b> do nome não aparece cru', !html.includes('<b>Ana'))
    check('formas escapadas presentes', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && html.includes('&lt;img src=x onerror=alert(1)&gt;') && html.includes('&lt;b&gt;Ana&lt;/b&gt;'))
    check('aspas e & escapados', html.includes('&quot;aspas&quot;') && html.includes('&#39;simples&#39;') && html.includes('&amp; ' + MARK))
    check('e-mail escapado no href (sem quebrar o atributo)', html.includes('href="mailto:a&#39;b@example.com"'))
    check('versão texto mantém o conteúdo original (não é HTML)', sent()?.text.includes('<script>alert(1)</script>'))

    console.log('\nE. Injeção de cabeçalhos / quebras de linha')
    calls = []
    const LS = String.fromCharCode(0x2028)
    for (const [label, body] of Object.entries({
      'name com CRLF': { ...VALID, name: 'Ana\r\nBcc: x@y.co' },
      'name com LF': { ...VALID, name: 'Ana\nBcc: x@y.co' },
      'name com U+2028': { ...VALID, name: 'Ana' + LS + 'x' },
      'name com NUL': { ...VALID, name: 'Ana\u0000' },
      'email com CRLF': { ...VALID, email: 'a@b.co\r\nBcc: x@y.co' },
      'email com LF no início': { ...VALID, email: '\na@b.co' + '\nBcc: x@y.co' },
    })) {
      const x = await post(PORT_A, body)
      check(`${label} → 400`, x.status === 400, `recebido ${x.status}`)
    }
    check('nenhuma chamada ao serviço nesses casos', calls.length === 0)
    r = await post(PORT_A, { ...VALID, message: `linha1\r\nlinha2\nBcc: x@y.co\u0000fim ${MARK}` })
    check('quebras de linha na mensagem são legítimas → 200', r.status === 200)
    check('mensagem vira <br> no html e quebra no texto; NUL removido', sent()?.html.includes('linha1<br>linha2<br>Bcc: x@y.cofim') && sent()?.text.includes('linha1\nlinha2\nBcc: x@y.cofim') && !sent()?.text.includes('\u0000'))
    check('assunto, destinatário e remetente não são afetados pela mensagem', !/[\r\n]/.test(sent()?.subject) && JSON.stringify(sent()?.to) === JSON.stringify([TEST_TO]) && sent()?.from === 'Portfolio <onboarding@resend.dev>')

    console.log('\nF. Métodos não permitidos')
    for (const m of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      const x = await fetch(`http://localhost:${PORT_A}/api/contact`, { method: m })
      check(`${m} → 405`, x.status === 405, `recebido ${x.status}`)
    }

    console.log('\nG. Falhas simuladas do serviço de e-mail')
    for (const m of ['500', '401', 'close']) {
      mode = m; calls = []
      const x = await post(PORT_A, { ...VALID, message: `falha ${m} ${MARK}` })
      check(`serviço ${m} → 500 genérico`, x.status === 500 && x.data?.error === 'Erro ao enviar mensagem.', `recebido ${x.status}`)
      check(`serviço ${m}: resposta sem detalhes do serviço`, !x.text.includes(SENTINEL) && !x.text.includes(TEST_KEY) && !x.text.includes('127.0.0.1'))
    }
    mode = 'hang'; calls = []
    const t0 = Date.now()
    const h = await post(PORT_A, { ...VALID, message: 'timeout' })
    const dt = Date.now() - t0
    check('serviço lento → 500 genérico após ~10 s (timeout)', h.status === 500 && h.data?.error === 'Erro ao enviar mensagem.' && dt >= 9000 && dt < 12000, `status ${h.status}, ${dt} ms`)
    mode = 'ok'

    console.log('\nH. Limite de frequência (por IP, em memória)')
    calls = []
    const ip = rndIp()
    let okCount = 0
    for (let i = 0; i < 5; i++) if ((await post(PORT_A, VALID, { ip })).status === 200) okCount++
    check('5 mensagens do mesmo IP → 200', okCount === 5)
    const lim = await post(PORT_A, VALID, { ip })
    check('6ª → 429 com mensagem em português', lim.status === 429 && lim.data?.error === 'Muitas mensagens. Tente novamente mais tarde.')
    check('IP bloqueado também recebe 429 com corpo inválido (sem processar)', (await post(PORT_A, { x: 1 }, { ip })).status === 429)
    check('a 6ª não chegou ao serviço de e-mail', calls.length === 5)
    check('outro IP não é afetado → 200', (await post(PORT_A, VALID)).status === 200)

    console.log('\nI. Servidor sem Resend configurado (fallback de desenvolvimento)')
    calls = []
    r = await post(PORT_B, { name: 'Zé', email: 'ze@example.com', message: `texto ${MARK}` })
    check('200 {ok:true} em desenvolvimento', r.status === 200 && r.data?.ok === true)
    check('nenhuma chamada ao serviço de e-mail sem configuração', calls.length === 0)
    check('validação continua valendo sem Resend', (await post(PORT_B, { ...VALID, email: 'x' })).status === 400)

    console.log('\nJ. Logs do servidor (sem dados pessoais nem segredos)')
    await new Promise(r => setTimeout(r, 500))
    const logs = A.log + '\n' + B.log
    check('log não contém o conteúdo das mensagens', !logs.includes(MARK) && !logs.includes('ana@example.com') && !logs.includes('ze@example.com'))
    check('log não contém o corpo das respostas do serviço nem a chave', !logs.includes(SENTINEL) && !logs.includes(TEST_KEY))
    check('log registra apenas metadados do fallback', /\[api:contact\] \(dev, sem Resend\) nome=\d+ email=\d+ mensagem=\d+ caracteres/.test(B.log))
    check('log registra falhas do serviço só com status/tipo', /serviço de e-mail respondeu 500/.test(A.log) && /serviço de e-mail respondeu 401/.test(A.log))
  } finally {
    stop(A); stop(B); mock.close()
  }
  console.log(`\nResultado: ${passed} ok, ${failed} falhas`)
  process.exitCode = failed ? 1 : 0
}
main().catch(e => { console.error('Erro no teste:', e.message); process.exitCode = 2 })
