import { Worker, Queue, type Job } from 'bullmq'
import { chromium } from 'playwright-core'
import { prisma } from '@/lib/prisma'
import { ApplyType, LogAction } from '@prisma/client'

// ─── Queue definitions ────────────────────────────────────────────────────────

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export const scraperQueue = new Queue('scraper', { connection })
export const matchingQueue = new Queue('matching', { connection })

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScraperJobData {
  userId: string
}

interface LinkedInJobRaw {
  title: string
  company: string
  location?: string
  salary?: string
  description?: string
  linkedinUrl: string
  requirements: string[]
  remote: boolean
  easyApply: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Minimum gap between Playwright requests: 500ms → 2 req/s max */
const REQUEST_DELAY_MS = 500

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
]

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function parseProxyUrl(proxyUrl: string) {
  const url = new URL(proxyUrl)
  return {
    server: `${url.protocol}//${url.hostname}:${url.port}`,
    username: url.username,
    password: url.password,
  }
}

/** Detect captcha or IP-block page */
function isChallenged(url: string, status: number): boolean {
  if (status === 429) return true
  if (url.includes('linkedin.com/checkpoint')) return true
  if (url.includes('linkedin.com/authwall')) return true
  if (url.includes('/captcha')) return true
  return false
}

// ─── LinkedIn Guest API fallback ──────────────────────────────────────────────

async function fetchViaGuestApi(
  desiredRole: string,
  maxJobs: number,
): Promise<LinkedInJobRaw[]> {
  const params = new URLSearchParams({
    keywords: desiredRole,
    location: 'Brazil',
    start: '0',
    count: String(maxJobs),
  })
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': randomItem(USER_AGENTS),
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    })
  } catch (e) {
    console.warn(`[scraper:guest] fetch error: ${e}`)
    return []
  } finally {
    clearTimeout(timeout)
  }

  console.log(`[scraper:guest] status=${res.status} url=${url}`)
  if (!res.ok) {
    console.warn(`[scraper:guest] Non-OK response: ${res.status} ${res.statusText}`)
    return []
  }

  const html = await res.text()
  console.log(`[scraper:guest] HTML length=${html.length}, snippet=${html.slice(0, 300).replace(/\s+/g, ' ')}`)

  // Parse job cards — split on </li> so each block is one card
  const jobs: LinkedInJobRaw[] = []
  const blocks = html.split('</li>')

  const titleRegex = /class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)</
  const companyRegex = /class="[^"]*base-search-card__subtitle[^"]*"[\s\S]*?href[^>]*>([\s\S]*?)<\/a/
  const locationRegex = /class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)</
  // LinkedIn may use www or country-code subdomains (e.g. br.linkedin.com)
  const urlRegex = /href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"?]+)/

  for (const block of blocks) {
    if (jobs.length >= maxJobs) break
    if (!block.includes('base-search-card')) continue

    const urlMatch = urlRegex.exec(block)
    if (!urlMatch) continue
    const linkedinUrl = urlMatch[1]

    const title = titleRegex.exec(block)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''
    const company = companyRegex.exec(block)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''
    const location = locationRegex.exec(block)?.[1]?.replace(/<[^>]+>/g, '').trim()

    if (!title || !company) continue

    jobs.push({
      title,
      company,
      location,
      linkedinUrl,
      requirements: [],
      remote: false,
      easyApply: false,
    })
  }

  console.log(`[scraper:guest] Parsed ${jobs.length} jobs from ${blocks.length} blocks`)
  return jobs
}

// ─── Playwright scraper ───────────────────────────────────────────────────────

async function scrapeWithPlaywright(
  desiredRole: string,
  maxJobs: number,
  attempt: number = 0,
): Promise<LinkedInJobRaw[]> {
  const proxyUrl = process.env.PROXY_URL
  const proxyConfig = proxyUrl ? parseProxyUrl(proxyUrl) : undefined
  const viewport = randomItem(VIEWPORTS)
  const userAgent = randomItem(USER_AGENTS)

  const browser = await chromium.launch({
    headless: true,
    proxy: proxyConfig,
  })

  try {
    const context = await browser.newContext({
      userAgent,
      viewport,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    })

    const page = await context.newPage()

    // Rate-limit: respect ~2 req/s
    await delay(REQUEST_DELAY_MS)

    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(desiredRole)}&location=Brasil&f_WT=2%2C3&sortBy=R`
    const response = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const finalUrl = page.url()
    const status = response?.status() ?? 200

    if (isChallenged(finalUrl, status)) {
      throw new Error(`CHALLENGED:${status}`)
    }

    const jobs: LinkedInJobRaw[] = []

    // Extract job cards from the search results page
    const cards = await page.$$('li.jobs-search-results__list-item, li.job-search-card')

    for (const card of cards) {
      if (jobs.length >= maxJobs) break

      await delay(REQUEST_DELAY_MS)

      try {
        const linkedinUrl = await card
          .$eval('a[href*="/jobs/view/"]', (el) => (el as HTMLAnchorElement).href.split('?')[0])
          .catch(() => null)
        if (!linkedinUrl) continue

        const title = await card
          .$eval(
            'h3.base-search-card__title, h3.job-card-container__primary-description',
            (el) => el.textContent?.trim() ?? '',
          )
          .catch(() => '')
        const company = await card
          .$eval(
            'h4.base-search-card__subtitle a, h4.job-card-container__company-name',
            (el) => el.textContent?.trim() ?? '',
          )
          .catch(() => '')
        const location = await card
          .$eval('.job-search-card__location, .job-card-container__metadata-item', (el) =>
            el.textContent?.trim(),
          )
          .catch(() => undefined)

        if (!title || !company) continue

        // Check for Easy Apply badge
        const easyApply = await card
          .$('.job-card-container__apply-method, .jobs-apply-button--top-card')
          .then((el) => el !== null)
          .catch(() => false)

        jobs.push({
          title,
          company,
          location,
          linkedinUrl,
          requirements: [],
          remote: false,
          easyApply,
        })
      } catch {
        // Skip malformed card
      }
    }

    await context.close()
    return jobs
  } finally {
    await browser.close()
  }
}

// ─── Main scraper logic ───────────────────────────────────────────────────────

async function runScraper(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { skills: true },
  })

  if (!user) throw new Error(`User ${userId} not found`)
  if (!user.desiredRole) throw new Error(`User ${userId} has no desiredRole`)

  const maxJobs = user.dailyQuota * 3

  let jobs: LinkedInJobRaw[] = []
  let lastError: Error | null = null
  let backoffMs = 30_000 // 30s → 60s → 120s

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[scraper] attempt ${attempt + 1}, waiting ${backoffMs / 1000}s...`)
        await delay(backoffMs)
        backoffMs *= 2
      }
      jobs = await scrapeWithPlaywright(user.desiredRole, maxJobs, attempt)
      lastError = null
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message
      if (msg.startsWith('CHALLENGED:')) {
        console.warn(`[scraper] IP challenge detected (attempt ${attempt + 1}): ${msg}`)
        // Continue → retry with new proxy rotation (each attempt creates a new browser context)
      } else {
        throw lastError // Unexpected error — propagate
      }
    }
  }

  // Fallback to guest API if Playwright failed or returned 0 results (likely blocked)
  if (lastError || jobs.length === 0) {
    if (jobs.length === 0) {
      console.warn('[scraper] Playwright returned 0 jobs (likely blocked) — falling back to Guest API')
    } else {
      console.warn('[scraper] All Playwright attempts failed — falling back to Guest API')
    }
    jobs = await fetchViaGuestApi(user.desiredRole, maxJobs)
  }

  console.log(`[scraper] Collected ${jobs.length} jobs for user ${userId}`)

  // Upsert jobs and create SCRAPE logs
  const jobIds: string[] = []

  for (const raw of jobs) {
    const applyType = raw.easyApply ? ApplyType.EASY_APPLY : ApplyType.EXTERNAL

    const job = await prisma.job.upsert({
      where: { linkedinUrl: raw.linkedinUrl },
      update: {
        title: raw.title,
        company: raw.company,
        location: raw.location,
        salary: raw.salary ? parseFloat(raw.salary.replace(/[^0-9.]/g, '')) : undefined,
        description: raw.description,
        requirements: raw.requirements,
        remote: raw.remote,
        applyType,
      },
      create: {
        title: raw.title,
        company: raw.company,
        location: raw.location,
        salary: raw.salary ? parseFloat(raw.salary.replace(/[^0-9.]/g, '')) : undefined,
        description: raw.description,
        linkedinUrl: raw.linkedinUrl,
        requirements: raw.requirements,
        remote: raw.remote,
        applyType,
      },
    })

    jobIds.push(job.id)

    // Create Application record in PENDING status (skip if already exists)
    const application = await prisma.application.upsert({
      where: { userId_jobId: { userId, jobId: job.id } },
      update: {},
      create: {
        userId,
        jobId: job.id,
        status: 'PENDING',
      },
    })

    // Create SCRAPE log
    await prisma.applicationLog.create({
      data: {
        applicationId: application.id,
        action: LogAction.SCRAPE,
        detail: {
          title: raw.title,
          company: raw.company,
          linkedinUrl: raw.linkedinUrl,
        },
      },
    })
  }

  // Enqueue matching job
  if (jobIds.length > 0) {
    await matchingQueue.add('match', { userId, jobIds })
    console.log(`[scraper] Enqueued matching job for ${jobIds.length} jobs`)
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const scraperWorker = new Worker<ScraperJobData>(
  'scraper',
  async (job: Job<ScraperJobData>) => {
    const { userId } = job.data
    console.log(`[scraper] Processing job for user ${userId}`)
    await runScraper(userId)
    console.log(`[scraper] Done for user ${userId}`)
  },
  { connection, concurrency: 2 },
)

scraperWorker.on('failed', (job, err) => {
  console.error(`[scraper] Job ${job?.id} failed:`, err)
})
