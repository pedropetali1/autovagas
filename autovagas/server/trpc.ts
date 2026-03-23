import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import superjson from 'superjson'

export async function createTRPCContext() {
  const { userId: clerkId } = await auth()
  return { clerkId, prisma }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.clerkId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  const user = await ctx.prisma.user.findUnique({
    where: { clerkId: ctx.clerkId },
  })

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found in database' })
  }

  return next({ ctx: { ...ctx, user } })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
