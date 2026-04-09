'use client'
import { useState } from 'react'
import Image from 'next/image'
import { type Project } from '@/lib/supabase'

const categoryColor: Record<string, string> = {
  web:    'text-blue-400 border-blue-400/30 bg-blue-400/10',
  mobile: 'text-violet-400 border-violet-400/30 bg-violet-400/10',
  iot:    'text-amber-400 border-amber-400/30 bg-amber-400/10',
  other:  'text-muted border-border bg-surface',
}

export default function ProjectCard({ project }: { project: Project }) {
  const images = [
    ...(project.image_url ? [project.image_url] : []),
    ...(project.gallery_urls || []),
  ]
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  function prev(e: React.MouseEvent) {
    e.stopPropagation()
    setCurrent(i => (i - 1 + images.length) % images.length)
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation()
    setCurrent(i => (i + 1) % images.length)
  }

  return (
    <>
      <div className="project-card bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">

        {/* Imagem / Carrossel */}
        {images.length > 0 ? (
          <div className="relative h-48 overflow-hidden group cursor-pointer" onClick={() => setLightbox(true)}>
            <Image
              src={images[current]}
              alt={`${project.title} - imagem ${current + 1}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />

            {/* Badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              {project.featured && (
                <span className="font-mono text-xs text-accent border border-accent/40 bg-accent/10 px-2 py-0.5 rounded">
                  destaque
                </span>
              )}
              {images.length > 1 && (
                <span className="font-mono text-xs text-white bg-black/50 px-2 py-0.5 rounded ml-auto">
                  {current + 1}/{images.length}
                </span>
              )}
            </div>

            {/* Setas do carrossel */}
            {images.length > 1 && (
              <>
                <button onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
                  ‹
                </button>
                <button onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
                  ›
                </button>

                {/* Dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i}
                      onClick={e => { e.stopPropagation(); setCurrent(i) }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-accent w-3' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Ícone de expandir */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="font-mono text-xs text-white bg-black/50 px-2 py-1 rounded">⤢ expandir</span>
            </div>
          </div>
        ) : (
          <div className="h-48 bg-surface border-b border-border flex items-center justify-center">
            <span className="font-mono text-4xl text-muted/20">{'{ }'}</span>
            {project.featured && (
              <span className="absolute top-3 right-3 font-mono text-xs text-accent border border-accent/40 bg-accent/10 px-2 py-0.5 rounded">
                destaque
              </span>
            )}
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-white text-lg leading-tight">{project.title}</h3>
            <span className={`font-mono text-xs border px-2 py-0.5 rounded shrink-0 ${categoryColor[project.category] || categoryColor.other}`}>
              {project.category}
            </span>
          </div>

          <p className="text-muted text-sm leading-relaxed mb-4 flex-1">{project.description}</p>

          {project.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {project.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}

          <div className="flex gap-3 mt-auto pt-3 border-t border-border">
            {project.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors">demo →</a>
            )}
            {project.repo_url && (
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-muted hover:text-white transition-colors">github →</a>
            )}
            {project.doc_url && (
              <a href={project.doc_url} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-muted hover:text-white transition-colors">docs →</a>
            )}
            {images.length > 1 && (
              <button onClick={() => setLightbox(true)}
                className="font-mono text-xs text-muted hover:text-accent transition-colors ml-auto">
                {images.length} fotos →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(false)}
              className="absolute -top-10 right-0 font-mono text-sm text-white hover:text-accent transition-colors">
              ✕ fechar
            </button>

            <div className="relative aspect-video rounded-xl overflow-hidden">
              <Image
                src={images[current]}
                alt={`${project.title} - imagem ${current + 1}`}
                fill
                className="object-contain"
              />
            </div>

            {images.length > 1 && (
              <>
                <button onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center text-xl font-bold">
                  ‹
                </button>
                <button onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center text-xl font-bold">
                  ›
                </button>

                {/* Thumbnails */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1 justify-center">
                  {images.map((url, i) => (
                    <button key={i} onClick={() => setCurrent(i)}
                      className={`shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${i === current ? 'border-accent' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                <p className="text-center font-mono text-xs text-muted mt-2">
                  {current + 1} / {images.length}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}