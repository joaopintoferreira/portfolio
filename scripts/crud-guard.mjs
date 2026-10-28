// Travas de isolamento do teste de CRUD (funções puras, sem rede e sem escrita).
// Usado por scripts/test-crud.mjs. Nunca imprime URLs, hosts completos nem credenciais.

// Extrai a identidade de uma URL de conexão Postgres do Neon.
// O "endpoint" ignora o sufixo -pooler: a URL com pooler e a direta são o MESMO banco.
export function parseDb(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') return null
    const host = u.hostname.toLowerCase()
    return {
      host,
      endpoint: host.split('.')[0].replace(/-pooler$/, ''),
      db: decodeURIComponent(u.pathname.replace(/^\//, '')),
    }
  } catch {
    return null
  }
}

// Decide se o teste de escrita pode prosseguir. Devolve { ok:true } ou { ok:false, reason }.
export function checkIsolation({ allow, testUrl, confirmHost, realUrl }) {
  if (allow !== '1') return { ok: false, reason: 'ALLOW_WRITE_TESTS=1 não definido.' }
  if (!testUrl) return { ok: false, reason: 'TEST_DATABASE_URL não definido.' }
  if (!confirmHost) return { ok: false, reason: 'TEST_DB_CONFIRM_HOST não definido.' }
  if (!realUrl) return { ok: false, reason: 'DATABASE_URL (banco real) ausente: não é possível provar que o banco de teste é diferente.' }

  const t = parseDb(testUrl)
  const r = parseDb(realUrl)
  if (!t) return { ok: false, reason: 'TEST_DATABASE_URL inválida.' }
  if (!r) return { ok: false, reason: 'DATABASE_URL (banco real) inválida.' }
  if (confirmHost.trim().toLowerCase() !== t.host) {
    return { ok: false, reason: 'TEST_DB_CONFIRM_HOST não confere com o host de TEST_DATABASE_URL.' }
  }
  if (t.endpoint === r.endpoint) {
    return { ok: false, reason: 'O banco de teste usa o mesmo endpoint do banco real (inclui a variante com/sem -pooler).' }
  }
  return { ok: true }
}
