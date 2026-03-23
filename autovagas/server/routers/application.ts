import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'
import { ApplicationStatus } from '@prisma/client'

export const applicationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(ApplicationStatus).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, cursor, limit } = input

      const items = await ctx.prisma.application.findMany({
        where: {
          userId: ctx.user.id,
          ...(status ? { status } : {}),
        },
        include: {
          job: {
            select: {
              title: true,
              company: true,
              location: true,
              salary: true,
              applyType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })

      let nextCursor: string | undefined
      if (items.length > limit) {
        const nextItem = items.pop()
        nextCursor = nextItem!.id
      }

      return { items, nextCursor }
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [aggregate, sentCount, failedCount, viewedCount, todayCount] = await Promise.all([
      ctx.prisma.application.aggregate({
        where: { userId: ctx.user.id },
        _count: { id: true },
        _avg: { matchScore: true },
      }),
      ctx.prisma.application.count({
        where: { userId: ctx.user.id, status: 'SENT' },
      }),
      ctx.prisma.application.count({
        where: { userId: ctx.user.id, status: 'FAILED' },
      }),
      ctx.prisma.application.count({
        where: { userId: ctx.user.id, status: 'VIEWED' },
      }),
      ctx.prisma.application.count({
        where: { userId: ctx.user.id, createdAt: { gte: todayStart } },
      }),
    ])

    return {
      total: aggregate._count.id,
      sent: sentCount,
      failed: failedCount,
      avgScore: aggregate._avg.matchScore ?? 0,
      viewedCount,
      todayCount,
    }
  }),

  getTimeline: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.application.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        status: true,
        matchScore: true,
        appliedAt: true,
        job: {
          select: {
            title: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
  }),

  getLogs: protectedProcedure
    .input(z.object({ applicationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.applicationId },
        select: { userId: true },
      })

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' })
      }

      if (application.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      return ctx.prisma.applicationLog.findMany({
        where: { applicationId: input.applicationId },
        orderBy: { createdAt: 'asc' },
      })
    }),
})
