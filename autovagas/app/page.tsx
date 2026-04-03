import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { PLANS } from '@/lib/plans'

const STATS_VALUES = [
  { id: 'applications', value: '10.000+' },
  { id: 'jobsPerDay', value: '50.000+' },
  { id: 'activeUsers', value: '2.500+' },
] as const

// ─── Static Plan Card (no interactivity — links to /planos for signup) ────────
function StaticPlanCard({
  plan,
  freeLabel,
  perMonth,
  cta,
}: {
  plan: typeof PLANS[number]
  freeLabel: string
  perMonth: string
  cta: string
}) {
  const isFree = plan.id === 'FREE'
  const isPro = plan.id === 'PRO'

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        isPro ? 'bg-[#1e2a0e] border-[#b5ff4e]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
      }`}
    >
      <div className="mb-6">
        <h3 className="text-white text-xl font-semibold mb-1">
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1">
          {isFree ? (
            <span className="text-white text-4xl font-bold">
              {freeLabel}
            </span>
          ) : (
            <>
              <span className="text-white text-4xl font-bold">
                R${plan.price}
              </span>
              <span className="text-[#666] text-sm">
                {perMonth}
              </span>
            </>
          )}
        </div>
        <p className="text-[#666] text-sm mt-1">
          {plan.dailyQuota} {plan.dailyQuota === 1 ? 'vaga' : 'vagas'}/dia
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

      <Link
        href="/sign-up"
        className="w-full py-3 rounded-xl text-sm font-bold text-center transition-colors block bg-[#b5ff4e] text-[#111] hover:bg-[#c8ff6e]"
      >
        {cta}
      </Link>
    </div>
  )
}

// ─── Landing Page (SSG) ───────────────────────────────────────────────────────
export default async function LandingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const t = await getTranslations('landing')
  const tCommon = await getTranslations('common')

  const steps = [
    {
      number: t('howItWorks.step1.number'),
      title: t('howItWorks.step1.title'),
      description: t('howItWorks.step1.description'),
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      ),
    },
    {
      number: t('howItWorks.step2.number'),
      title: t('howItWorks.step2.title'),
      description: t('howItWorks.step2.description'),
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      number: t('howItWorks.step3.number'),
      title: t('howItWorks.step3.title'),
      description: t('howItWorks.step3.description'),
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#111111]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#b5ff4e] flex items-center justify-center">
            <span className="text-[#111] font-black text-xs">AV</span>
          </div>
          <span className="text-white text-lg font-bold">{tCommon('brand')}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-[#888] hover:text-white transition-colors">
            {t('nav.signin')}
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-[#b5ff4e] text-[#111] font-bold px-4 py-2 rounded-xl hover:bg-[#c8ff6e] transition-colors"
          >
            {t('nav.signup')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-28 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          {t('hero.title')}
        </h1>
        <p className="text-xl text-[#888] mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('hero.description')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sign-up"
            className="bg-[#b5ff4e] text-[#111] font-bold px-8 py-4 rounded-xl text-base hover:bg-[#c8ff6e] transition-colors"
          >
            {t('hero.cta')}
          </Link>
          <Link
            href="#como-funciona"
            className="border border-[#2a2a2a] text-[#888] px-8 py-4 rounded-xl text-base hover:text-white hover:border-[#444] transition-colors"
          >
            {t('howItWorks.title')}
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[#2a2a2a] bg-[#1a1a1a] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {STATS_VALUES.map((stat) => (
              <div key={stat.id}>
                <p className="text-4xl font-bold text-[#b5ff4e] mb-2">
                  {stat.value}
                </p>
                <p className="text-[#666] text-sm">{t(`stats.${stat.id}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('howItWorks.title')}
          </h2>
          <p className="text-[#666] max-w-xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-mono font-bold text-[#555]">{step.number}</span>
                <div className="text-[#b5ff4e]">{step.icon}</div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-sm text-[#666] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-[#111111] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {t('pricing.title')}
            </h2>
            <p className="text-[#666]">{t('pricing.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <StaticPlanCard
                key={plan.id}
                plan={plan}
                freeLabel={t('pricing.free')}
                perMonth={t('pricing.perMonth')}
                cta={t('pricing.cta')}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 text-center border-t border-[#2a2a2a] bg-[#1a1a1a]">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {t('finalCta.title')}
          </h2>
          <p className="text-[#666] mb-10 text-lg">
            {t('finalCta.description')}
          </p>
          <Link
            href="/sign-up"
            className="inline-block bg-[#b5ff4e] text-[#111] font-bold px-10 py-4 rounded-xl text-base hover:bg-[#c8ff6e] transition-colors"
          >
            {t('finalCta.button')}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-[#444] border-t border-[#2a2a2a]">
        <p>{t('footer.copyright')}</p>
      </footer>
    </div>
  )
}
