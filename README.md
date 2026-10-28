# 🚀 Portfólio Pessoal — João

Site portfólio dark/tech com painel admin dinâmico.  
Stack: **Next.js 15 (React 19) + Tailwind CSS + NeonDB (PostgreSQL) + Vercel Blob + Vercel** — requer **Node.js 20 ou superior**

- **Dados** (projetos e documentos): NeonDB, acessado **somente pelo servidor** (rotas `/api/*`).
- **Arquivos** (capas, galeria, PDFs): Vercel Blob, com upload direto autorizado pelo servidor.
- **Contato**: formulário que envia e-mail pelo Resend.

---

## ⚡ Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o banco no NeonDB

1. Crie um projeto em [neon.tech](https://neon.tech).
2. Em **Connection Details**, copie a string de conexão **com pooler** (host com `-pooler`).
3. No **SQL Editor** do Neon, execute o conteúdo de [`neon-schema.sql`](neon-schema.sql). Ele cria as tabelas `projects` e `documents` (`create table if not exists`; não apaga nem altera dados existentes).

Não há dados de exemplo: o banco começa vazio e os registros são cadastrados pelo painel `/admin`.

### 3. Criar o Blob store (arquivos)

1. No painel da Vercel: **Storage → Create → Blob** e conecte ao projeto.
2. Copie o `BLOB_READ_WRITE_TOKEN`.

### 4. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` (nunca versione esse arquivo e nunca use o prefixo `NEXT_PUBLIC_` nestas variáveis):

| Variável | Para quê | Observação |
|---|---|---|
| `DATABASE_URL` | Conexão com o NeonDB | Use a string do pooler |
| `BLOB_READ_WRITE_TOKEN` | Uploads no Vercel Blob | Fica só no servidor |
| `ADMIN_PASSWORD` | Senha do painel `/admin` | Sem valor padrão: sem ela o login falha |
| `SESSION_SECRET` | Assina o cookie de sessão do admin | **Mínimo 32 caracteres**, ex.: `openssl rand -base64 48` |
| `RESEND_API_KEY`, `CONTACT_EMAIL` | Envio do formulário de contato | Em produção, sem elas o contato responde "indisponível" |
| `ALLOWED_ORIGINS` | *(opcional)* origens permitidas para escritas | Necessária com domínio próprio, ex.: `https://meusite.com` |

### 5. Rodar localmente

```bash
npm run dev
```

- **Site:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

### 6. Deploy no Vercel

```bash
npm i -g vercel   # se ainda não tiver
vercel
```

Ou conecte o repositório do GitHub em [vercel.com](https://vercel.com). Em **Project Settings → Environment Variables**, adicione as mesmas variáveis do `.env.local`.

- Na Vercel, as origens do deploy (`VERCEL_PROJECT_PRODUCTION_URL` e `VERCEL_URL`) são aceitas automaticamente nas operações de escrita.
- Com **domínio próprio**, defina também `ALLOWED_ORIGINS`.

---

## 🎛️ Painel Admin (`/admin`)

Acesse `/admin` com a senha definida em `ADMIN_PASSWORD`.

**Projetos:**
- Título, descrição, categoria (web/mobile/iot/other) e tags separadas por vírgula
- Imagem de capa e galeria de imagens (JPG, PNG, WebP, GIF ou AVIF, até 10 MB cada)
- Links de demo, GitHub e documentação; PDF de documentação (até 25 MB)
- Marcar como "destaque" (aparece primeiro)
- Editar e excluir projetos

**Docs / CV:**
- Upload de PDFs (currículo, documentação, certificados), exibidos na seção "CV & Docs" com botão de download

---

## 🔐 Segurança

- **Login:** `POST /api/auth` valida a senha e define um cookie de sessão `HttpOnly`, `SameSite=Lax` (`Secure` em produção), assinado com HMAC e válido por 8 horas. O estado de login **não** fica no navegador (`sessionStorage`/`localStorage`).
- **Autorização no servidor:** toda escrita (criar/editar/excluir projetos e documentos, e emissão de tokens de upload) exige sessão válida **e** cabeçalho `Origin` permitido.
- **Banco:** consultas parametrizadas; entradas validadas (tipos, tamanhos, URLs `http(s)`, categorias, UUIDs).
- **Uploads:** o navegador envia direto ao Blob com um token restrito (caminho, tipo e tamanho) emitido por `/api/upload`; SVG é recusado.
- **Contato:** campos validados, conteúdo do usuário escapado no e-mail, sem quebras de linha em nome/e-mail e timeout na chamada ao Resend.
- **Limites de tentativas** (login do admin e envios do contato): ficam **em memória, por instância**. É uma mitigação, **não** um limite global em ambiente serverless.
- **Cabeçalhos de segurança** (em `next.config.js`, todas as rotas): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` e `Permissions-Policy` com câmera, microfone, geolocalização, pagamento e USB desativados. A **CSP não está ativa**: veja a proposta em [`docs/csp-proposta.md`](docs/csp-proposta.md).
- **Imagens:** o otimizador do Next só aceita imagens do hostname exato da store do Blob configurado em `next.config.js` (`images.remotePatterns`). Se a store mudar, atualize esse hostname.
- O logout é *stateless*: remove o cookie, mas não revoga um token já emitido antes de expirar. Para invalidar todas as sessões, troque o `SESSION_SECRET`.

---

## 🧪 Testes

Scripts em `scripts/` (usam `node --env-file=.env.local`, nunca imprimem senhas, tokens ou cookies):

| Script | O que faz | Como rodar |
|---|---|---|
| `test-api.mjs` | Leitura pública, escrita recusada sem sessão, origem, login, tokens inválidos, validação, rate limit. **Nunca escreve no banco** | `npm run dev -- -p 3100` e `node --env-file=.env.local scripts/test-api.mjs http://localhost:3100` |
| `test-upload.mjs` | Autorização e regras do `/api/upload` e upload real. **Grava e apaga arquivos `__test__` no Blob store** | com o servidor em 3100: `node --env-file=.env.local scripts/test-upload.mjs http://localhost:3100` |
| `test-contact.mjs` | Validação e segurança do contato com um **Resend falso** local; sobe os próprios servidores (portas 3200/3201) e **não envia e-mails reais** | `node scripts/test-contact.mjs` |

> ⚠️ `test-upload.mjs` **cria e apaga arquivos na Blob store real** e `test-crud.mjs` **escreve em banco**. Não rode o primeiro sem querer mexer na store, e rode o segundo só contra um banco de teste isolado (veja abaixo). `test-api.mjs` e `test-contact.mjs` não escrevem no banco, no Blob nem enviam e-mails.

Verificações gerais: `npx tsc --noEmit --incremental false`, `npm run build` e `npm audit`.

### CRUD completo (escrita) — somente em banco de teste isolado

`scripts/test-crud.mjs` valida criar/editar/excluir/ordenar projetos e documentos, mas **escreve dados**, por isso só roda contra um banco de teste separado (por exemplo, um **branch do Neon** — apague-o depois). Ele **recusa-se a executar** sem estas variáveis no seu shell:

| Variável | Conteúdo |
|---|---|
| `ALLOW_WRITE_TESTS=1` | consentimento explícito |
| `TEST_DATABASE_URL` | string de conexão do banco de teste (**não** a de produção; não guarde em arquivo versionado) |
| `TEST_DB_CONFIRM_HOST` | o host dessa URL, digitado por você |

```bash
ALLOW_WRITE_TESTS=1 TEST_DATABASE_URL='postgresql://…' TEST_DB_CONFIRM_HOST='ep-…neon.tech' \
  node --env-file=.env.local scripts/test-crud.mjs
```

Travas de isolamento: compara o endpoint do banco de teste com o `DATABASE_URL` real (incluindo a variante `-pooler`), sobe o **próprio** servidor de desenvolvimento (porta 3300) ligado só ao banco de teste, grava uma linha sentinela no banco de teste e exige que o servidor a veja **e** que o banco real não a tenha antes de qualquer escrita via API. Só altera linhas criadas por ele, compara hashes das linhas pré-existentes (teste e real) antes/depois e limpa tudo ao final. Não usa o Blob nem o Resend. Pare outros `npm run dev` antes (compartilham a pasta `.next`).

---

## 🛡️ Dependências e manutenção

- **Next.js 15.5.28** inclui as correções do aviso oficial de segurança de 14/out/2026 (otimização de imagens, `use cache` e Server Actions). Versões 14.x não recebem mais correções.
- O Next 15 está na fase *Maintenance LTS* (suporte previsto para terminar por volta de **21/out/2026**, pela regra de dois anos da política oficial). **Planeje a migração para o Next 16** em seguida.
- Rode `npm audit` periodicamente e mantenha `next`, `react` e `react-dom` nas versões corrigidas.

---

## 📁 Estrutura

```
neon-schema.sql           ← Esquema PostgreSQL (NeonDB)
legacy/supabase/          ← Arquivos históricos do Supabase (não usar)
docs/                     ← Documentação técnica (Vercel Blob)
scripts/                  ← Testes (API, upload, contato, CRUD isolado)
src/
├── app/
│   ├── page.tsx          ← Site principal
│   ├── admin/page.tsx    ← Painel admin
│   └── api/
│       ├── auth/         ← Login, sessão e logout
│       ├── projects/     ← Listar (público) e CRUD (admin)
│       ├── documents/    ← Listar (público) e CRUD (admin)
│       ├── upload/       ← Token de upload direto (admin)
│       └── contact/      ← Formulário de contato (Resend)
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx          ← Typing effect animado
│   ├── Skills.tsx
│   ├── ProjectCard.tsx
│   ├── DocsSection.tsx
│   ├── Contact.tsx
│   └── Footer.tsx
└── lib/
    ├── db.ts             ← Cliente NeonDB (somente servidor)
    ├── auth.ts           ← Sessão, senha e verificação de origem
    ├── api.ts            ← Helpers de resposta e leitura de JSON
    ├── validation.ts     ← Validação de projetos/documentos
    ├── crud.ts           ← Criar/editar/excluir (admin)
    ├── upload-policy.ts  ← Regras de upload (tipos e tamanhos)
    ├── contact.ts        ← Validação e montagem do e-mail de contato
    └── types.ts          ← Tipos Project e Document
```

---

## ✏️ Personalização

| Arquivo | O que mudar |
|---|---|
| `src/components/Hero.tsx` | Nome, bio, status |
| `src/components/Skills.tsx` | Suas tecnologias |
| `src/components/Contact.tsx` | Email, links sociais |
| `src/app/layout.tsx` | Meta title, description |
| `tailwind.config.js` | Cores (accent, bg...) |

---

## 🗂️ Histórico: migração do Supabase

O projeto usava o Supabase para banco e armazenamento. Foi migrado para NeonDB + Vercel Blob. Os arquivos antigos (esquema e script de dados de exemplo) estão em [`legacy/supabase/`](legacy/supabase/README.md) apenas como registro; o script de exemplo é destrutivo e **não deve ser executado**. Arquivos que estavam no Supabase Storage não foram migrados e precisam ser reenviados pelo painel.
