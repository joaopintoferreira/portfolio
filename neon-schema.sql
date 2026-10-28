-- Esquema PostgreSQL para o NeonDB.
-- Execute no Neon: Console -> SQL Editor (ou: psql "$DATABASE_URL" -f neon-schema.sql)
-- Idempotente: não apaga nem altera dados existentes.
-- Sem RLS: o banco é acessado apenas pelo servidor (rotas /api), nunca pelo navegador.

create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  long_description text,
  tags text[] default '{}',
  image_url text,
  gallery_urls text[] not null default '{}',
  demo_url text,
  repo_url text,
  doc_url text,
  category text default 'web' check (category in ('web', 'mobile', 'iot', 'other')),
  featured boolean default false,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text default 'doc' check (type in ('cv', 'doc', 'cert')),
  file_url text not null,
  created_at timestamptz default now()
);
