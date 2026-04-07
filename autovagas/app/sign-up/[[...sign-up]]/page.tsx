'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      const friendly: Record<string, string> = {
        'email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        'User already registered': 'Este e-mail já está cadastrado. Tente fazer login.',
        'Password should be at least 6 characters.': 'A senha deve ter pelo menos 6 caracteres.',
        'Unable to validate email address: invalid format': 'Endereço de e-mail inválido.',
      }
      setError(friendly[error.message] ?? error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111]">
        <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 bg-[#b5ff4e] rounded-full flex items-center justify-center mx-auto">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#111" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Verifique seu e-mail</h1>
            <p className="text-[#888] text-sm mt-2 leading-relaxed">
              Enviamos um link de confirmação para{' '}
              <span className="font-medium text-white">{email}</span>.
              <br />
              Clique no link para ativar sua conta.
            </p>
          </div>
          <Link href="/sign-in" className="text-[#b5ff4e] hover:underline text-sm">
            Voltar para o login
          </Link>
        </div>
      </div>
    )
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
            <h1 className="text-white text-2xl font-bold">Criar conta</h1>
            <p className="text-[#666] text-sm mt-1">Automatize suas candidaturas no LinkedIn</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[#888] text-sm mb-1.5 block">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-[#141414] border border-[#2a2a2a] text-white placeholder:text-[#555] rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-[#b5ff4e] transition-colors"
              placeholder="Seu nome"
            />
          </div>

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
              minLength={6}
              className="bg-[#141414] border border-[#2a2a2a] text-white placeholder:text-[#555] rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-[#b5ff4e] transition-colors"
              placeholder="Mínimo 6 caracteres"
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
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-[#666]">
          Já tem uma conta?{' '}
          <Link href="/sign-in" className="text-[#b5ff4e] hover:underline font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
