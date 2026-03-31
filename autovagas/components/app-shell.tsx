'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// ─── Nav icons ────────────────────────────────────────────────────────────────
function IconGrid() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function IconCreditCard() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/dashboard', icon: <IconGrid />, label: 'Dashboard' },
  { href: '/vagas', icon: <IconBriefcase />, label: 'Vagas' },
  { href: '/perfil', icon: <IconUser />, label: 'Perfil' },
  { href: '/planos', icon: <IconCreditCard />, label: 'Planos' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  return (
    <div className="flex min-h-screen bg-[#111111]">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-16 flex flex-col items-center py-5 gap-2 bg-[#1a1a1a] border-r border-[#2a2a2a] shrink-0">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-[#b5ff4e] flex items-center justify-center mb-4">
          <span className="text-[#111] font-black text-sm">AV</span>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-[#b5ff4e] text-[#111]'
                    : 'text-[#666] hover:text-white hover:bg-[#252525]'
                }`}
              >
                {item.icon}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sair"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#555] hover:text-[#f87171] hover:bg-[#252525] transition-colors"
        >
          <IconLogout />
        </button>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
