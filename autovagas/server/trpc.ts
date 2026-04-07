import { initTRPC, TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import superjson from 'superjson'

export async function createTRPCContext() {
  const supabase = await createSupabaseServerClient()
  // getSession() decodes the JWT locally (no network round-trip).
  // The session has already been validated by proxy.ts for every protected route.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return { supabaseUser: session?.user ?? null, prisma }
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

  // Try to find by supabaseId first, then fall back to email.
  // The email fallback handles the case where a user deleted and re-created their
  // Supabase account (same email, new UUID) — we relink instead of creating a duplicate.
  let user = await ctx.prisma.user.findFirst({
    where: {
      OR: [
        { supabaseId: ctx.supabaseUser.id },
        { email: ctx.supabaseUser.email! },
      ],
    },
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
  } else if (user.supabaseId !== ctx.supabaseUser.id) {
    // Relink existing profile to new Supabase UUID
    user = await ctx.prisma.user.update({
      where: { id: user.id },
      data: { supabaseId: ctx.supabaseUser.id },
    })
  }

  return next({ ctx: { ...ctx, user } })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
