import { FaGithub, FaLinkedin, FaWhatsapp, FaInstagram } from 'react-icons/fa'

const socials = [
  { label: 'GitHub',    href: 'https://github.com/joaopintoferreira',                          icon: FaGithub },
  { label: 'LinkedIn',  href: 'https://www.linkedin.com/in/jo%C3%A3o-pinto-ferreira-267556294/', icon: FaLinkedin },
  { label: 'WhatsApp',  href: 'https://wa.me/5548988086252',                                    icon: FaWhatsapp },
  { label: 'Instagram', href: 'https://www.instagram.com/joaopinto.ferreira',                   icon: FaInstagram },
]

export default function Footer() {
  return (
    <footer className="border-t border-border py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-mono text-xs text-muted">
          {'<joão />'} — {new Date().getFullYear()}
        </span>

        <div className="flex items-center gap-4">
          {socials.map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              title={s.label}
              className="text-muted hover:text-accent transition-colors"
            >
              <s.icon size={16} />
            </a>
          ))}
        </div>

        <span className="font-mono text-xs text-muted">
          built with Next.js + Supabase + Vercel
        </span>
      </div>
    </footer>
  )
}