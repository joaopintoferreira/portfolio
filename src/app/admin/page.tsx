'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase, type Project, type Document } from '@/lib/supabase'

type Tab = 'projects' | 'docs'
type ProjectForm = Omit<Project, 'id' | 'created_at'>

const emptyForm: ProjectForm = {
  title: '',
  description: '',
  long_description: '',
  tags: [],
  image_url: '',
  gallery_urls: [],
  demo_url: '',
  repo_url: '',
  doc_url: '',
  category: 'web',
  featured: false,
}

export default function AdminPage() {
  const [auth, setAuth] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [tab, setTab] = useState<Tab>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectForm>(emptyForm)
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [docForm, setDocForm] = useState({ title: '', type: 'cv' as 'cv' | 'doc' | 'cert' })
  const [docSaving, setDocSaving] = useState(false)

  const imageRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const projDocRef = useRef<HTMLInputElement>(null)

  const [uploadingGallery, setUploadingGallery] = useState(false)

  useEffect(() => {
    const ok = sessionStorage.getItem('admin_ok')
    if (ok === '1') setAuth(true)
  }, [])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()).then(d => {
      if (d.ok) { sessionStorage.setItem('admin_ok', '1'); setAuth(true) }
      else setAuthError('Senha incorreta.')
    })
  }

  useEffect(() => { if (auth) fetchAll() }, [auth])

  async function fetchAll() {
    setLoading(true)
    const [{ data: p }, { data: d }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
    ])
    setProjects(p || [])
    setDocs(d || [])
    setLoading(false)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3500)
  }

  async function uploadImage(file: File, folder = 'projects'): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true })
    if (error) throw error
    return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
  }

  async function uploadDoc(file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `docs/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('docs').upload(path, file, { upsert: true })
    if (error) throw error
    return supabase.storage.from('docs').getPublicUrl(path).data.publicUrl
  }

  // Upload galeria imediatamente ao selecionar
  async function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingGallery(true)
    try {
      const urls = await Promise.all(files.map(f => uploadImage(f, 'gallery')))
      setForm(f => ({ ...f, gallery_urls: [...(f.gallery_urls || []), ...urls] }))
      flash(`✓ ${files.length} imagem(ns) adicionada(s)`)
    } catch (err: any) {
      flash('✗ Erro no upload: ' + err.message)
    } finally {
      setUploadingGallery(false)
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  // Remove imagem da galeria e salva imediatamente se estiver editando
  async function removeGalleryImage(url: string) {
    const newUrls = (form.gallery_urls || []).filter(u => u !== url)
    setForm(f => ({ ...f, gallery_urls: newUrls }))
    if (editingId) {
      await supabase.from('projects').update({ gallery_urls: newUrls }).eq('id', editingId)
      flash('✓ Imagem removida da galeria')
    }
  }

  // Remove imagem de capa e salva imediatamente se estiver editando
  async function removeCoverImage() {
    setForm(f => ({ ...f, image_url: '' }))
    if (imageRef.current) imageRef.current.value = ''
    if (editingId) {
      await supabase.from('projects').update({ image_url: '' }).eq('id', editingId)
      flash('✓ Imagem de capa removida')
    }
  }

  // Remove doc do projeto e salva imediatamente se estiver editando
  async function removeProjDoc() {
    setForm(f => ({ ...f, doc_url: '' }))
    if (projDocRef.current) projDocRef.current.value = ''
    if (editingId) {
      await supabase.from('projects').update({ doc_url: '' }).eq('id', editingId)
      flash('✓ Documento removido do projeto')
    }
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      }
      if (imageRef.current?.files?.[0]) {
        payload.image_url = await uploadImage(imageRef.current.files[0])
      }
      if (projDocRef.current?.files?.[0]) {
        payload.doc_url = await uploadDoc(projDocRef.current.files[0])
      }
      if (editingId) {
        await supabase.from('projects').update(payload).eq('id', editingId)
        flash('✓ Projeto atualizado!')
      } else {
        await supabase.from('projects').insert(payload)
        flash('✓ Projeto adicionado!')
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      setTagsInput('')
      fetchAll()
    } catch (err: any) {
      flash('✗ Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(p: Project) {
    setForm({
      title: p.title,
      description: p.description,
      long_description: p.long_description || '',
      tags: p.tags || [],
      image_url: p.image_url || '',
      gallery_urls: p.gallery_urls || [],
      demo_url: p.demo_url || '',
      repo_url: p.repo_url || '',
      doc_url: p.doc_url || '',
      category: p.category,
      featured: p.featured,
    })
    setTagsInput((p.tags || []).join(', '))
    setEditingId(p.id)
    setShowForm(true)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
  }

  async function deleteProject(id: string) {
    if (!confirm('Excluir este projeto? Esta ação não pode ser desfeita.')) return
    await supabase.from('projects').delete().eq('id', id)
    flash('Projeto excluído.')
    fetchAll()
  }

  async function handleSaveDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docFileRef.current?.files?.[0]) return flash('✗ Selecione um arquivo PDF')
    setDocSaving(true)
    try {
      const url = await uploadDoc(docFileRef.current.files[0])
      await supabase.from('documents').insert({ ...docForm, file_url: url })
      flash('✓ Documento adicionado!')
      setDocForm({ title: '', type: 'cv' })
      if (docFileRef.current) docFileRef.current.value = ''
      fetchAll()
    } catch (err: any) {
      flash('✗ Erro: ' + err.message)
    } finally {
      setDocSaving(false)
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm('Excluir este documento? Esta ação não pode ser desfeita.')) return
    await supabase.from('documents').delete().eq('id', id)
    flash('✓ Documento excluído.')
    fetchAll()
  }

  // ── LOGIN ──
  if (!auth) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <p className="font-mono text-accent text-center text-sm mb-6">{'// admin access'}</p>
          <form onSubmit={handleLogin} className="bg-card border border-border rounded-xl p-8 space-y-4">
            <h1 className="font-bold text-xl text-center">Painel Admin</h1>
            <input type="password" placeholder="Senha" value={password}
              onChange={e => setPassword(e.target.value)} className="w-full" autoFocus />
            {authError && <p className="font-mono text-xs text-red-400">{authError}</p>}
            <button type="submit" className="w-full font-mono text-sm bg-accent text-black font-bold py-3 rounded hover:bg-accent/90 transition-all">
              entrar →
            </button>
          </form>
          <p className="text-center mt-4">
            <a href="/" className="font-mono text-xs text-muted hover:text-accent transition-colors">← voltar ao site</a>
          </p>
        </div>
      </div>
    )
  }

  // ── DASHBOARD ──
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <a href="/" className="font-mono text-accent text-sm">{'<joão />'}</a>
          <span className="text-border">|</span>
          <span className="font-mono text-xs text-muted">admin panel</span>
        </div>
        <button onClick={() => { sessionStorage.removeItem('admin_ok'); setAuth(false) }}
          className="font-mono text-xs text-muted hover:text-red-400 transition-colors">
          sair →
        </button>
      </header>

      {msg && (
        <div className={`fixed top-20 right-6 z-50 font-mono text-sm px-4 py-3 rounded-lg border transition-all shadow-lg ${
          msg.startsWith('✓') ? 'bg-accent/10 border-accent/40 text-accent' : 'bg-red-500/10 border-red-500/40 text-red-400'
        }`}>
          {msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-2 mb-8 border-b border-border">
          {(['projects', 'docs'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setShowForm(false) }}
              className={`font-mono text-sm px-4 py-2 border-b-2 transition-all -mb-px ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-white'
              }`}>
              {t === 'projects' ? 'Projetos' : 'Docs / CV'}
            </button>
          ))}
        </div>

        {/* ── PROJECTS ── */}
        {tab === 'projects' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="font-mono text-xs text-muted">{projects.length} projeto(s)</p>
              <button
                onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setTagsInput('') }}
                className="font-mono text-sm bg-accent text-black font-bold px-4 py-2 rounded hover:bg-accent/90 transition-all">
                {showForm ? '✕ cancelar' : '+ novo projeto'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSaveProject} className="bg-card border border-border rounded-xl p-6 mb-8 space-y-5">
                <h2 className="font-bold text-lg">{editingId ? 'Editar Projeto' : 'Novo Projeto'}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted">Título *</label>
                    <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Nome do projeto" className="w-full" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted">Categoria *</label>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value as any})} className="w-full">
                      <option value="web">Web</option>
                      <option value="mobile">Mobile</option>
                      <option value="iot">IoT</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted">Descrição curta *</label>
                  <input required value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Uma frase descrevendo o projeto" className="w-full" />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted">Descrição longa</label>
                  <textarea rows={4} value={form.long_description} onChange={e => setForm({...form, long_description: e.target.value})} placeholder="Detalhes completos do projeto..." className="w-full resize-none" />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted">Tags (separadas por vírgula)</label>
                  <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="React, Firebase, ESP8266" className="w-full" />
                </div>

                {/* ── IMAGEM DE CAPA ── */}
                <div className="space-y-2">
                  <label className="font-mono text-xs text-muted">Imagem de capa</label>
                  {form.image_url ? (
                    <div className="flex items-start gap-3">
                      <img src={form.image_url} alt="capa" className="h-24 w-36 object-cover rounded-lg border border-border" />
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={removeCoverImage}
                          className="font-mono text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded transition-all">
                          ✕ remover capa
                        </button>
                        <span className="font-mono text-xs text-muted">ou selecione outra para substituir:</span>
                        <input type="file" accept="image/*" ref={imageRef}
                          className="font-mono text-xs text-muted file:mr-3 file:font-mono file:text-xs file:bg-accent/10 file:text-accent file:border file:border-accent/30 file:rounded file:px-3 file:py-1 file:cursor-pointer" />
                      </div>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" ref={imageRef}
                      className="w-full font-mono text-xs text-muted file:mr-4 file:font-mono file:text-xs file:bg-accent/10 file:text-accent file:border file:border-accent/30 file:rounded file:px-3 file:py-1.5 file:cursor-pointer" />
                  )}
                </div>

                {/* ── GALERIA ── */}
                <div className="space-y-2">
                  <label className="font-mono text-xs text-muted">
                    Galeria de imagens
                    <span className="ml-2 text-muted/50">(múltiplas screenshots)</span>
                  </label>

                  {(form.gallery_urls || []).length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {(form.gallery_urls || []).map((url, i) => (
                        <div key={url} className="relative group aspect-video">
                          <img src={url} alt={`galeria ${i+1}`} className="w-full h-full object-cover rounded-lg border border-border" />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(url)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold"
                          >
                            ✕
                          </button>
                          <span className="absolute bottom-1 left-1 font-mono text-xs bg-black/60 text-white px-1 rounded">{i+1}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" multiple ref={galleryRef} onChange={handleGallerySelect}
                      className="flex-1 font-mono text-xs text-muted file:mr-4 file:font-mono file:text-xs file:bg-accent/10 file:text-accent file:border file:border-accent/30 file:rounded file:px-3 file:py-1.5 file:cursor-pointer" />
                    {uploadingGallery && <span className="font-mono text-xs text-accent animate-pulse shrink-0">enviando...</span>}
                  </div>
                  {(form.gallery_urls || []).length > 0 && (
                    <p className="font-mono text-xs text-muted">{(form.gallery_urls || []).length} imagem(ns) · passe o mouse para remover</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted">URL do Demo</label>
                    <input type="url" value={form.demo_url} onChange={e => setForm({...form, demo_url: e.target.value})} placeholder="https://..." className="w-full" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted">URL do GitHub</label>
                    <input type="url" value={form.repo_url} onChange={e => setForm({...form, repo_url: e.target.value})} placeholder="https://github.com/..." className="w-full" />
                  </div>
                </div>

                {/* ── DOC DO PROJETO ── */}
                <div className="space-y-2">
                  <label className="font-mono text-xs text-muted">Documentação PDF do projeto</label>
                  {form.doc_url ? (
                    <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
                      <span className="font-mono text-xs text-accent flex-1 truncate">
                        📄 {form.doc_url.split('/').pop()}
                      </span>
                      <a href={form.doc_url} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-muted hover:text-accent transition-colors shrink-0">
                        ver →
                      </a>
                      <button type="button" onClick={removeProjDoc}
                        className="font-mono text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-1 rounded transition-all shrink-0">
                        ✕ remover
                      </button>
                    </div>
                  ) : (
                    <input type="file" accept=".pdf" ref={projDocRef}
                      className="w-full font-mono text-xs text-muted file:mr-4 file:font-mono file:text-xs file:bg-accent/10 file:text-accent file:border file:border-accent/30 file:rounded file:px-3 file:py-1.5 file:cursor-pointer" />
                  )}
                  {form.doc_url && (
                    <div>
                      <p className="font-mono text-xs text-muted mb-1">Para substituir, selecione outro arquivo:</p>
                      <input type="file" accept=".pdf" ref={projDocRef}
                        className="w-full font-mono text-xs text-muted file:mr-4 file:font-mono file:text-xs file:bg-accent/10 file:text-accent file:border file:border-accent/30 file:rounded file:px-3 file:py-1.5 file:cursor-pointer" />
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm({...form, featured: e.target.checked})} className="accent-[#00ff9f] w-4 h-4" />
                  <span className="font-mono text-xs text-muted">Marcar como projeto destaque</span>
                </label>

                <button type="submit" disabled={saving}
                  className="w-full font-mono text-sm bg-accent text-black font-bold py-3 rounded hover:bg-accent/90 transition-all disabled:opacity-50">
                  {saving ? 'salvando...' : editingId ? 'salvar alterações →' : 'adicionar projeto →'}
                </button>
              </form>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />)}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <p className="font-mono text-muted text-sm">Nenhum projeto cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(p => (
                  <div key={p.id} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-border/60 transition-all">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                      : <div className="w-14 h-14 bg-surface rounded-lg border border-border shrink-0 flex items-center justify-center font-mono text-muted/30 text-lg">{'{ }'}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-white truncate">{p.title}</p>
                        {p.featured && <span className="font-mono text-xs text-accent border border-accent/30 px-1.5 py-0.5 rounded shrink-0">destaque</span>}
                        <span className="font-mono text-xs text-muted border border-border px-1.5 py-0.5 rounded shrink-0">{p.category}</span>
                        {(p.gallery_urls?.length ?? 0) > 0 && (
                          <span className="font-mono text-xs text-muted border border-border px-1.5 py-0.5 rounded shrink-0">
                            {p.gallery_urls!.length} foto(s)
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-xs truncate">{p.description}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(p)}
                        className="font-mono text-xs border border-border px-3 py-1.5 rounded hover:border-accent hover:text-accent text-muted transition-all">
                        editar
                      </button>
                      <button onClick={() => deleteProject(p.id)}
                        className="font-mono text-xs border border-red-500/30 px-3 py-1.5 rounded hover:border-red-500 hover:text-red-400 text-muted transition-all">
                        excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DOCS ── */}
        {tab === 'docs' && (
          <>
            <form onSubmit={handleSaveDoc} className="bg-card border border-border rounded-xl p-6 mb-8 space-y-4">
              <h2 className="font-bold text-lg">Adicionar Documento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted">Título *</label>
                  <input required value={docForm.title} onChange={e => setDocForm({...docForm, title: e.target.value})} placeholder="Ex: Currículo 2025" className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted">Tipo *</label>
                  <select value={docForm.type} onChange={e => setDocForm({...docForm, type: e.target.value as any})} className="w-full">
                    <option value="cv">Currículo (CV)</option>
                    <option value="doc">Documentação de Projeto</option>
                    <option value="cert">Certificado</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-xs text-muted">Arquivo PDF *</label>
                <input type="file" accept=".pdf" ref={docFileRef} required
                  className="w-full font-mono text-xs text-muted file:mr-4 file:font-mono file:text-xs file:bg-accent/10 file:text-accent file:border file:border-accent/30 file:rounded file:px-3 file:py-1.5 file:cursor-pointer" />
              </div>
              <button type="submit" disabled={docSaving}
                className="font-mono text-sm bg-accent text-black font-bold px-6 py-2.5 rounded hover:bg-accent/90 transition-all disabled:opacity-50">
                {docSaving ? 'enviando...' : '↑ fazer upload →'}
              </button>
            </form>

            {loading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-border" />)}</div>
            ) : docs.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <p className="font-mono text-muted text-sm">Nenhum documento cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-border/60 transition-all">
                    <div className="w-10 h-10 bg-surface border border-border rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-accent font-mono text-sm">
                        {doc.type === 'cv' ? '◉' : doc.type === 'cert' ? '◇' : '◈'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{doc.title}</p>
                      <p className="font-mono text-xs text-muted">
                        {doc.type === 'cv' ? 'Currículo' : doc.type === 'cert' ? 'Certificado' : 'Documentação'}
                        {' · '}{new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs border border-border px-3 py-1.5 rounded hover:border-accent hover:text-accent text-muted transition-all">
                        ver PDF →
                      </a>
                      <button onClick={() => deleteDoc(doc.id)}
                        className="font-mono text-xs border border-red-500/30 px-3 py-1.5 rounded hover:border-red-500 hover:text-red-400 text-muted transition-all">
                        ✕ excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}