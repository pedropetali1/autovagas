import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'
import { ApplicationStatus, Plan } from '@prisma/client'
import { sendEmail } from '@/lib/email'
import { scraperQueue, matchingQueue, applyQueue } from '@/lib/queues'
import { getCurrentBRTTime } from '@/lib/timezone'

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
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    }),

  getPipelineStatus: protectedProcedure.query(async () => {
    const [scraperCounts, matchingCounts, applyCounts] = await Promise.all([
      scraperQueue.getJobCounts('active', 'waiting', 'failed', 'completed'),
      matchingQueue.getJobCounts('active', 'waiting', 'failed', 'completed'),
      applyQueue.getJobCounts('active', 'waiting', 'failed', 'completed'),
    ])
    return { scraper: scraperCounts, matching: matchingCounts, apply: applyCounts }
  }),

  triggerPipeline: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: { _count: { select: { skills: true } } },
    })

    if (!user) throw new TRPCError({ code: 'NOT_FOUND' })
    if (!user.desiredRole) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Preencha o cargo desejado no perfil.' })
    if (!user.cvUrl) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Faça o upload do seu CV no perfil.' })
    if (user._count.skills < 3) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cadastre pelo menos 3 skills no perfil.' })

    // Free plan: 1 pipeline run per day
    if (user.plan === Plan.FREE) {
      const { todayStartUTC } = getCurrentBRTTime()
      if (user.lastPipelineRunAt && user.lastPipelineRunAt >= todayStartUTC) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'PIPELINE_LIMIT_REACHED' })
      }
    }

    await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { lastPipelineRunAt: new Date() },
    })

    await scraperQueue.add('scrape', { userId: ctx.user.id })
    return { queued: true }
  }),

  applySelected: protectedProcedure
    .input(z.object({ applicationIds: z.array(z.string()).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const apps = await ctx.prisma.application.findMany({
        where: {
          id: { in: input.applicationIds },
          userId: ctx.user.id,
          status: ApplicationStatus.PENDING,
        },
        select: { id: true },
      })

      if (apps.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhuma candidatura válida selecionada.' })
      }

      const validIds = apps.map((a) => a.id)
      await applyQueue.add('apply', { applicationIds: validIds })
      return { queued: true, count: validIds.length }
    }),

  markViewed: protectedProcedure
    .input(z.object({ applicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.applicationId },
        select: { userId: true, job: { select: { title: true, company: true } } },
      })

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' })
      }

      if (application.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      await ctx.prisma.application.update({
        where: { id: input.applicationId },
        data: { status: ApplicationStatus.VIEWED },
      })

      // Send alerta-viewed email (fire-and-forget)
      if (ctx.user.emailOnViewed) {
        void sendEmail({
          template: 'alerta-viewed',
          to: ctx.user.email,
          props: {
            userName: ctx.user.name ?? ctx.user.email,
            jobTitle: application.job.title,
            company: application.job.company,
          },
        })
      }

      return { success: true }
    }),
})
