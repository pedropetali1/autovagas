import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'

interface ClerkEmailAddress {
  email_address: string
  id: string
  verification: { status: string } | null
}

interface ClerkUserPayload {
  id: string
  email_addresses: ClerkEmailAddress[]
  primary_email_address_id: string
  first_name: string | null
  last_name: string | null
}

interface WebhookEvent {
  type: string
  data: ClerkUserPayload
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET

  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return new Response('Server configuration error', { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing Svix headers', { status: 400 })
  }

  const body = await request.text()

  const wh = new Webhook(secret)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const { type, data } = event

  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )
  const email = primaryEmail?.email_address ?? data.email_addresses[0]?.email_address
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Unknown'

  try {
    if (type === 'user.created') {
      await prisma.user.upsert({
        where: { clerkId: data.id },
        create: {
          clerkId: data.id,
          email: email ?? '',
          name,
        },
        update: {
          email: email ?? '',
          name,
        },
      })
    } else if (type === 'user.updated') {
      await prisma.user.update({
        where: { clerkId: data.id },
        data: {
          email: email ?? '',
          name,
        },
      })
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Database error handling Clerk webhook:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
