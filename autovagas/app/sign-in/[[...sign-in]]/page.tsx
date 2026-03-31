'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111111]">
      <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#b5ff4e] flex items-center justify-center">
            <span className="text-[#111] font-black text-sm">AV</span>
          </div>
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold">Entrar</h1>
            <p className="text-[#666] text-sm mt-1">Acesse sua conta para continuar</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[#888] text-sm mb-1.5 block">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#141414] border border-[#2a2a2a] text-white placeholder:text-[#555] rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-[#b5ff4e] transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="text-[#888] text-sm mb-1.5 block">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-[#141414] border border-[#2a2a2a] text-white placeholder:text-[#555] rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-[#b5ff4e] transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-[#3a1a1a] border border-[#f87171] text-[#f87171] rounded-xl px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#b5ff4e] text-[#111] font-bold rounded-xl py-3 hover:bg-[#c8ff6e] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-[#666]">
          Não tem uma conta?{' '}
          <Link href="/sign-up" className="text-[#b5ff4e] hover:underline font-medium">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
