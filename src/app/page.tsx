'use client'
import { useEffect, useState, useRef } from 'react'
import { type Project, type Document } from '@/lib/types'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Skills from '@/components/Skills'
import ProjectCard from '@/components/ProjectCard'
import DocsSection from '@/components/DocsSection'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    // A ordenação (destaques primeiro, mais recentes primeiro) é feita pela API.
    async function load<T>(url: string): Promise<T[] | null> {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        return Array.isArray(data) ? data : null
      } catch {
        return null
      }
    }
    async function fetchData() {
      const [projectsData, docsData] = await Promise.all([
        load<Project>('/api/projects'),
        load<Document>('/api/documents'),
      ])
      setProjects(projectsData || [])
      setDocs(docsData || [])
      setLoadError(projectsData === null)
      setLoading(false)
    }
    fetchData()
  }, [])

  // Reveal on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [projects])

  const categories = ['all', 'web', 'mobile', 'iot', 'other']
  const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter)

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Skills />

      {/* Projects */}
      <section id="projetos" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="reveal mb-12">
          <p className="font-mono text-accent text-sm mb-2">{'// projetos'}</p>
          <h2 className="text-4xl font-bold">O que construí</h2>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-10 reveal">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`font-mono text-xs px-4 py-2 rounded border transition-all ${
                filter === cat
                  ? 'bg-accent text-black border-accent font-bold'
                  : 'text-muted border-border hover:border-accent hover:text-accent'
              }`}
            >
              {cat === 'all' ? 'todos' : cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-72 bg-card rounded-xl animate-pulse border border-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted font-mono">
            <p className="text-5xl mb-4">{'{ }'}</p>
            <p>{loadError ? 'Não foi possível carregar os projetos.' : 'Nenhum projeto cadastrado ainda.'}</p>
            <a href="/admin" className="text-accent hover:underline text-sm mt-2 block">
              → Adicionar projetos no painel admin
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((project, i) => (
              <div key={project.id} className="reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        )}
      </section>

      <DocsSection docs={docs} />
      <Contact />
      <Footer />
    </main>
  )
}
