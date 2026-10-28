/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a todas as rotas.
// A Content-Security-Policy NÃO está ativada: veja docs/csp-proposta.md.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Somente a store do Vercel Blob deste projeto (hostname exato; não use curinga *.public.blob...,
        // que aceitaria arquivos de qualquer store). Se a store mudar, atualize este hostname.
        protocol: 'https',
        hostname: 'jahf06bstgbiz0bd.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

module.exports = nextConfig
