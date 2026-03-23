'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
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
  const isFree = plan.id === 'FREE'
  const isPro = plan.id === 'PRO'

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        isPro
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white border-gray-200'
      }`}
    >
      {isCurrent && (
        <span
          className={`absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPro ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
          }`}
        >
          Seu plano
        </span>
      )}

      <div className="mb-6">
        <h2 className={`text-xl font-semibold mb-1 ${isPro ? 'text-white' : 'text-gray-900'}`}>
          {plan.name}
        </h2>
        <div className="flex items-baseline gap-1">
          {isFree ? (
            <span className={`text-4xl font-bold ${isPro ? 'text-white' : 'text-gray-900'}`}>
              Grátis
            </span>
          ) : (
            <>
              <span className={`text-4xl font-bold ${isPro ? 'text-white' : 'text-gray-900'}`}>
                R${plan.price}
              </span>
              <span className={`text-sm ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>/mês</span>
            </>
          )}
        </div>
        <p className={`text-sm mt-1 ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>
          {plan.dailyQuota} {plan.dailyQuota === 1 ? 'vaga' : 'vagas'}/dia
        </p>
      </div>

      <ul className="space-y-3 flex-1 mb-8">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <svg
              className={`w-4 h-4 flex-shrink-0 ${isPro ? 'text-white' : 'text-gray-900'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className={isPro ? 'text-gray-300' : 'text-gray-600'}>{feature}</span>
          </li>
        ))}
      </ul>

      {isFree ? (
        <button
          type="button"
          disabled
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Plano atual
        </button>
      ) : isCurrent ? (
        <button
          type="button"
          disabled
          className={`w-full py-2.5 rounded-xl text-sm font-medium ${
            isPro
              ? 'bg-white/20 text-white cursor-not-allowed'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Plano atual
        </button>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => onSubscribe(plan.id as 'PLUS' | 'PRO')}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${
            isPro
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {loading ? 'Aguarde…' : 'Assinar'}
        </button>
      )}
    </div>
  )
}

// ─── Planos Page ──────────────────────────────────────────────────────────────
export default function PlanosPage() {
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
    <main className="min-h-screen bg-[#fafaf8] p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Escolha seu plano</h1>
          <p className="text-gray-500">
            Aumente sua cota diária e candidate-se a mais vagas automaticamente.
          </p>
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
