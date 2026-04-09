'use client'
import { useState } from 'react'
import { FaGithub, FaLinkedin, FaWhatsapp, FaInstagram } from 'react-icons/fa'

const socials = [
  {
    label: 'GitHub',
    href: 'https://github.com/joaopintoferreira',
    icon: FaGithub,
    color: 'hover:text-white hover:border-white/40',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/jo%C3%A3o-pinto-ferreira-267556294/',
    icon: FaLinkedin,
    color: 'hover:text-blue-400 hover:border-blue-400/40',
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/5548988086252',
    icon: FaWhatsapp,
    color: 'hover:text-green-400 hover:border-green-400/40',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/joaopinto.ferreira',
    icon: FaInstagram,
    color: 'hover:text-pink-400 hover:border-pink-400/40',
  },
]

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.')
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contato" className="py-24 px-6 max-w-6xl mx-auto">
      <div className="reveal mb-12">
        <p className="font-mono text-accent text-sm mb-2">{'// contato'}</p>
        <h2 className="text-4xl font-bold">Fale comigo</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 reveal">
        <div>
          <p className="text-muted leading-relaxed mb-8">
            Estou aberto a projetos freelance, colaborações e oportunidades.
            Se você tem uma ideia ou projeto, manda a mensagem.
          </p>

          <div className="space-y-3 mb-8">
            <a href="mailto:jocifer95@gmail.com"
              className="flex items-center gap-3 text-muted hover:text-accent transition-colors font-mono text-sm">
              <span className="text-accent">@</span> jocifer95@gmail.com
            </a>
            <a href="https://wa.me/5548988086252" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 text-muted hover:text-green-400 transition-colors font-mono text-sm">
              <FaWhatsapp className="text-green-400" size={14} />
              +55 (48) 98808-6252
            </a>
          </div>

          {/* Ícones das redes sociais */}
          <div className="flex gap-3">
            {socials.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                className={`flex items-center gap-2 border border-border px-3 py-2.5 rounded-lg text-muted transition-all ${s.color}`}
              >
                <s.icon size={18} />
                <span className="font-mono text-xs hidden sm:inline">{s.label}</span>
              </a>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {sent ? (
            <div className="flex items-center gap-3 p-4 border border-accent/40 bg-accent/10 rounded-xl">
              <span className="text-accent text-xl">✓</span>
              <p className="font-mono text-accent text-sm">Mensagem enviada! Responderei em breve.</p>
            </div>
          ) : (
            <>
              <input
                required
                placeholder="Seu nome"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full"
              />
              <input
                required
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full"
              />
              <textarea
                required
                placeholder="Sua mensagem..."
                rows={5}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                className="w-full resize-none"
              />
              {error && (
                <p className="font-mono text-xs text-red-400">✗ {error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full font-mono text-sm bg-accent text-black font-bold py-3 rounded hover:bg-accent/90 transition-all hover:shadow-[0_0_30px_rgba(0,255,159,0.3)] disabled:opacity-50">
                {loading ? 'enviando...' : 'enviar mensagem →'}
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  )
}