'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { trpc } from '@/lib/trpc'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#2a2a2a] rounded ${className ?? ''}`} />
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  PENDING:  'bg-[#3a3a3a] text-[#aaa]',
  APPLYING: 'bg-[#1e3a5f] text-[#60a5fa]',
  SENT:     'bg-[#14301a] text-[#4ade80]',
  FAILED:   'bg-[#3a1a1a] text-[#f87171]',
  VIEWED:   'bg-[#2d1a3d] text-[#a78bfa]',
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('status')
  const labels: Record<string, string> = {
    PENDING: t('PENDING'),
    APPLYING: t('APPLYING'),
    SENT: t('SENT'),
    FAILED: t('FAILED'),
    VIEWED: t('VIEWED'),
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_COLORS[status] ?? 'bg-[#3a3a3a] text-[#aaa]'
      }`}
    >
      {labels[status] ?? status}
    </span>
  )
}

// ─── ApplyType Badge ──────────────────────────────────────────────────────────
function ApplyTypeBadge({ applyType }: { applyType: string }) {
  const t = useTranslations('applyType')
  const isEasy = applyType === 'EASY_APPLY'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isEasy ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'bg-[#252525] text-[#888]'
      }`}
    >
      {isEasy ? t('EASY_APPLY') : t('EXTERNAL')}
    </span>
  )
}

// ─── Match Score Bar ──────────────────────────────────────────────────────────
function MatchScoreBar({ score }: { score: number }) {
  const pct = Math.round(score)
  const color =
    pct >= 70
      ? 'bg-[#4ade80]'
      : pct >= 40
        ? 'bg-[#fbbf24]'
        : 'bg-[#f87171]'
  const textColor =
    pct >= 70
      ? 'text-[#4ade80]'
      : pct >= 40
        ? 'text-[#fbbf24]'
        : 'text-[#f87171]'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>
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
  const t = useTranslations('vagas')
  const showManualApply =
    item.status === 'FAILED' && item.failReason === 'FORM_NOT_SUPPORTED' && item.directUrl

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 space-y-3 hover:border-[#3a3a3a] transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{item.job.title}</h3>
          <p className="text-sm text-[#888]">{item.job.company}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#555]">
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#b5ff4e] hover:underline"
        >
          {t('manualApply')}
        </a>
      )}
    </div>
  )
}

// ─── Log action labels ──────────────────────────────────────────────────────────
const ACTION_DOTS: Record<string, string> = {
  SCRAPE:     '#888',
  MATCH:      '#b5ff4e',
  FILL_FORM:  '#60a5fa',
  SUBMIT:     '#4ade80',
  SCREENSHOT: '#a78bfa',
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
          <dt className="text-[#555] shrink-0">{key}:</dt>
          <dd className="text-[#888] break-all">
            {Array.isArray(value) ? value.join(', ') : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function LogTimeline({ applicationId }: { applicationId: string }) {
  const tAction = useTranslations('logAction')
  const actionLabels: Record<string, string> = {
    SCRAPE: tAction('SCRAPE'),
    MATCH: tAction('MATCH'),
    FILL_FORM: tAction('FILL_FORM'),
    SUBMIT: tAction('SUBMIT'),
    SCREENSHOT: tAction('SCREENSHOT'),
  }
  const tVagas = useTranslations('vagas')
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
    return <p className="text-sm text-[#555]">{tVagas('logsEmpty')}</p>
  }

  return (
    <ol className="relative space-y-0">
      {(logs as LogEntry[]).map((log, idx) => (
        <li key={log.id} className="flex gap-3">
          {/* Timeline line + icon */}
          <div className="flex flex-col items-center">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#252525] shrink-0 z-10"
              style={{ border: `1px solid ${ACTION_DOTS[log.action] ?? '#2a2a2a'}` }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: ACTION_DOTS[log.action] ?? '#555' }}
              />
            </div>
            {idx < logs.length - 1 && (
              <div className="w-px flex-1 bg-[#2a2a2a] my-1" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-white">
                {actionLabels[log.action] ?? log.action}
              </span>
              <span className="text-xs text-[#555] tabular-nums shrink-0">
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
                  className="rounded-xl border border-[#2a2a2a] max-h-32 object-cover hover:opacity-80 transition-opacity"
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
  const t = useTranslations('vagas')
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white leading-tight">
              {app.job.title}
            </h2>
            <p className="text-sm text-[#888] mt-0.5">{app.job.company}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('modal.close')}
            className="shrink-0 text-[#555] hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[#2a2a2a]">
          <StatusBadge status={app.status} />
          <span className="text-xs text-[#555]">
            {t('compatibility', { score: Math.round(app.matchScore) })}
          </span>
          {app.appliedAt && (
            <span className="text-xs text-[#555]">
              {t('sentAt', { date: formatDate(app.appliedAt) })}
            </span>
          )}
        </div>

        {/* FORM_NOT_SUPPORTED notice */}
        {showManualApply && (
          <div className="px-5 py-3 bg-[#2a1a00] border-b border-[#5a3a00]">
            <p className="text-sm text-[#fbbf24] font-medium">
              {t('modal.formNotSupported')}
            </p>
            <p className="text-xs text-[#fbbf24] opacity-80 mt-0.5">
              {t('modal.formNotSupportedDesc')}
            </p>
            <a
              href={app.directUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#b5ff4e] hover:underline"
            >
              {t('manualApply')}
            </a>
          </div>
        )}

        {/* Log timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-4">
            {t('modal.history')}
          </h3>
          <LogTimeline applicationId={app.id} />
        </div>
      </div>
    </div>
  )
}

// ─── Status filter options ─────────────────────────────────────────────────────
type StatusFilterValue = '' | 'PENDING' | 'APPLYING' | 'SENT' | 'FAILED' | 'VIEWED'

// ─── Vagas Page ───────────────────────────────────────────────────────────────
export default function VagasPage() {
  const t = useTranslations('vagas')
  const tCommon = useTranslations('common')
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

  const statusFilterOptions: { value: StatusFilterValue; label: string }[] = [
    { value: '', label: t('filter.all') },
    { value: 'PENDING', label: t('filter.pending') },
    { value: 'APPLYING', label: t('filter.applying') },
    { value: 'SENT', label: t('filter.sent') },
    { value: 'FAILED', label: t('filter.failed') },
    { value: 'VIEWED', label: t('filter.viewed') },
  ]

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Automation paused banner */}
        {automationPaused && (
          <div className="flex items-center gap-2 bg-[#2a1a00] border border-[#5a3a00] rounded-xl px-4 py-3 text-[#fbbf24] text-sm font-medium">
            <span>!</span>
            <span>{t('automationPaused')}</span>
          </div>
        )}

        {/* Page header + filter */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-white text-2xl font-bold">{t('title')}</h1>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#b5ff4e] transition-colors"
          >
            {statusFilterOptions.map((opt) => (
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
              <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 space-y-3">
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
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-10 text-center">
            <p className="text-[#555] text-sm">{t('empty')}</p>
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
                  className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-xl px-5 py-2 text-sm hover:border-[#3a3a3a] hover:text-white disabled:opacity-50 transition-colors"
                >
                  {isFetchingNextPage ? tCommon('loading') : tCommon('loadMore')}
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
