import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'
import { supabase } from '@/lib/supabase'

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      include: { skills: true },
    })
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        zipCode: z.string().optional(),
        linkedinUrl: z.string().optional(),
        desiredRole: z.string().optional(),
        minSalary: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: input,
      })
    }),

  addSkill: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.skill.upsert({
        where: { name_userId: { name: input.name, userId: ctx.user.id } },
        create: { name: input.name, userId: ctx.user.id },
        update: {},
      })
      return ctx.prisma.skill.findMany({ where: { userId: ctx.user.id } })
    }),

  removeSkill: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.skill.deleteMany({
        where: { id: input.id, userId: ctx.user.id },
      })
      return ctx.prisma.skill.findMany({ where: { userId: ctx.user.id } })
    }),

  updateNotificationPrefs: protectedProcedure
    .input(
      z.object({
        emailDigest: z.boolean(),
        emailOnViewed: z.boolean(),
        emailOnFailed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: input,
      })
    }),

  toggleAutomation: protectedProcedure.mutation(async ({ ctx }) => {
    const updated = await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { automationPaused: !ctx.user.automationPaused },
    })
    return updated.automationPaused
  }),

  addExcludeCompany: protectedProcedure
    .input(z.object({ company: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const current = ctx.user.excludeCompanies
      if (current.includes(input.company)) return current
      const updated = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { excludeCompanies: { push: input.company } },
      })
      return updated.excludeCompanies
    }),

  removeExcludeCompany: protectedProcedure
    .input(z.object({ company: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const filtered = ctx.user.excludeCompanies.filter((c) => c !== input.company)
      const updated = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { excludeCompanies: { set: filtered } },
      })
      return updated.excludeCompanies
    }),

  getUploadUrl: protectedProcedure.mutation(async ({ ctx }) => {
    const path = `${ctx.user.id}/cv.pdf`
    const { data, error } = await supabase.storage
      .from('cvs')
      .createSignedUploadUrl(path, { upsert: true })
    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    }
    return { signedUrl: data.signedUrl, token: data.token, path: data.path }
  }),

  confirmCvUpload: protectedProcedure.mutation(async ({ ctx }) => {
    const path = `${ctx.user.id}/cv.pdf`
    const { data } = supabase.storage.from('cvs').getPublicUrl(path)
    const updated = await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { cvUrl: data.publicUrl },
    })
    return { cvUrl: updated.cvUrl }
  }),
})
