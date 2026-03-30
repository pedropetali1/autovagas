import { NextResponse } from 'next/server'

// Clerk webhook removed — authentication is now handled by Supabase Auth
export function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
