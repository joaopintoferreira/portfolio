'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const links = [
  { href: '#sobre', label: 'sobre' },
  { href: '#skills', label: 'skills' },
  { href: '#projetos', label: 'projetos' },
  { href: '#docs', label: 'docs' },
  { href: '#contato', label: 'contato' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-bg/90 backdrop-blur border-b border-border' : ''
    }`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="font-mono text-accent font-bold text-sm tracking-wider">
          {'<joão />'}
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href}
              className="font-mono text-xs text-muted hover:text-accent transition-colors">
              {l.label}
            </a>
          ))}
          <a href="/admin"
            className="font-mono text-xs border border-border px-3 py-1.5 rounded hover:border-accent hover:text-accent text-muted transition-all">
            admin
          </a>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-muted hover:text-white" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {open
              ? <path d="M4 4l12 12M4 16L16 4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              : <path fillRule="evenodd" d="M3 5h14v1.5H3V5zm0 4.25h14v1.5H3v-1.5zM3 13.5h14V15H3v-1.5z"/>
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-surface border-b border-border px-6 py-4 flex flex-col gap-4">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="font-mono text-sm text-muted hover:text-accent transition-colors">
              {l.label}
            </a>
          ))}
          <a href="/admin" className="font-mono text-sm text-accent">admin →</a>
        </div>
      )}
    </nav>
  )
}
