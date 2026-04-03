'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { trpc } from '@/lib/trpc'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function profileIsIncomplete(profile: { desiredRole?: string | null; cvUrl?: string | null; skills: { id: string }[] } | undefined) {
  if (!profile) return false
  return !profile.desiredRole || !profile.cvUrl || profile.skills.length < 3
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING:  { label: 'Pendente',    color: 'bg-[#3a3a3a] text-[#aaa]',         dot: '#555' },
  APPLYING: { label: 'Aplicando',   color: 'bg-[#1e3a5f] text-[#60a5fa]',      dot: '#60a5fa' },
  SENT:     { label: 'Enviada',     color: 'bg-[#14301a] text-[#4ade80]',      dot: '#4ade80' },
  FAILED:   { label: 'Falhou',      color: 'bg-[#3a1a1a] text-[#f87171]',      dot: '#f87171' },
  VIEWED:   { label: 'Visualizada', color: 'bg-[#2d1a3d] text-[#a78bfa]',      dot: '#a78bfa' },
}

// ─── Mini sparkline (SVG) ─────────────────────────────────────────────────────
function Sparkline({ color = '#b5ff4e' }: { color?: string }) {
  const points = [8, 15, 10, 20, 12, 8, 18, 6, 14, 10, 16, 4]
  const max = Math.max(...points), min = Math.min(...points)
  const h = 40, w = 120
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - ((p - min) / (max - min || 1)) * h
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Dot chart (like the "PRODUCT" card in the design) ───────────────────────
function DotChart({ sent, failed, pending }: { sent: number; failed: number; pending: number }) {
  const total = sent + failed + pending || 1
  const data = [
    { label: 'Enviadas', value: sent, color: '#4ade80' },
    { label: 'Falhas', value: failed, color: '#f87171' },
    { label: 'Pendentes', value: pending, color: '#555' },
  ]
  return (
    <div className="space-y-2 mt-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
          <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / total) * 100}%`, background: d.color }}
            />
          </div>
          <span className="text-[11px] text-[#666] tabular-nums w-6 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ pct }: { pct: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 70 ? '#b5ff4e' : pct >= 40 ? '#fbbf24' : '#f87171'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#2a2a2a" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
        {pct}%
      </text>
    </svg>
  )
}

// ─── Top nav ──────────────────────────────────────────────────────────────────
function TopNav({ name, plan, onTrigger, triggering }: {
  name: string | undefined
  plan: string
  onTrigger: () => void
  triggering: boolean
}) {
  const pathname = usePathname()
  const tabs = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/vagas', label: 'Vagas' },
    { href: '/perfil', label: 'Perfil' },
  ]
  const triggerTooltip = plan === 'Free' ? 'Busca manual (1x por dia)' : 'Buscar vagas agora'
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-[#2a2a2a] shrink-0">
      <div className="flex items-center gap-6">
        <h1 className="text-white font-bold text-lg tracking-tight">AutoVagas</h1>
        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === t.href
                  ? 'bg-[#b5ff4e] text-[#111]'
                  : 'text-[#888] hover:text-white hover:bg-[#252525]'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onTrigger}
          disabled={triggering}
          title={triggerTooltip}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#b5ff4e] text-[#111] hover:bg-[#c8ff6e] disabled:opacity-50 transition-colors"
        >
          {triggering ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Buscando...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Buscar Vagas
            </>
          )}
        </button>
        <Link
          href="/planos"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1e1e1e] text-[#888] border border-[#2a2a2a] hover:border-[#444] hover:text-white transition-colors"
        >
          Planos
        </Link>
        <div className="w-8 h-8 rounded-full bg-[#b5ff4e] flex items-center justify-center">
          <span className="text-[#111] font-bold text-xs">
            {name?.charAt(0).toUpperCase() ?? '?'}
          </span>
        </div>
      </div>
    </header>
  )
}

// ─── Schedule section ─────────────────────────────────────────────────────────
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function nextExecution(scheduleDays: number[], scheduleTime: string): string {
  if (scheduleDays.length === 0 || !scheduleTime) return '—'
  const [hourStr] = scheduleTime.split(':')
  const hour = parseInt(hourStr, 10)
  // Use local time as approximation for display purposes
  const now = new Date()
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + i)
    candidate.setHours(hour, 0, 0, 0)
    if (candidate <= now) continue
    const dow = candidate.getDay()
    if (!scheduleDays.includes(dow)) continue
    const dayName = DAY_FULL[dow]
    const date = candidate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `${dayName}, ${date} às ${scheduleTime}`
  }
  return '—'
}

function ScheduleSection({
  profile,
  paused,
  onSaved,
}: {
  profile: { scheduleDays: number[]; scheduleTime: string | null } | undefined
  paused: boolean
  onSaved: (msg: string) => void
}) {
  const [days, setDays] = useState<number[]>(() => profile?.scheduleDays ?? [1, 3, 5])
  const [time, setTime] = useState<string>(() => profile?.scheduleTime ?? '08:00')

  // sync when profile loads
  useEffect(() => {
    if (profile) {
      setDays(profile.scheduleDays)
      setTime(profile.scheduleTime ?? '08:00')
    }
  }, [profile])

  const updateSchedule = trpc.user.updateSchedule.useMutation({
    onSuccess: () => onSaved('Agendamento salvo!'),
    onError: (e) => onSaved(e.message),
  })

  const toggleDay = (d: number) =>
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const next = nextExecution(days, time)

  return (
    <div
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
      style={paused ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      <p className="text-[#666] text-xs font-semibold uppercase tracking-widest mb-4">Agendamento</p>

      {/* Day toggles */}
      <div className="flex gap-1.5 mb-4">
        {DAY_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleDay(i)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              days.includes(i)
                ? 'bg-[#b5ff4e] text-[#111] border-[#b5ff4e]'
                : 'bg-[#1a1a1a] text-[#666] border-[#2a2a2a] hover:border-[#444]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Time input */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-[#888] text-sm shrink-0">Horário</label>
        <input
          type="time"
          step={3600}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#b5ff4e]"
        />
      </div>

      {/* Next execution badge */}
      {next !== '—' && (
        <div className="mb-4 px-3 py-1.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-xs text-[#888]">
          Próxima execução: <span className="text-white font-medium">{next}</span>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={() => updateSchedule.mutate({ scheduleDays: days, scheduleTime: time || null })}
        disabled={updateSchedule.isPending}
        className="w-full py-2 rounded-lg bg-[#252525] border border-[#2a2a2a] text-white text-sm font-semibold hover:border-[#b5ff4e] hover:text-[#b5ff4e] disabled:opacity-50 transition-colors"
      >
        {updateSchedule.isPending ? 'Salvando...' : 'Salvar agendamento'}
      </button>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: profile, isLoading: profileLoading } = trpc.user.getProfile.useQuery()
  const { data: stats, isLoading: statsLoading } = trpc.application.getStats.useQuery()
  const { data: timeline, isLoading: timelineLoading } = trpc.application.getTimeline.useQuery()
  const { data: pipelineStatus } = trpc.application.getPipelineStatus.useQuery(undefined, {
    refetchInterval: 5000,
  })
  const utils = trpc.useUtils()

  const searchParams = useSearchParams()
  const router = useRouter()

  // ── Redirect if profile incomplete ──────────────────────────────────────────
  useEffect(() => {
    if (!profileLoading && profileIsIncomplete(profile)) {
      router.replace('/perfil?setup=1')
    }
  }, [profile, profileLoading, router])

  // ── Checkout success toast ───────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setToast('Plano atualizado com sucesso!')
      router.replace('/dashboard')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }
  }, [toast])

  // ── Trigger pipeline ─────────────────────────────────────────────────────────
  const triggerPipeline = trpc.application.triggerPipeline.useMutation({
    onSuccess: () => setToast('Busca iniciada! As vagas aparecerão em alguns minutos.'),
    onError: (e) => {
      if (e.message === 'PIPELINE_LIMIT_REACHED') {
        setToast('Limite diário atingido. Faça upgrade para continuar.')
        setTimeout(() => router.push('/planos'), 2500)
      } else {
        setToast(e.message)
      }
    },
  })

  // ── Automation toggle ────────────────────────────────────────────────────────
  const [localPaused, setLocalPaused] = useState<boolean | null>(null)
  const toggleAutomation = trpc.user.toggleAutomation.useMutation({
    onMutate: () => setLocalPaused(!(localPaused ?? profile?.automationPaused ?? false)),
    onSuccess: (v) => { setLocalPaused(v); utils.user.getProfile.invalidate() },
    onError: () => setLocalPaused(null),
  })
  const paused = localPaused ?? profile?.automationPaused ?? false

  // ── Derived stats ────────────────────────────────────────────────────────────
  const total    = stats?.total ?? 0
  const sent     = stats?.sent ?? 0
  const failed   = stats?.failed ?? 0
  const today    = stats?.todayCount ?? 0
  const avgScore = Math.round(stats?.avgScore ?? 0)
  const pending  = total - sent - failed

  const planNames: Record<string, string> = { FREE: 'Free', PLUS: 'Plus', PRO: 'Pro' }
  const plan = planNames[profile?.plan ?? 'FREE'] ?? 'Free'

  const skeleton = 'bg-[#2a2a2a] animate-pulse rounded'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopNav
        name={profile?.name}
        plan={plan}
        onTrigger={() => triggerPipeline.mutate()}
        triggering={triggerPipeline.isPending}
      />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── Pipeline status ────────────────────────────────────────────── */}
          {pipelineStatus && (() => {
            const active = (pipelineStatus.scraper.active ?? 0) + (pipelineStatus.matching.active ?? 0) + (pipelineStatus.apply.active ?? 0)
            const waiting = (pipelineStatus.scraper.waiting ?? 0) + (pipelineStatus.matching.waiting ?? 0) + (pipelineStatus.apply.waiting ?? 0)
            if (active === 0 && waiting === 0) return null
            return (
              <div className="flex items-center gap-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-3 text-sm">
                <span className="text-[#666] font-medium">Pipeline:</span>
                {active > 0 && (
                  <span className="flex items-center gap-1.5 text-[#b5ff4e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b5ff4e] animate-pulse" />
                    {active} em execução
                  </span>
                )}
                {waiting > 0 && (
                  <span className="flex items-center gap-1.5 text-[#888]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#555]" />
                    {waiting} na fila
                  </span>
                )}
                <span className="text-[#444] text-xs ml-auto">atualiza a cada 5s</span>
              </div>
            )
          })()}

          {/* ── Paused banner ──────────────────────────────────────────────── */}
          {paused && (
            <div className="flex items-center gap-2 bg-[#2a1a00] border border-[#5a3a00] rounded-xl px-4 py-3 text-sm text-[#fbbf24]">
              <span className="font-bold">⚠</span>
              <span>Automação pausada — nenhuma candidatura será enviada hoje.</span>
            </div>
          )}

          {/* ── Grid ────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Col 1: Candidaturas + Automação ─────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* CANDIDATURAS */}
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
                <p className="text-[#666] text-xs font-semibold uppercase tracking-widest mb-4">Candidaturas</p>
                <div className="flex items-end justify-between">
                  <div>
                    {statsLoading ? (
                      <div className={`${skeleton} h-10 w-20`} />
                    ) : (
                      <p className="text-white text-4xl font-bold tabular-nums">{total}</p>
                    )}
                    <p className="text-[#555] text-sm mt-1">total</p>
                  </div>
                  <div className="text-right">
                    {statsLoading ? (
                      <div className={`${skeleton} h-8 w-12`} />
                    ) : (
                      <p className="text-[#b5ff4e] text-2xl font-bold tabular-nums">+{today}</p>
                    )}
                    <p className="text-[#555] text-sm mt-1">hoje</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Sparkline color="#b5ff4e" />
                </div>
              </div>

              {/* AUTOMAÇÃO */}
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex-1">
                <p className="text-[#666] text-xs font-semibold uppercase tracking-widest mb-4">Automação</p>

                {/* Toggle */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {paused ? 'Pausada' : 'Ativa'}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5">
                      {paused ? 'Clique para retomar' : 'Candidaturas automáticas ligadas'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!paused}
                    onClick={() => toggleAutomation.mutate()}
                    disabled={toggleAutomation.isPending}
                    className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      paused ? 'bg-[#333]' : 'bg-[#b5ff4e]'
                    }`}
                    style={{ width: 52 }}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full transition-transform ${
                        paused ? 'translate-x-1 bg-[#666]' : 'translate-x-7 bg-[#111]'
                      }`}
                    />
                  </button>
                </div>

                {/* Plan */}
                <div className="flex items-center justify-between py-3 border-t border-[#2a2a2a]">
                  <p className="text-[#888] text-sm">Plano atual</p>
                  {profileLoading ? (
                    <div className={`${skeleton} h-5 w-12`} />
                  ) : (
                    <span className="text-white text-sm font-semibold bg-[#252525] px-2.5 py-0.5 rounded-full">
                      {plan}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-3 border-t border-[#2a2a2a]">
                  <p className="text-[#888] text-sm">Cota diária</p>
                  {profileLoading ? (
                    <div className={`${skeleton} h-5 w-8`} />
                  ) : (
                    <span className="text-[#b5ff4e] text-sm font-semibold">
                      {profile?.dailyQuota ?? 1}/dia
                    </span>
                  )}
                </div>

                {/* Skills */}
                {!profileLoading && (profile?.skills?.length ?? 0) > 0 && (
                  <div className="pt-3 border-t border-[#2a2a2a]">
                    <p className="text-[#555] text-xs mb-2">Skills cadastradas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile!.skills.slice(0, 6).map((s) => (
                        <span key={s.id} className="text-xs bg-[#252525] text-[#aaa] px-2 py-0.5 rounded-full">
                          {s.name}
                        </span>
                      ))}
                      {profile!.skills.length > 6 && (
                        <span className="text-xs text-[#555]">+{profile!.skills.length - 6}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AGENDAMENTO */}
              <ScheduleSection
                profile={profile ? { scheduleDays: profile.scheduleDays, scheduleTime: profile.scheduleTime } : undefined}
                paused={paused}
                onSaved={setToast}
              />
            </div>

            {/* ── Col 2: Performance ──────────────────────────────────────── */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <p className="text-[#666] text-xs font-semibold uppercase tracking-widest mb-4">Performance</p>

              {/* Score ring */}
              <div className="flex items-center justify-center mb-6">
                {statsLoading ? (
                  <div className={`${skeleton} w-[72px] h-[72px] rounded-full`} />
                ) : (
                  <div className="text-center">
                    <ScoreRing pct={avgScore} />
                    <p className="text-[#555] text-xs mt-1">score médio</p>
                  </div>
                )}
              </div>

              {/* Stat row */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Enviadas', value: sent, color: '#4ade80' },
                  { label: 'Falhas',   value: failed, color: '#f87171' },
                  { label: 'Visualiz.', value: stats?.viewedCount ?? 0, color: '#a78bfa' },
                  { label: 'Pendentes', value: pending < 0 ? 0 : pending, color: '#555' },
                ].map((s) => (
                  <div key={s.label} className="bg-[#141414] rounded-xl p-3">
                    <div className="w-2 h-2 rounded-full mb-1.5" style={{ background: s.color }} />
                    {statsLoading ? (
                      <div className={`${skeleton} h-6 w-10`} />
                    ) : (
                      <p className="text-white text-xl font-bold tabular-nums">{s.value}</p>
                    )}
                    <p className="text-[#555] text-xs">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Distribution bars */}
              {!statsLoading && (
                <DotChart sent={sent} failed={failed} pending={pending < 0 ? 0 : pending} />
              )}
            </div>

            {/* ── Col 3: Vagas Recentes ────────────────────────────────────── */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[#666] text-xs font-semibold uppercase tracking-widest">Vagas Recentes</p>
                <Link href="/vagas" className="text-xs text-[#b5ff4e] hover:underline">
                  Ver todas
                </Link>
              </div>

              {timelineLoading ? (
                <div className="space-y-3 flex-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`${skeleton} w-2.5 h-2.5 rounded-full shrink-0`} />
                      <div className="flex-1 space-y-1">
                        <div className={`${skeleton} h-3.5 w-3/4`} />
                        <div className={`${skeleton} h-3 w-1/2`} />
                      </div>
                      <div className={`${skeleton} h-5 w-16 rounded-full`} />
                    </div>
                  ))}
                </div>
              ) : !timeline?.length ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <p className="text-[#444] text-sm">Nenhuma candidatura ainda</p>
                  <p className="text-[#333] text-xs mt-1">Clique em "Buscar Vagas" para começar</p>
                </div>
              ) : (
                <ul className="space-y-3 flex-1 overflow-auto">
                  {timeline.map((item) => {
                    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING
                    return (
                      <li key={item.id} className="flex items-center gap-3 group">
                        {/* Status dot */}
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: cfg.dot }}
                        />

                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate leading-tight">
                            {item.job.title}
                          </p>
                          <p className="text-[#555] text-xs truncate">{item.job.company}</p>
                        </div>

                        {/* Status + score */}
                        <div className="text-right shrink-0">
                          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {item.matchScore > 0 && (
                            <p className="text-[#555] text-[10px] mt-0.5 tabular-nums">
                              {Math.round(item.matchScore)}%
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#b5ff4e] text-[#111] px-4 py-2 rounded-xl shadow-lg text-sm font-semibold z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
