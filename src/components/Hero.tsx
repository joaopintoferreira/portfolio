'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'

const roles = ['Full-Stack Developer', 'Embedded Systems Dev']

export default function Hero() {
  const [roleIdx, setRoleIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = roles[roleIdx]
    let timeout: ReturnType<typeof setTimeout>
    if (!deleting && displayed.length < current.length) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 80)
    } else if (!deleting && displayed.length === current.length) {
      timeout = setTimeout(() => setDeleting(true), 2000)
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 40)
    } else if (deleting && displayed.length === 0) {
      setDeleting(false)
      setRoleIdx((roleIdx + 1) % roles.length)
    }
    return () => clearTimeout(timeout)
  }, [displayed, deleting, roleIdx])

  return (
    <section id="sobre" className="relative min-h-screen flex items-center grid-bg overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-accent rounded-full opacity-5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent2 rounded-full opacity-5 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 pt-20 pb-12 w-full">
        <div className="flex flex-col lg:flex-row items-center lg:items-center gap-8 lg:gap-16">

          {/* Foto — aparece ANTES do texto no mobile, ao lado no desktop */}
          <div className="animate-fade-up order-first lg:order-last shrink-0" style={{ animationDelay: '0.4s' }}>
            {/* Tamanhos responsivos: 160px mobile, 200px md, 220px lg */}
            <div className="relative w-40 h-40 md:w-48 md:h-48 lg:w-52 lg:h-52">
              <div className="absolute inset-0 rounded-full border border-accent/20 animate-spin" style={{ animationDuration: '12s' }} />
              <div className="absolute inset-1 rounded-full border border-dashed border-accent/10 animate-spin" style={{ animationDuration: '20s', animationDirection: 'reverse' }} />
              <div className="absolute inset-3 rounded-full overflow-hidden border-2 border-accent/30 bg-card animate-glow-pulse">
                <Image
                  src="/profile.jpg"
                  alt="João"
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-xs bg-bg border border-accent/40 text-accent px-3 py-1 rounded-full whitespace-nowrap">
                JOÃO · Dev
              </div>
            </div>
          </div>

          {/* Texto */}
          <div className="flex-1 max-w-2xl text-center lg:text-left">
            <p className="font-mono text-accent text-sm mb-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              {'// hello world'}
            </p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              Olá, eu sou<br />
             <span className="text-accent/70 glow-text">João P.Ferreira</span>
            </h1>
            <div className="text-xl md:text-2xl font-mono text-muted mb-6 h-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <span className="text-white">{displayed}</span>
              <span className="text-accent animate-pulse">_</span>
            </div>
            <p className="text-muted text-base md:text-lg leading-relaxed max-w-xl mb-8 mx-auto lg:mx-0 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              Desenvolvedor full-stack com sólida atuação em sistemas web, bancos de dados (relacionais e NoSQL) e soluções embarcadas. Possuo experiência no desenvolvimento de aplicações utilizando Python, JavaScript, PostgreSQL e MongoDB, com foco na integração perfeita entre software e hardware para entregar soluções tecnológicas completas.
            </p>
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start animate-fade-up" style={{ animationDelay: '0.5s' }}>
              <a href="#projetos"
                className="px-6 py-3 bg-accent text-black font-bold font-mono text-sm rounded hover:bg-accent/90 transition-all hover:shadow-[0_0_30px_rgba(0,255,159,0.3)]">
                ver projetos →
              </a>
              <a href="#contato"
                className="px-6 py-3 border border-border text-muted font-mono text-sm rounded hover:border-accent hover:text-accent transition-all">
                entrar em contato
              </a>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 font-mono text-xs text-muted border border-border rounded-full px-4 py-2 animate-fade-up" style={{ animationDelay: '0.6s' }}>
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              disponível para projetos
            </div>
          </div>

        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted/40 animate-bounce">
        <span className="font-mono text-xs">scroll</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 12L2 6h12L8 12z"/>
        </svg>
      </div>
    </section>
  )
}