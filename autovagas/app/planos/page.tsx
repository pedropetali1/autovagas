'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { trpc } from '@/lib/trpc'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#2a2a2a] rounded ${className ?? ''}`} />
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
interface Plan {
  id: string
  name: string
  price: number
  dailyQuota: number
  features: string[]
}

function PlanCard({
  plan,
  isCurrent,
  onSubscribe,
  loading,
}: {
  plan: Plan
  isCurrent: boolean
  onSubscribe: (planId: 'PLUS' | 'PRO') => void
  loading: boolean
}) {
  const t = useTranslations('planos')
  const isFree = plan.id === 'FREE'
  const isPro = plan.id === 'PRO'

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        isPro
          ? 'bg-[#1e2a0e] border-[#b5ff4e]'
          : 'bg-[#1a1a1a] border-[#2a2a2a]'
      }`}
    >
      {isCurrent && (
        <span className="absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#b5ff4e] text-[#111]">
          {t('yourPlan')}
        </span>
      )}

      <div className="mb-6">
        <h2 className="text-white text-xl font-semibold mb-1">
          {plan.name}
        </h2>
        <div className="flex items-baseline gap-1">
          {isFree ? (
            <span className="text-white text-4xl font-bold">
              {t('free')}
            </span>
          ) : (
            <>
              <span className="text-white text-4xl font-bold">
                R${plan.price}
              </span>
              <span className="text-[#666] text-sm">
                {t('perMonth')}
              </span>
            </>
          )}
        </div>
        <p className="text-[#666] text-sm mt-1">
          {t('quota', { count: plan.dailyQuota })}
        </p>
      </div>

      <ul className="space-y-3 flex-1 mb-8">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <svg
              className="w-4 h-4 flex-shrink-0 text-[#b5ff4e]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[#888]">{feature}</span>
          </li>
        ))}
      </ul>

      {isFree ? (
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl text-sm font-medium bg-[#252525] text-[#666] cursor-not-allowed"
        >
          {t('currentPlan')}
        </button>
      ) : isCurrent ? (
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl text-sm font-medium bg-[#252525] text-[#666] cursor-not-allowed"
        >
          {t('currentPlan')}
        </button>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => onSubscribe(plan.id as 'PLUS' | 'PRO')}
          className="w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 bg-[#b5ff4e] text-[#111] hover:bg-[#c8ff6e]"
        >
          {loading ? t('waiting') : t('subscribe')}
        </button>
      )}
    </div>
  )
}

// ─── Planos Page ──────────────────────────────────────────────────────────────
export default function PlanosPage() {
  const t = useTranslations('planos')
  const router = useRouter()
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null)

  const { data: plans, isLoading: plansLoading } = trpc.billing.getPlans.useQuery()
  const { data: subscription, isLoading: subLoading } = trpc.billing.getSubscription.useQuery()

  const createCheckoutSession = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      if (url) {
        router.push(url)
      }
    },
    onError: () => {
      setSubscribingPlan(null)
    },
  })

  function handleSubscribe(planId: 'PLUS' | 'PRO') {
    setSubscribingPlan(planId)
    createCheckoutSession.mutate({ plan: planId })
  }

  const currentPlan = subscription?.plan ?? 'FREE'
  const isLoading = plansLoading || subLoading

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-white text-3xl font-bold mb-3">{t('title')}</h1>
          <p className="text-[#666]">{t('subtitle')}</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(plans ?? []).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === currentPlan}
                onSubscribe={handleSubscribe}
                loading={subscribingPlan === plan.id && createCheckoutSession.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
