// Script para popular o banco com dados de exemplo
// Execute com: node seed.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const projects = [
  {
    title: 'EJEC WhatsApp Chatbot',
    description: 'Chatbot para atendimento automatizado via WhatsApp com painel de atendentes em tempo real.',
    long_description: 'Sistema completo de atendimento via WhatsApp desenvolvido para a Empresa Júnior de Engenharia da Computação (EJEC). Utiliza Baileys para conexão com o WhatsApp, Flask como backend principal, Dialogflow para processamento de linguagem natural e MongoDB para persistência dos dados. O painel de atendentes é atualizado em tempo real via Socket.IO.',
    tags: ['Node.js', 'Python', 'Flask', 'MongoDB', 'Baileys', 'Socket.IO', 'Dialogflow'],
    category: 'web',
    featured: true,
    demo_url: '',
    repo_url: '',
    doc_url: '',
    image_url: '',
  },
  {
    title: 'Painel de Atendimento (EJEC)',
    description: 'Dashboard em tempo real para gerenciar conversas do chatbot, com fila de atendimento e transferência bot→humano.',
    long_description: 'Interface web para atendentes da EJEC gerenciarem as conversas do chatbot. Funcionalidades incluem: fila de atendimento, badge de mensagens não lidas, busca de contatos, filtros por status, modal de cadastro de atendentes e atualização em tempo real via Socket.IO. Frontend em HTML/CSS/JS puro integrado ao backend Flask.',
    tags: ['HTML', 'CSS', 'JavaScript', 'Socket.IO', 'Flask', 'MongoDB'],
    category: 'web',
    featured: true,
    demo_url: '',
    repo_url: '',
    doc_url: '',
    image_url: '',
  },
  {
    title: 'Controle de Motor IoT',
    description: 'Sistema de controle remoto de motor via ESP8266, Firebase e aplicativo Android criado no MIT App Inventor.',
    long_description: 'Projeto IoT para controle remoto de motor elétrico usando ESP8266 conectado ao Firebase Realtime Database. O aplicativo Android, desenvolvido no MIT App Inventor, envia comandos que o ESP8266 lê em tempo real e aciona o relé. O sistema registra histórico de acionamentos com timestamp usando NTP (UTC-3 Brasília).',
    tags: ['ESP8266', 'Firebase', 'Arduino', 'C++', 'MIT App Inventor', 'IoT', 'NTP'],
    category: 'iot',
    featured: true,
    demo_url: '',
    repo_url: '',
    doc_url: '',
    image_url: '',
  },
  {
    title: 'API REST Flask + MongoDB',
    description: 'Backend RESTful com autenticação, rotas protegidas e integração com MongoDB Atlas.',
    long_description: 'API REST desenvolvida em Python com Flask e MongoDB como banco de dados. Implementa autenticação com bcrypt, rotas protegidas, e serve como backend para múltiplos projetos da EJEC. Inclui script de inicialização do banco (init_db.py) para criação de índices e contas de administrador.',
    tags: ['Python', 'Flask', 'MongoDB', 'REST API', 'bcrypt'],
    category: 'web',
    featured: false,
    demo_url: '',
    repo_url: '',
    doc_url: '',
    image_url: '',
  },
  {
    title: 'App Android MIT App Inventor',
    description: 'Aplicativo mobile para controle de dispositivos IoT integrado ao Firebase Realtime Database.',
    long_description: 'Aplicativo Android desenvolvido no MIT App Inventor para comunicação com dispositivos ESP8266 via Firebase. Interface simples com botões de controle, histórico de acionamentos e status em tempo real do dispositivo.',
    tags: ['MIT App Inventor', 'Android', 'Firebase', 'IoT', 'Mobile'],
    category: 'mobile',
    featured: false,
    demo_url: '',
    repo_url: '',
    doc_url: '',
    image_url: '',
  },
]

const documents = [
  {
    title: 'Currículo — João (2025)',
    type: 'cv',
    file_url: '', // Adicione a URL do seu PDF após fazer upload manualmente
  },
  {
    title: 'Documentação — EJEC WhatsApp Bot',
    type: 'doc',
    file_url: '', // Adicione a URL do PDF após upload
  },
  {
    title: 'Documentação — Sistema IoT Motor ESP8266',
    type: 'doc',
    file_url: '', // Adicione a URL do PDF após upload
  },
]

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...\n')

  // Limpar dados existentes (opcional)
  console.log('🗑  Limpando dados anteriores...')
  await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Inserir projetos
  console.log('📦 Inserindo projetos...')
  const { data: insertedProjects, error: projError } = await supabase
    .from('projects')
    .insert(projects)
    .select()

  if (projError) {
    console.error('❌ Erro ao inserir projetos:', projError.message)
    return
  }
  console.log(`✅ ${insertedProjects.length} projetos inseridos`)

  // Inserir documentos (só os que têm file_url preenchida)
  const docsComUrl = documents.filter(d => d.file_url !== '')
  if (docsComUrl.length > 0) {
    console.log('📄 Inserindo documentos...')
    const { data: insertedDocs, error: docError } = await supabase
      .from('documents')
      .insert(docsComUrl)
      .select()

    if (docError) {
      console.error('❌ Erro ao inserir documentos:', docError.message)
    } else {
      console.log(`✅ ${insertedDocs.length} documentos inseridos`)
    }
  } else {
    console.log('⚠️  Documentos ignorados (file_url vazia) — faça upload pelo painel /admin')
  }

  console.log('\n🎉 Seed concluído! Acesse http://localhost:3000 para ver os projetos.')
  console.log('📝 Lembre de adicionar as imagens e PDFs pelo painel /admin\n')
}

seed()
