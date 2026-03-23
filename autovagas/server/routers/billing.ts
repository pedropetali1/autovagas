import { z } from 'zod'
import Stripe from 'stripe'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'

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

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-02-25.clover',
  })
}

export const billingRouter = createTRPCRouter({
  getPlans: protectedProcedure.query(() => {
    return PLANS
  }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ plan: z.enum(['PLUS', 'PRO']) }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe()

      const priceId =
        input.plan === 'PLUS'
          ? process.env.STRIPE_PRICE_PLUS
          : process.env.STRIPE_PRICE_PRO

      if (!priceId) {
        throw new Error(`Missing Stripe price ID for plan ${input.plan}`)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { userId: ctx.user.id, plan: input.plan },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/planos`,
      })

      return { url: session.url }
    }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { plan: true, dailyQuota: true },
    })
    return user
  }),
})
