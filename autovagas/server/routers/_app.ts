import { createTRPCRouter } from '@/server/trpc'
import { userRouter } from './user'
import { applicationRouter } from './application'
import { billingRouter } from './billing'

export const appRouter = createTRPCRouter({
  user: userRouter,
  application: applicationRouter,
  billing: billingRouter,
})

export type AppRouter = typeof appRouter
