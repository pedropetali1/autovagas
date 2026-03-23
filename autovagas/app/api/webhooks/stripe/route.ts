import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const PLAN_CONFIG: Record<string, { plan: 'PLUS' | 'PRO'; dailyQuota: number }> = {
  [process.env.STRIPE_PRICE_PLUS ?? '__missing_plus__']: { plan: 'PLUS', dailyQuota: 10 },
  [process.env.STRIPE_PRICE_PRO ?? '__missing_pro__']: { plan: 'PRO', dailyQuota: 20 },
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-02-25.clover',
  })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const userId = session.metadata?.userId
      if (!userId) {
        return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 })
      }

      // Get line items to find price ID
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
      const priceId = lineItems.data[0]?.price?.id

      if (priceId && PLAN_CONFIG[priceId]) {
        const { plan, dailyQuota } = PLAN_CONFIG[priceId]
        await prisma.user.update({
          where: { id: userId },
          data: { plan, dailyQuota },
        })
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      // Find user by stripeCustomerId metadata — fall back to metadata on subscription
      const userId = subscription.metadata?.userId
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: 'FREE', dailyQuota: 1 },
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
