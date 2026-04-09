import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123'
  return NextResponse.json({ ok: password === adminPass })
}
