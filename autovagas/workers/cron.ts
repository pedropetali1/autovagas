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

export async function setupCronJob(): Promise<void> {
  // Remove old fixed daily job before registering the new hourly one
  await cronQueue.removeRepeatable('daily-pipeline', { pattern: '0 11 * * *' })

  await cronQueue.add(
    'hourly-pipeline',
    {},
    {
      repeat: {
        pattern: '0 * * * *',
      },
      jobId: 'hourly-pipeline',
    },
  )
  console.log('[cron] Repeatable job scheduled: 0 * * * * (every hour)')
}

// ─── Main cron logic ──────────────────────────────────────────────────────────

interface CronStats {
  processed: number
  skipped: number
  reasons: Record<string, number>
}

async function runHourlyPipeline(): Promise<CronStats> {
  const stats: CronStats = { processed: 0, skipped: 0, reasons: {} }

  // 1. Get current BRT time to match against user schedules
  const { hourStr, dayOfWeek, todayStartUTC: todayBrtStart } = getCurrentBRTTime()

  // 2. Find eligible users whose schedule matches the current hour and day
  const eligibleUsers = await prisma.user.findMany({
    where: {
      cvUrl: { not: null },
      automationPaused: false,
      scheduleTime: hourStr,
    },
    include: {
      _count: {
        select: { skills: true },
      },
    },
  })

  // 3. Filter by day of week (scheduleDays must contain current BRT dayOfWeek) and skills >= 3
  const usersWithProfile = eligibleUsers.filter(
    (u) => u._count.skills >= 3 && u.scheduleDays.includes(dayOfWeek),
  )

  // Track skipped users excluded by incomplete_profile or wrong day
  const incompleteProfileSkipped = eligibleUsers.length - usersWithProfile.length
  if (incompleteProfileSkipped > 0) {
    stats.skipped += incompleteProfileSkipped
    stats.reasons['incomplete_profile'] = (stats.reasons['incomplete_profile'] ?? 0) + incompleteProfileSkipped
  }

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
    const { hourStr, dayOfWeek } = getCurrentBRTTime()
    console.log(`[cron] Hourly pipeline triggered at ${hourStr} BRT (day ${dayOfWeek})`)
    const stats = await runHourlyPipeline()
    console.log('[cron] Hourly pipeline complete:', JSON.stringify(stats))
    return stats
  },
  { connection, concurrency: 1 },
)

cronWorker.on('failed', (job, err) => {
  console.error(`[cron] Job ${job?.id} (name=${job?.name ?? 'unknown'}) failed: ${err.message}`, err)
})
