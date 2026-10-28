# Proposta de Content-Security-Policy (NÃO implementada)

Status: **somente proposta**. A CSP não está ativa. Uma CSP errada quebra o site (fontes, estilos, scripts do Next, upload), então precisa ser testada em navegador antes de ser imposta.

## O que o site carrega hoje (levantado nos arquivos)
| Recurso | Origem | Diretiva afetada |
|---|---|---|
| Scripts do Next/React (inclui scripts inline do payload RSC, `self.__next_f.push`) | próprio domínio + inline | `script-src` (nonce ou `'unsafe-inline'`) |
| Estilos Tailwind (arquivo CSS) e `style=""` inline do framer-motion/React | próprio domínio + inline | `style-src` (precisa de `'unsafe-inline'` por causa dos atributos) |
| Fontes: `fonts.googleapis.com` (CSS) e `fonts.gstatic.com` (arquivos) — `src/app/layout.tsx` | Google Fonts | `style-src`, `font-src` |
| Imagens via `next/image` (`/_next/image`) | próprio domínio | `img-src 'self'` |
| Miniaturas/lightbox com `<img src=...>` direto e pré-visualização do painel | store do Vercel Blob | `img-src` com o hostname da store |
| `profile.jpg` | próprio domínio | `img-src 'self'` |
| Links externos (GitHub, LinkedIn, WhatsApp, Instagram) e PDFs | navegação (`target="_blank"`) | não afetados (links não são `connect-src`) |
| `fetch` para `/api/*` | próprio domínio | `connect-src 'self'` |
| Upload direto ao Vercel Blob (painel `/admin`) | API do Blob (`vercel.com`/`*.blob.vercel-storage.com`; **confirmar no Network do navegador**) | `connect-src` |

## Política candidata
```
default-src 'self';
script-src 'self' 'unsafe-inline';      # trocar por nonce quando possível (exige middleware/proxy)
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https://<host-da-store>.public.blob.vercel-storage.com;
connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com;   # confirmar endpoints do upload
form-action 'self';
frame-ancestors 'none';
base-uri 'self';
object-src 'none'
```
Observações:
- `'unsafe-inline'` em `script-src` enfraquece a proteção contra XSS; a versão com **nonce** exige gerar um nonce por requisição (middleware/proxy) e torna as páginas dinâmicas — mudança maior, a decidir separadamente.
- O `X-Frame-Options: DENY` já ativo cobre o `frame-ancestors 'none'`; manter os dois é redundante, porém inofensivo.

## Como adotar com segurança
1. Ativar primeiro como `Content-Security-Policy-Report-Only` (não bloqueia; só relata) e navegar em `/`, `/admin` (login, upload de capa/galeria/PDF, salvar), formulário de contato e abrir imagens/PDFs.
2. Ajustar as diretivas pelos avisos do console do navegador.
3. Só então trocar para `Content-Security-Policy` (imposta).
Implementação prevista: um item a mais em `securityHeaders` no `next.config.js`.
