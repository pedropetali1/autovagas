import { initTRPC, TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import superjson from 'superjson'

export async function createTRPCContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()
  return { supabaseUser, prisma }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.supabaseUser) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  let user = await ctx.prisma.user.findUnique({
    where: { supabaseId: ctx.supabaseUser.id },
  })

  if (!user) {
    user = await ctx.prisma.user.create({
      data: {
        supabaseId: ctx.supabaseUser.id,
        email: ctx.supabaseUser.email!,
        name:
          (ctx.supabaseUser.user_metadata?.name as string | undefined) ||
          ctx.supabaseUser.email!.split('@')[0],
      },
    })
  }

  return next({ ctx: { ...ctx, user } })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
