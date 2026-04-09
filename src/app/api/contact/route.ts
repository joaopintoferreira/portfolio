import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json()

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  const TO_EMAIL = process.env.CONTACT_EMAIL

  if (!RESEND_KEY || !TO_EMAIL) {
    console.log('Mensagem recebida (sem Resend configurado):')
    console.log(`De: ${name} <${email}>`)
    console.log(`Mensagem: ${message}`)
    return NextResponse.json({ ok: true })
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Portfolio <onboarding@resend.dev>',
        to: [TO_EMAIL],
        subject: `[Portfolio] Mensagem de ${name}`,
        html: `
          <div style="font-family:monospace;max-width:500px;margin:0 auto;padding:24px;background:#0a0a0f;color:#fff;border:1px solid #2a2a3f;border-radius:8px">
            <h2 style="color:#00ff9f;margin-top:0">Nova mensagem do portfólio</h2>
            <p><strong style="color:#888">Nome:</strong> ${name}</p>
            <p><strong style="color:#888">Email:</strong> <a href="mailto:${email}" style="color:#00ff9f">${email}</a></p>
            <p><strong style="color:#888">Mensagem:</strong></p>
            <p style="background:#12121a;padding:12px;border-radius:6px;border-left:3px solid #00ff9f">${message}</p>
          </div>
        `,
      }),
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro ao enviar email:', err.message)
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
  }
}