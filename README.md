# 🚀 Portfólio Pessoal — João

Site portfólio dark/tech com painel admin dinâmico.  
Stack: **Next.js 14 + Tailwind CSS + Supabase + Vercel**

---

## ⚡ Setup em 5 passos

### 1. Instalar dependências

```bash
npm install
```

---

### 2. Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Crie um novo projeto
3. Vá em **SQL Editor → New Query** e execute o conteúdo de `supabase-schema.sql`
4. Vá em **Storage → New Bucket** e crie dois buckets:
   - `images` → marque como **Public**
   - `docs` → marque como **Public**
5. Vá em **Settings → API** e copie:
   - `Project URL`
   - `anon public key`

---

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
ADMIN_PASSWORD=suasenhasegura123
```

---

### 4. Rodar localmente

```bash
npm run dev
```

Acesse:
- **Site:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

---

### 5. Deploy no Vercel

```bash
# Instale a CLI do Vercel (se não tiver)
npm i -g vercel

# Deploy
vercel
```

Ou conecte o repositório GitHub direto no [vercel.com](https://vercel.com) e adicione as variáveis de ambiente nas configurações do projeto.

> **Importante:** Adicione as mesmas variáveis do `.env.local` no painel do Vercel em  
> **Project Settings → Environment Variables**

---

## 📁 Estrutura

```
src/
├── app/
│   ├── page.tsx          ← Site principal
│   ├── admin/
│   │   └── page.tsx      ← Painel admin
│   └── api/
│       └── auth/route.ts ← Autenticação do admin
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx          ← Typing effect animado
│   ├── Skills.tsx
│   ├── ProjectCard.tsx
│   ├── DocsSection.tsx
│   ├── Contact.tsx
│   └── Footer.tsx
└── lib/
    └── supabase.ts       ← Cliente + tipos
```

---

## 🎛️ Usando o painel Admin

Acesse `/admin` com a senha definida em `ADMIN_PASSWORD`.

**Projetos:**
- Adicionar título, descrição, categoria (web/mobile/iot/other)
- Upload de imagem de capa direto para o Supabase Storage
- URLs de demo, GitHub, documentação
- Upload de PDF de documentação do projeto
- Tags separadas por vírgula
- Marcar como "destaque" (aparece primeiro)
- Editar e excluir qualquer projeto

**Docs / CV:**
- Upload de PDFs (currículo, documentação, certificados)
- Aparecem na seção "CV & Docs" do site com botão de download

---

## ✏️ Personalização

Edite os seguintes pontos para colocar seus dados:

| Arquivo | O que mudar |
|---|---|
| `src/components/Hero.tsx` | Nome, bio, status |
| `src/components/Skills.tsx` | Suas tecnologias |
| `src/components/Contact.tsx` | Email, links sociais |
| `src/app/layout.tsx` | Meta title, description |
| `tailwind.config.js` | Cores (accent, bg...) |

---

## 📬 Integrar formulário de contato

No `Contact.tsx`, substitua o `fetch` simulado por uma integração real:

- **[Resend](https://resend.com)** — envio de email via API (recomendado)
- **[Formspree](https://formspree.io)** — sem backend, só o action do form
- **[EmailJS](https://www.emailjs.com)** — direto do front sem backend

---

## 🔐 Segurança do Admin

O admin usa uma senha simples via `sessionStorage`. Para produção mais robusta:
- Use **Supabase Auth** (email/senha ou magic link)
- Ou adicione **NextAuth.js**

A senha nunca é exposta no frontend — a verificação é feita pela API Route no servidor.
