import { Worker, Queue, type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { ApplicationStatus, LogAction } from '@prisma/client'

// ─── Queue definitions ────────────────────────────────────────────────────────

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export const applyQueue = new Queue('apply', { connection })

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchingJobData {
  userId: string
  jobIds: string[]
}

// ─── Main matching logic ──────────────────────────────────────────────────────

async function runMatching(userId: string, jobIds: string[]): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { skills: true },
  })

  if (!user) throw new Error(`User ${userId} not found`)

  const userSkills = user.skills.map((s) => s.name.toLowerCase())
  const excludeCompanies = user.excludeCompanies.map((c) => c.toLowerCase())

  // Load jobs for this batch
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
  })

  console.log(`[matching] Evaluating ${jobs.length} jobs for user ${userId}`)

  interface ScoredJob {
    jobId: string
    applicationId: string
    score: number
    skillsMatched: string[]
    skillsMissed: string[]
  }

  const scored: ScoredJob[] = []

  for (const job of jobs) {
    // 1. Exclude companies (case-insensitive)
    if (excludeCompanies.includes(job.company.toLowerCase())) {
      console.log(`[matching] Skipping excluded company: ${job.company}`)
      continue
    }

    // 2. Exclude jobs below minSalary (only when salary is present and minSalary is set)
    if (user.minSalary !== null && job.salary !== null && job.salary !== undefined) {
      if (job.salary < user.minSalary) {
        console.log(`[matching] Skipping low-salary job: ${job.title} (${job.salary} < ${user.minSalary})`)
        continue
      }
    }

    // 3. Calculate matchScore
    const requirements = job.requirements.map((r) => r.toLowerCase())
    let matchScore: number

    if (requirements.length === 0) {
      // No requirements listed — treat as perfect match opportunity (100%)
      matchScore = 100
    } else {
      const skillsMatched = userSkills.filter((skill) =>
        requirements.some((req) => req.includes(skill) || skill.includes(req)),
      )
      matchScore = (skillsMatched.length / requirements.length) * 100
    }

    // 4. Filter out jobs with matchScore < 40
    if (matchScore < 40) {
      console.log(`[matching] Skipping low-score job: ${job.title} (score: ${matchScore.toFixed(1)})`)
      continue
    }

    // Upsert Application record (skip if already applied / in progress)
    const application = await prisma.application.upsert({
      where: { userId_jobId: { userId, jobId: job.id } },
      update: { matchScore },
      create: {
        userId,
        jobId: job.id,
        status: 'PENDING',
        matchScore,
      },
    })

    const requirements2 = job.requirements.map((r) => r.toLowerCase())
    const skillsMatched = userSkills.filter((skill) =>
      requirements2.some((req) => req.includes(skill) || skill.includes(req)),
    )
    const skillsMissed = requirements2.filter(
      (req) => !userSkills.some((skill) => req.includes(skill) || skill.includes(req)),
    )

    scored.push({
      jobId: job.id,
      applicationId: application.id,
      score: matchScore,
      skillsMatched,
      skillsMissed,
    })
  }

  // 5. Sort by matchScore descending, select top N = dailyQuota
  scored.sort((a, b) => b.score - a.score)
  const selected = scored.slice(0, user.dailyQuota)

  console.log(`[matching] Selected ${selected.length} of ${scored.length} qualifying jobs`)

  // 6. Create MATCH ApplicationLog for each evaluated job (all that passed filters)
  for (const item of scored) {
    await prisma.applicationLog.create({
      data: {
        applicationId: item.applicationId,
        action: LogAction.MATCH,
        detail: {
          score: item.score,
          skillsMatched: item.skillsMatched,
          skillsMissed: item.skillsMissed,
        },
      },
    })
  }

  // 7. Mark non-selected applications as SKIPPED
  const selectedIds = new Set(selected.map((s) => s.applicationId))
  const skippedIds = scored
    .map((s) => s.applicationId)
    .filter((id) => !selectedIds.has(id))

  if (skippedIds.length > 0) {
    await prisma.application.updateMany({
      where: { id: { in: skippedIds } },
      data: { status: ApplicationStatus.SKIPPED },
    })
    console.log(`[matching] Marked ${skippedIds.length} applications as SKIPPED (dailyQuota=${user.dailyQuota})`)
  }

  // 8. Enqueue apply job with selected applicationIds
  const applicationIds = selected.map((s) => s.applicationId)

  if (applicationIds.length > 0) {
    await applyQueue.add('apply', { applicationIds })
    console.log(`[matching] Enqueued apply job for ${applicationIds.length} applications`)
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const matchingWorker = new Worker<MatchingJobData>(
  'matching',
  async (job: Job<MatchingJobData>) => {
    const { userId, jobIds } = job.data
    console.log(`[matching] Processing job for user ${userId}, ${jobIds.length} jobs`)
    await runMatching(userId, jobIds)
    console.log(`[matching] Done for user ${userId}`)
  },
  { connection, concurrency: 4 },
)

matchingWorker.on('failed', (job, err) => {
  console.error(`[matching] Job ${job?.id} failed:`, err)
})
