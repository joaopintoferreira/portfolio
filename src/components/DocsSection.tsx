import { type Document } from '@/lib/types'

const typeLabel: Record<string, { label: string; icon: string; color: string }> = {
  cv: { label: 'Currículo', icon: '◉', color: 'text-accent' },
  doc: { label: 'Documentação', icon: '◈', color: 'text-blue-400' },
  cert: { label: 'Certificado', icon: '◇', color: 'text-amber-400' },
}

export default function DocsSection({ docs }: { docs: Document[] }) {
  return (
    <section id="docs" className="py-24 px-6 max-w-6xl mx-auto">
      <div className="reveal mb-12">
        <p className="font-mono text-accent text-sm mb-2">{'// documentos'}</p>
        <h2 className="text-4xl font-bold">CV & Docs</h2>
      </div>

      {docs.length === 0 ? (
        <div className="reveal text-center py-16 border border-dashed border-border rounded-xl">
          <p className="font-mono text-muted text-sm">
            Nenhum documento cadastrado ainda.
          </p>
          <a href="/admin" className="text-accent hover:underline text-sm font-mono mt-2 block">
            → Adicionar documentos no painel admin
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 reveal">
          {docs.map(doc => {
            const meta = typeLabel[doc.type] || typeLabel.doc
            return (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(0,255,159,0.05)] transition-all group"
              >
                <span className={`text-2xl font-mono ${meta.color}`}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{doc.title}</p>
                  <p className="font-mono text-xs text-muted">{meta.label}</p>
                </div>
                <span className="font-mono text-xs text-muted group-hover:text-accent transition-colors">↓ PDF</span>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
