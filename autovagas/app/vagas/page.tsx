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

// ─── Application Item Type ─────────────────────────────────────────────────────
type ApplicationItem = {
  id: string
  status: string
  matchScore: number
  appliedAt: Date | null
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

// ─── Application Card ─────────────────────────────────────────────────────────
function ApplicationCard({
  item,
  onClick,
}: {
  item: ApplicationItem
  onClick: () => void
}) {
  const showManualApply =
    item.status === 'FAILED' && item.failReason === 'FORM_NOT_SUPPORTED' && item.directUrl

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
    >
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
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          Candidatar manualmente ↗
        </a>
      )}
    </div>
  )
}

// ─── Log action icons & labels ────────────────────────────────────────────────
const ACTION_ICONS: Record<string, string> = {
  SCRAPE: '🔍',
  MATCH: '⚡',
  FILL_FORM: '✏️',
  SUBMIT: '📤',
  SCREENSHOT: '📸',
}

const ACTION_LABELS: Record<string, string> = {
  SCRAPE: 'Coleta',
  MATCH: 'Matching',
  FILL_FORM: 'Preenchimento',
  SUBMIT: 'Envio',
  SCREENSHOT: 'Captura de tela',
}

type LogEntry = {
  id: string
  action: string
  detail: unknown
  screenshotUrl: string | null
  createdAt: Date
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function DetailKeyValue({ detail }: { detail: unknown }) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const entries = Object.entries(detail as Record<string, unknown>)
  if (entries.length === 0) return null

  return (
    <dl className="mt-1 space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 text-xs">
          <dt className="text-gray-400 shrink-0">{key}:</dt>
          <dd className="text-gray-600 break-all">
            {Array.isArray(value) ? value.join(', ') : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function LogTimeline({ applicationId }: { applicationId: string }) {
  const { data: logs, isLoading } = trpc.application.getLogs.useQuery({ applicationId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum registro encontrado.</p>
  }

  return (
    <ol className="relative space-y-0">
      {(logs as LogEntry[]).map((log, idx) => (
        <li key={log.id} className="flex gap-3">
          {/* Timeline line + icon */}
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-base shrink-0 z-10">
              {ACTION_ICONS[log.action] ?? '•'}
            </div>
            {idx < logs.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 my-1" />
            )}
          </div>

          {/* Content */}
          <div className={`flex-1 pb-4 ${idx === logs.length - 1 ? '' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">
                {ACTION_LABELS[log.action] ?? log.action}
              </span>
              <span className="text-xs text-gray-400 tabular-nums shrink-0">
                {formatDate(log.createdAt)}
              </span>
            </div>

            <DetailKeyValue detail={log.detail} />

            {/* Screenshot thumbnail */}
            {log.action === 'SCREENSHOT' && log.screenshotUrl && (
              <a
                href={log.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={log.screenshotUrl}
                  alt="Screenshot"
                  className="rounded-lg border border-gray-200 max-h-32 object-cover hover:opacity-80 transition-opacity"
                />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ─── Application Detail Modal ─────────────────────────────────────────────────
function ApplicationDetailModal({
  app,
  onClose,
}: {
  app: ApplicationItem
  onClose: () => void
}) {
  const showManualApply =
    app.failReason === 'FORM_NOT_SUPPORTED' && app.directUrl

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 leading-tight">
              {app.job.title}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{app.job.company}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
          <StatusBadge status={app.status} />
          <span className="text-xs text-gray-400">
            {Math.round(app.matchScore)}% compatibilidade
          </span>
          {app.appliedAt && (
            <span className="text-xs text-gray-400">
              · Enviada em {formatDate(app.appliedAt)}
            </span>
          )}
        </div>

        {/* FORM_NOT_SUPPORTED notice */}
        {showManualApply && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
            <p className="text-sm text-amber-800 font-medium">
              Formulário externo não mapeado
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              A automação não conseguiu preencher este formulário automaticamente.
            </p>
            <a
              href={app.directUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
            >
              Candidatar manualmente ↗
            </a>
          </div>
        )}

        {/* Log timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Histórico
          </h3>
          <LogTimeline applicationId={app.id} />
        </div>
      </div>
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
  const [selectedApp, setSelectedApp] = useState<ApplicationItem | null>(null)

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
            {allItems.map((item) => {
              const appItem: ApplicationItem = {
                id: item.id,
                status: item.status,
                matchScore: item.matchScore,
                appliedAt: item.appliedAt ?? null,
                failReason: item.failReason ?? null,
                directUrl: item.directUrl ?? null,
                job: {
                  title: item.job.title,
                  company: item.job.company,
                  location: item.job.location ?? null,
                  salary: item.job.salary ?? null,
                  applyType: item.job.applyType,
                },
              }
              return (
                <ApplicationCard
                  key={item.id}
                  item={appItem}
                  onClick={() => setSelectedApp(appItem)}
                />
              )
            })}

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

      {/* Detail modal */}
      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </main>
  )
}
