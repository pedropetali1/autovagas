import { Playfair_Display, DM_Sans } from 'next/font/google'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

// ─── Static plan data (mirrors billing router PLANS) ──────────────────────────
const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    dailyQuota: 1,
    features: ['1 candidatura/dia', 'Dashboard básico', 'Notificações por e-mail'],
  },
  {
    id: 'PLUS',
    name: 'Plus',
    price: 29,
    dailyQuota: 10,
    features: ['10 candidaturas/dia', 'Dashboard completo', 'Notificações por e-mail', 'Suporte prioritário'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 59,
    dailyQuota: 20,
    features: ['20 candidaturas/dia', 'Dashboard completo', 'Notificações por e-mail', 'Suporte prioritário', 'Análise avançada de compatibilidade'],
  },
]

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
        isPro ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-[#e8e7e0]'
      }`}
    >
      <div className="mb-6">
        <h3 className={`text-xl font-semibold mb-1 ${isPro ? 'text-white' : 'text-gray-900'}`}>
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1">
          {isFree ? (
            <span className={`text-4xl font-bold ${isPro ? 'text-white' : 'text-gray-900'}`}>
              {freeLabel}
            </span>
          ) : (
            <>
              <span className={`text-4xl font-bold ${isPro ? 'text-white' : 'text-gray-900'}`}>
                R${plan.price}
              </span>
              <span className={`text-sm ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>
                {perMonth}
              </span>
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

      <Link
        href="/sign-up"
        className={`w-full py-2.5 rounded-xl text-sm font-medium text-center transition-colors block ${
          isPro
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

// ─── Landing Page (SSG) ───────────────────────────────────────────────────────
export default async function LandingPage() {
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
    <div
      className={`${playfair.variable} ${dmSans.variable} min-h-screen`}
      style={{ background: '#fafaf8', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}
    >
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto"
        style={{ borderBottom: '1px solid #e8e7e0' }}
      >
        <span className="text-xl font-bold text-gray-900">{tCommon('brand')}</span>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900">
            {t('nav.signin')}
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {t('nav.signup')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1
          className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight"
          style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
        >
          {t('hero.title')}
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('hero.description')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sign-up"
            className="bg-gray-900 text-white px-8 py-4 rounded-xl text-base font-medium hover:bg-gray-800 transition-colors"
          >
            {t('hero.cta')}
          </Link>
          <Link
            href="#como-funciona"
            className="border text-gray-700 px-8 py-4 rounded-xl text-base font-medium hover:bg-gray-100 transition-colors"
            style={{ borderColor: '#e8e7e0' }}
          >
            {t('howItWorks.title')}
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y py-12" style={{ borderColor: '#e8e7e0', background: '#fff' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {STATS_VALUES.map((stat) => (
              <div key={stat.id}>
                <p
                  className="text-4xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
                >
                  {stat.value}
                </p>
                <p className="text-gray-500 text-sm">{t(`stats.${stat.id}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
          >
            {t('howItWorks.title')}
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white rounded-2xl p-8"
              style={{ border: '1px solid #e8e7e0' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-mono font-bold text-gray-400">{step.number}</span>
                <div className="text-gray-700">{step.icon}</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24" style={{ background: '#fafaf8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
            >
              {t('pricing.title')}
            </h2>
            <p className="text-gray-500">{t('pricing.subtitle')}</p>
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
      <section className="py-24 text-center" style={{ borderTop: '1px solid #e8e7e0', background: '#fff' }}>
        <div className="max-w-2xl mx-auto px-6">
          <h2
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
            style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
          >
            {t('finalCta.title')}
          </h2>
          <p className="text-gray-500 mb-10 text-lg">
            {t('finalCta.description')}
          </p>
          <Link
            href="/sign-up"
            className="inline-block bg-gray-900 text-white px-10 py-4 rounded-xl text-base font-medium hover:bg-gray-800 transition-colors"
          >
            {t('finalCta.button')}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 text-center text-sm text-gray-400"
        style={{ borderTop: '1px solid #e8e7e0' }}
      >
        <p>{t('footer.copyright')}</p>
      </footer>
    </div>
  )
}
