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

// ─── ApplyType Badge ──────────────────────────────────────────────────────────
function ApplyTypeBadge({ applyType }: { applyType: string }) {
  const isEasy = applyType === 'EASY_APPLY'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isEasy ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {isEasy ? 'Easy Apply' : 'Externo'}
    </span>
  )
}

// ─── Match Score Bar ──────────────────────────────────────────────────────────
function MatchScoreBar({ score }: { score: number }) {
  const pct = Math.round(score)
  const color =
    pct >= 70
      ? 'bg-green-500'
      : pct >= 40
        ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium tabular-nums ${
          pct >= 70
            ? 'text-green-600'
            : pct >= 40
              ? 'text-amber-600'
              : 'text-red-600'
        }`}
      >
        {pct}%
      </span>
    </div>
  )
}

// ─── Application Card ─────────────────────────────────────────────────────────
type ApplicationItem = {
  id: string
  status: string
  matchScore: number
  failReason: string | null
  directUrl: string | null
  job: {
    title: string
    company: string
    location: string | null
    salary: number | null
    applyType: string
  }
}

function ApplicationCard({ item }: { item: ApplicationItem }) {
  const showManualApply =
    item.status === 'FAILED' && item.failReason === 'FORM_NOT_SUPPORTED' && item.directUrl

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{item.job.title}</h3>
          <p className="text-sm text-gray-600">{item.job.company}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {item.job.location && <span>{item.job.location}</span>}
        {item.job.location && item.job.salary && <span>·</span>}
        {item.job.salary && (
          <span>
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            }).format(item.job.salary)}
          </span>
        )}
        <ApplyTypeBadge applyType={item.job.applyType} />
      </div>

      {/* Match score */}
      <MatchScoreBar score={item.matchScore} />

      {/* Manual apply button */}
      {showManualApply && (
        <a
          href={item.directUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          Candidatar manualmente ↗
        </a>
      )}
    </div>
  )
}

// ─── Status filter options ─────────────────────────────────────────────────────
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'APPLYING', label: 'Candidatando' },
  { value: 'SENT', label: 'Enviada' },
  { value: 'FAILED', label: 'Falhou' },
  { value: 'VIEWED', label: 'Visualizada' },
] as const

type StatusFilterValue = (typeof STATUS_FILTER_OPTIONS)[number]['value']

// ─── Vagas Page ───────────────────────────────────────────────────────────────
export default function VagasPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('')

  const { data: profile } = trpc.user.getProfile.useQuery()
  const automationPaused = profile?.automationPaused ?? false

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = trpc.application.list.useInfiniteQuery(
    {
      limit: 20,
      status: (statusFilter as string) || undefined,
    } as Parameters<typeof trpc.application.list.useInfiniteQuery>[0],
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <main className="min-h-screen bg-[#fafaf8] p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Automation paused banner */}
        {automationPaused && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm font-medium">
            <span>⚠</span>
            <span>Automação pausada</span>
          </div>
        )}

        {/* Page header + filter */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Minhas vagas</h1>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : !allItems.length ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-500 text-sm">Nenhuma candidatura encontrada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allItems.map((item) => (
              <ApplicationCard
                key={item.id}
                item={{
                  id: item.id,
                  status: item.status,
                  matchScore: item.matchScore,
                  failReason: item.failReason ?? null,
                  directUrl: item.directUrl ?? null,
                  job: {
                    title: item.job.title,
                    company: item.job.company,
                    location: item.job.location ?? null,
                    salary: item.job.salary ?? null,
                    applyType: item.job.applyType,
                  },
                }}
              />
            ))}

            {hasNextPage && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
