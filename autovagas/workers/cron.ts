import { Worker, Queue, type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { getCurrentBRTTime } from '@/lib/timezone'
import { scraperQueue } from './scraper'

// ─── Queue definitions ────────────────────────────────────────────────────────

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export const cronQueue = new Queue('cron', { connection })

// ─── Repeatable job setup ─────────────────────────────────────────────────────

// '0 11 * * *' UTC = 08:00 BRT (America/Sao_Paulo is UTC-3)
export async function setupCronJob(): Promise<void> {
  await cronQueue.add(
    'daily-pipeline',
    {},
    {
      repeat: {
        pattern: '0 11 * * *',
      },
      jobId: 'daily-pipeline',
    },
  )
  console.log('[cron] Repeatable job scheduled: 0 11 * * * UTC (08:00 BRT)')
}

// ─── Main cron logic ──────────────────────────────────────────────────────────

interface CronStats {
  processed: number
  skipped: number
  reasons: Record<string, number>
}

async function runDailyPipeline(): Promise<CronStats> {
  const stats: CronStats = { processed: 0, skipped: 0, reasons: {} }

  // 1. Find all users with at least 3 skills, a CV, and automation not paused
  const eligibleUsers = await prisma.user.findMany({
    where: {
      cvUrl: { not: null },
      automationPaused: false,
    },
    include: {
      _count: {
        select: { skills: true },
      },
    },
  })

  // 2. Filter to users with >= 3 skills
  const usersWithProfile = eligibleUsers.filter((u) => u._count.skills >= 3)

  // Track skipped users that were excluded by incomplete_profile
  const incompleteProfileSkipped = eligibleUsers.length - usersWithProfile.length
  if (incompleteProfileSkipped > 0) {
    stats.skipped += incompleteProfileSkipped
    stats.reasons['incomplete_profile'] = (stats.reasons['incomplete_profile'] ?? 0) + incompleteProfileSkipped
  }

  // 3. Compute "today 00:00 BRT" as UTC using centralized helper
  const { todayStartUTC: todayBrtStart } = getCurrentBRTTime()

  // 4. For each eligible user, check quota and enqueue scraper
  for (const user of usersWithProfile) {
    const todayApplicationCount = await prisma.application.count({
      where: {
        userId: user.id,
        createdAt: { gte: todayBrtStart },
      },
    })

    if (todayApplicationCount >= user.dailyQuota) {
      stats.skipped++
      stats.reasons['quota_reached'] = (stats.reasons['quota_reached'] ?? 0) + 1
      console.log(`[cron] Skipping user ${user.id}: quota_reached (${todayApplicationCount}/${user.dailyQuota})`)
      continue
    }

    await scraperQueue.add('scrape', { userId: user.id })
    stats.processed++
    console.log(`[cron] Enqueued scraper for user ${user.id}`)
  }

  return stats
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const cronWorker = new Worker(
  'cron',
  async (_job: Job) => {
    console.log('[cron] Daily pipeline triggered')
    const stats = await runDailyPipeline()
    console.log('[cron] Daily pipeline complete:', JSON.stringify(stats))
    return stats
  },
  { connection, concurrency: 1 },
)

cronWorker.on('failed', (job, err) => {
  console.error(`[cron] Job ${job?.id} (name=${job?.name ?? 'unknown'}) failed: ${err.message}`, err)
})
