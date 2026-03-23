'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  APPLYING: 'Candidatando',
  SENT: 'Enviada',
  FAILED: 'Falhou',
  VIEWED: 'Visualizada',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  APPLYING: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  VIEWED: 'bg-purple-100 text-purple-700',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string | number
  loading: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-20 mt-1" />
      ) : (
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      )}
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard() {
  const { data: profile, isLoading: profileLoading } = trpc.user.getProfile.useQuery()
  const { data: stats, isLoading: statsLoading } = trpc.application.getStats.useQuery()

  const planNames: Record<string, string> = { FREE: 'Free', PLUS: 'Plus', PRO: 'Pro' }
  const loading = profileLoading || statsLoading

  return (
    <div className="bg-gray-900 text-white rounded-xl p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400 mb-1">Plano atual</p>
        {loading ? (
          <Skeleton className="h-7 w-16 bg-gray-700" />
        ) : (
          <p className="text-xl font-semibold">{planNames[profile?.plan ?? 'FREE'] ?? 'Free'}</p>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-1">Cota diária</p>
        {loading ? (
          <Skeleton className="h-7 w-12 bg-gray-700 mx-auto" />
        ) : (
          <p className="text-xl font-semibold">{profile?.dailyQuota ?? 1} vagas</p>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-1">Hoje</p>
        {loading ? (
          <Skeleton className="h-7 w-12 bg-gray-700 mx-auto" />
        ) : (
          <p className="text-xl font-semibold">{stats?.todayCount ?? 0} candidaturas</p>
        )}
      </div>
    </div>
  )
}

// ─── Automation Toggle ────────────────────────────────────────────────────────
function AutomationToggle() {
  const utils = trpc.useUtils()
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery()
  const [localPaused, setLocalPaused] = useState<boolean | null>(null)

  const toggleAutomation = trpc.user.toggleAutomation.useMutation({
    onMutate: () => {
      const current = localPaused ?? profile?.automationPaused ?? false
      setLocalPaused(!current)
    },
    onSuccess: (newValue) => {
      setLocalPaused(newValue)
      utils.user.getProfile.invalidate()
    },
    onError: () => {
      setLocalPaused(null)
    },
  })

  const paused = localPaused ?? profile?.automationPaused ?? false

  return (
    <div className="flex items-center gap-3">
      {isLoading ? (
        <Skeleton className="h-6 w-40" />
      ) : (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={!paused}
            onClick={() => toggleAutomation.mutate()}
            disabled={toggleAutomation.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${
              paused
                ? 'bg-amber-400 focus:ring-amber-400'
                : 'bg-gray-900 focus:ring-gray-900'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                paused ? 'translate-x-1' : 'translate-x-6'
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">Pausar automação</span>
          {paused && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Automação pausada
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function Timeline() {
  const { data: timeline, isLoading } = trpc.application.getTimeline.useQuery()

  function formatDate(date: Date | null | undefined) {
    if (!date) return '—'
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Atividade recente</h2>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : !timeline?.length ? (
        <p className="text-sm text-gray-500">Nenhuma candidatura ainda.</p>
      ) : (
        <ul className="space-y-3">
          {timeline.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 truncate block">{item.job.title}</span>
                <span className="text-gray-500">{item.job.company}</span>
              </div>
              <StatusBadge status={item.status} />
              <span className="text-gray-400 text-xs whitespace-nowrap">
                {formatDate(item.appliedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: profile, isLoading: profileLoading } = trpc.user.getProfile.useQuery()
  const { data: stats, isLoading: statsLoading } = trpc.application.getStats.useQuery()
  const paused = profile?.automationPaused ?? false

  const total = stats?.total ?? 0
  const sent = stats?.sent ?? 0
  const failed = stats?.failed ?? 0
  const avgScore = stats?.avgScore ?? 0
  const failRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0'

  return (
    <main className="min-h-screen bg-[#fafaf8] p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {profileLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <h1 className="text-2xl font-semibold text-gray-900">
                Olá, {profile?.name?.split(' ')[0] ?? 'usuário'} 👋
              </h1>
            )}
            <p className="text-sm text-gray-500 mt-1">Acompanhe suas candidaturas</p>
          </div>
          {paused && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 border border-amber-200">
              Automação pausada
            </span>
          )}
        </div>

        {/* Plan Card */}
        <PlanCard />

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total de candidaturas" value={total} loading={statsLoading} />
          <MetricCard label="Enviadas com sucesso" value={sent} loading={statsLoading} />
          <MetricCard label="Taxa de falha" value={`${failRate}%`} loading={statsLoading} />
          <MetricCard
            label="Score médio"
            value={`${avgScore.toFixed(1)}%`}
            loading={statsLoading}
          />
        </div>

        {/* Automation Toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <AutomationToggle />
        </div>

        {/* Timeline */}
        <Timeline />
      </div>
    </main>
  )
}
