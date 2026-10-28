# Arquivos históricos do Supabase

Estes arquivos são **apenas registro histórico** da versão do portfólio que usava o Supabase. Foram movidos para cá sem alteração de conteúdo e **não fazem parte da aplicação atual**.

| Arquivo | O que era | Observação |
|---|---|---|
| `supabase-schema.sql` | Esquema original (tabelas `projects` e `documents`, RLS e buckets) | Não inclui a coluna `gallery_urls`, que o código passou a usar depois. Substituído por `neon-schema.sql` na raiz do projeto. |
| `seed.js` | Script de dados de exemplo para o Supabase | **Destrutivo:** apaga todas as linhas de `projects` e `documents` antes de inserir. **Não execute.** Também não roda mais: `@supabase/supabase-js` e `dotenv` foram removidos do projeto. |

## Arquitetura atual
- **Dados:** NeonDB (PostgreSQL), acessado só pelo servidor (`src/lib/db.ts`); esquema em `neon-schema.sql`.
- **Arquivos (capas, galeria, PDFs):** Vercel Blob, com upload direto autorizado por `/api/upload`.
- **Contato:** Resend, via `/api/contact`.

Consulte o `README.md` da raiz para instalação, variáveis de ambiente e deploy.
