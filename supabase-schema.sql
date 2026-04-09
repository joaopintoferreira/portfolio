-- Execute este SQL no Supabase SQL Editor:
-- https://supabase.com/dashboard -> SQL Editor -> New query

-- Tabela de projetos
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  long_description text,
  tags text[] default '{}',
  image_url text,
  demo_url text,
  repo_url text,
  doc_url text,
  category text default 'web' check (category in ('web', 'mobile', 'iot', 'other')),
  featured boolean default false,
  created_at timestamptz default now()
);

-- Tabela de documentos (CV, docs, certificados)
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text default 'doc' check (type in ('cv', 'doc', 'cert')),
  file_url text not null,
  created_at timestamptz default now()
);

-- Permitir leitura pública (site pode listar projetos/docs sem autenticação)
alter table projects enable row level security;
alter table documents enable row level security;

create policy "Leitura pública de projetos"
  on projects for select using (true);

create policy "Leitura pública de documentos"
  on documents for select using (true);

-- ATENÇÃO: As políticas de INSERT/UPDATE/DELETE ficam abertas por enquanto
-- pois o admin usa a anon key com senha própria. Em produção avançada,
-- use Supabase Auth para proteger melhor.
create policy "Admin pode gerenciar projetos"
  on projects for all using (true);

create policy "Admin pode gerenciar documentos"
  on documents for all using (true);

-- Storage buckets (crie manualmente no Supabase Dashboard > Storage)
-- Bucket 1: "images"   -> público
-- Bucket 2: "docs"     -> público
-- Configurar como Public em cada bucket
