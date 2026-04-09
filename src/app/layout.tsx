import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'João Pinto Ferreira | Developer',
  description: 'Full-stack & Embedded Developer — EJEC',
  openGraph: {
    title: 'João Pinto Ferreira | Developer',
    description: 'Full-stack & Embedded Developer — Web, Mobile, IoT',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg text-white antialiased">{children}</body>
    </html>
  )
}
