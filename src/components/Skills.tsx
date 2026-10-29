const skillGroups = [
  {
    label: 'web & backend',
    icon: '⬡',
    color: 'from-accent/20 to-transparent',
    skills: ['React', 'Next.js', 'Node.js', 'Python', 'Flask', 'MongoDB', 'PostgreSQL', 'Firebase'],
  },
  {
    label: 'tools & infra',
    icon: '◇',
    color: 'from-blue-500/20 to-transparent',
    skills: ['Git', 'Docker', 'Vercel', 'REST APIs'],
  },
]

export default function Skills() {
  return (
    <section id="skills" className="py-24 px-6 max-w-6xl mx-auto">
      <div className="reveal mb-12">
        <p className="font-mono text-accent text-sm mb-2">{'// stack'}</p>
        <h2 className="text-4xl font-bold">Tecnologias</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {skillGroups.map((group, i) => (
          <div
            key={group.label}
            className="reveal bg-card border border-border rounded-xl p-6 hover:border-accent/30 transition-all"
            style={{ transitionDelay: `${i * 0.15}s` }}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="text-accent text-xl font-mono">{group.icon}</span>
              <span className="font-mono text-xs text-muted uppercase tracking-widest">{group.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.skills.map(skill => (
                <span key={skill} className="tag">{skill}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
