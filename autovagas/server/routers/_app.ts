import { createTRPCRouter } from '@/server/trpc'
import { userRouter } from './user'
import { applicationRouter } from './application'

export const appRouter = createTRPCRouter({
  user: userRouter,
  application: applicationRouter,
})

export type AppRouter = typeof appRouter
