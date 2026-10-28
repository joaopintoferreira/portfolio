# Armazenamento de arquivos: Vercel Blob

Status: **implementado** (Fase 4). Capas, galeria e PDFs são enviados direto do navegador para o Vercel Blob; o banco guarda só as URLs públicas (`projects.image_url`, `gallery_urls`, `doc_url`, `documents.file_url`).

## Fluxo
1. No painel `/admin`, o navegador chama `upload()` de `@vercel/blob/client` com `handleUploadUrl: '/api/upload'`.
2. `POST /api/upload` (`src/app/api/upload/route.ts`) exige **origem permitida e sessão de admin válida** (`guardAdminWrite`) antes de qualquer coisa; sem isso responde 403/401.
3. O servidor valida o caminho e emite um **token de cliente restrito** (`src/lib/upload-policy.ts`):
   - caminhos aceitos: `projects/<nome>.<ext>`, `gallery/<nome>.<ext>`, `docs/<nome>.pdf`; nome `[A-Za-z0-9_-]{1,80}`, extensão em minúsculas;
   - imagens (`projects/`, `gallery/`): `image/jpeg`, `png`, `webp`, `gif`, `avif`, até **10 MB** (SVG é recusado de propósito);
   - PDFs (`docs/`): `application/pdf`, até **25 MB**;
   - `addRandomSuffix` (nome final imprevisível; nunca sobrescreve) e validade de 10 minutos.
4. O navegador envia o arquivo direto ao Blob (sem passar pelo limite de ~4,5 MB das funções serverless) e recebe a URL pública, que é gravada pelo fluxo normal (`/api/projects`, `/api/documents`).

## Segurança
- `BLOB_READ_WRITE_TOKEN` é lido apenas no servidor (rota `/api/upload`); o navegador só recebe o token de cliente restrito ao caminho/tipo/tamanho.
- O callback `onUploadCompleted` não é usado (viria sem cookie e não é necessário).
- A validação do navegador (`checkFile`) é só conveniência; a imposição real é do token emitido pelo servidor e do Blob.

## Configuração
- Criar um Blob store no painel da Vercel e definir `BLOB_READ_WRITE_TOKEN` (`.env.local` e variáveis do projeto na Vercel).
- `next.config.js` libera `*.public.blob.vercel-storage.com` para `next/image`.
- Em produção, escritas exigem `Origin` permitido (`VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` automáticos; `ALLOWED_ORIGINS` para domínio próprio).

## Limitações
- Arquivos do Supabase Storage antigos não foram migrados (sem acesso); reenviar pelo painel.
- Remover/trocar uma imagem ou excluir um projeto **não apaga** o arquivo no Blob (arquivos órfãos); limpeza futura com `del()` no servidor.
- Testes: `scripts/test-upload.mjs` (grava e apaga arquivos `__test__` só na Blob store).
