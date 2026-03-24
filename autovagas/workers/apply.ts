import { Worker, Queue, type Job } from 'bullmq'
import { chromium } from 'playwright-core'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { ApplyType, ApplicationStatus, LogAction } from '@prisma/client'

// ─── Queue definitions ────────────────────────────────────────────────────────

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export const applyQueue = new Queue('apply', { connection })

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplyJobData {
  applicationIds: string[]
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Screenshot upload ────────────────────────────────────────────────────────

async function uploadScreenshot(
  applicationId: string,
  screenshotBuffer: Buffer,
): Promise<string | null> {
  const path = `screenshots/${applicationId}/final.png`

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, screenshotBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) {
    console.error(`[apply] Failed to upload screenshot for ${applicationId}:`, error)
    return null
  }

  const { data } = supabase.storage.from('screenshots').getPublicUrl(path)
  return data.publicUrl
}

// ─── Easy Apply handler ───────────────────────────────────────────────────────

async function applyEasyApply(
  applicationId: string,
  jobUrl: string,
  user: { name: string | null; email: string; phone: string | null; cvUrl: string | null },
): Promise<{ success: boolean; failReason?: string }> {
  const proxyUrl = process.env.PROXY_URL
  let proxyConfig: { server: string; username: string; password: string } | undefined

  if (proxyUrl) {
    const url = new URL(proxyUrl)
    proxyConfig = {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username,
      password: url.password,
    }
  }

  const browser = await chromium.launch({
    headless: true,
    proxy: proxyConfig,
  })

  try {
    const context = await browser.newContext({
      userAgent: randomItem(USER_AGENTS),
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    })

    const page = await context.newPage()

    // Navigate to job page with 60s overall timeout
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Check for captcha/challenge
    const finalUrl = page.url()
    if (
      finalUrl.includes('/checkpoint') ||
      finalUrl.includes('/authwall') ||
      finalUrl.includes('/captcha')
    ) {
      return { success: false, failReason: 'CAPTCHA' }
    }

    // Click the Easy Apply button
    const easyApplyButton = page.locator(
      'button.jobs-apply-button, button[aria-label*="Candidatar-se fácil"], button[aria-label*="Easy Apply"]',
    )

    try {
      await easyApplyButton.first().click({ timeout: 15_000 })
    } catch {
      // Try alternate selectors
      const altButton = page.locator('button:has-text("Candidatar-se fácil"), button:has-text("Easy Apply")')
      await altButton.first().click({ timeout: 10_000 })
    }

    // Wait for the modal to appear
    const modal = page.locator(
      'div[aria-labelledby*="jobs-apply"], div.jobs-easy-apply-modal, div[data-test-modal]',
    )
    await modal.first().waitFor({ state: 'visible', timeout: 15_000 })

    // Fill name field
    if (user.name) {
      const nameInput = page.locator('input[name="name"], input[id*="name"], input[aria-label*="ome"]')
      const nameCount = await nameInput.count()
      if (nameCount > 0) {
        await nameInput.first().fill(user.name, { timeout: 5_000 })
      }
    }

    // Fill email field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id*="email"]')
    const emailCount = await emailInput.count()
    if (emailCount > 0) {
      await emailInput.first().fill(user.email, { timeout: 5_000 })
    }

    // Fill phone field
    if (user.phone) {
      const phoneInput = page.locator(
        'input[type="tel"], input[name="phone"], input[id*="phone"], input[aria-label*="elefone"]',
      )
      const phoneCount = await phoneInput.count()
      if (phoneCount > 0) {
        await phoneInput.first().fill(user.phone, { timeout: 5_000 })
      }
    }

    // Upload CV if available
    if (user.cvUrl) {
      const fileInput = page.locator('input[type="file"][accept*="pdf"], input[type="file"]')
      const fileCount = await fileInput.count()
      if (fileCount > 0) {
        try {
          // Download CV from the public URL
          const cvRes = await fetch(user.cvUrl)
          if (cvRes.ok) {
            const cvBuffer = Buffer.from(await cvRes.arrayBuffer())
            await fileInput.first().setInputFiles({
              name: 'cv.pdf',
              mimeType: 'application/pdf',
              buffer: cvBuffer,
            })
          }
        } catch (err) {
          console.warn(`[apply] Failed to upload CV for application ${applicationId}:`, err)
        }
      }
    }

    // Take screenshot of filled form
    const screenshotBuffer = await page.screenshot({ fullPage: false })
    const screenshotUrl = await uploadScreenshot(applicationId, screenshotBuffer)

    // Log SCREENSHOT action
    await prisma.applicationLog.create({
      data: {
        applicationId,
        action: LogAction.SCREENSHOT,
        screenshotUrl: screenshotUrl ?? undefined,
      },
    })

    // Submit: click Submit / Next / Enviar button
    const submitButton = page.locator(
      'button[aria-label*="Enviar candidatura"], button[aria-label*="Submit"], button:has-text("Enviar"), button:has-text("Submit")',
    )

    try {
      await submitButton.first().click({ timeout: 10_000 })
    } catch {
      // Try generic primary button
      const primaryBtn = page.locator('footer button[data-easy-apply-next-button], footer button.artdeco-button--primary')
      await primaryBtn.first().click({ timeout: 10_000 })
    }

    // Wait for confirmation (success toast or modal close)
    await page.waitForTimeout(2_000)

    // Check if we got challenged after submission
    const postSubmitUrl = page.url()
    if (
      postSubmitUrl.includes('/checkpoint') ||
      postSubmitUrl.includes('/captcha') ||
      postSubmitUrl.includes('/authwall')
    ) {
      return { success: false, failReason: 'CAPTCHA' }
    }

    await context.close()
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('Timeout') || message.includes('timeout')) {
      return { success: false, failReason: 'TIMEOUT' }
    }

    // Treat navigation/challenge errors as CAPTCHA
    if (message.includes('CAPTCHA') || message.includes('captcha') || message.includes('checkpoint')) {
      return { success: false, failReason: 'CAPTCHA' }
    }

    // Re-throw unexpected errors
    throw err
  } finally {
    await browser.close()
  }
}

// ─── Main apply logic ─────────────────────────────────────────────────────────

async function runApply(applicationIds: string[]): Promise<void> {
  console.log(`[apply] Processing ${applicationIds.length} applications`)

  for (const applicationId of applicationIds) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        user: true,
      },
    })

    if (!application) {
      console.warn(`[apply] Application ${applicationId} not found — skipping`)
      continue
    }

    // US-017 only handles EASY_APPLY; EXTERNAL is handled by US-018
    if (application.job.applyType !== ApplyType.EASY_APPLY) {
      console.log(
        `[apply] Skipping application ${applicationId} (applyType=${application.job.applyType})`,
      )
      continue
    }

    // Skip applications that are already past PENDING/APPLYING state
    if (
      application.status === ApplicationStatus.SENT ||
      application.status === ApplicationStatus.FAILED
    ) {
      console.log(`[apply] Skipping already-settled application ${applicationId} (${application.status})`)
      continue
    }

    console.log(
      `[apply] Applying to "${application.job.title}" at ${application.job.company} (${applicationId})`,
    )

    // Set status → APPLYING and log FILL_FORM
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.APPLYING },
    })

    await prisma.applicationLog.create({
      data: {
        applicationId,
        action: LogAction.FILL_FORM,
        detail: {
          jobTitle: application.job.title,
          company: application.job.company,
        },
      },
    })

    // Perform Easy Apply
    let result: { success: boolean; failReason?: string }

    try {
      result = await applyEasyApply(applicationId, application.job.linkedinUrl, {
        name: application.user.name,
        email: application.user.email,
        phone: application.user.phone,
        cvUrl: application.user.cvUrl,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[apply] Unexpected error for ${applicationId}:`, err)
      result = { success: false, failReason: 'TIMEOUT' }

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.FAILED,
          failReason: 'TIMEOUT',
          errorLog: msg,
        },
      })

      await prisma.applicationLog.create({
        data: {
          applicationId,
          action: LogAction.SUBMIT,
          detail: { reason: 'TIMEOUT', error: msg },
        },
      })

      continue
    }

    if (result.success) {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.SENT,
          appliedAt: new Date(),
        },
      })

      await prisma.applicationLog.create({
        data: {
          applicationId,
          action: LogAction.SUBMIT,
          detail: { result: 'success' },
        },
      })

      console.log(`[apply] Successfully applied to ${applicationId}`)
    } else {
      const failReason = result.failReason ?? 'TIMEOUT'

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.FAILED,
          failReason,
        },
      })

      await prisma.applicationLog.create({
        data: {
          applicationId,
          action: LogAction.SUBMIT,
          detail: { reason: failReason },
        },
      })

      console.warn(`[apply] Failed to apply to ${applicationId}: ${failReason}`)
    }
  }

  console.log(`[apply] Finished processing ${applicationIds.length} applications`)
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const applyWorker = new Worker<ApplyJobData>(
  'apply',
  async (job: Job<ApplyJobData>) => {
    const { applicationIds } = job.data
    console.log(`[apply] Worker received ${applicationIds.length} applicationIds`)
    await runApply(applicationIds)
    console.log(`[apply] Worker done`)
  },
  { connection, concurrency: 1 }, // Sequential to avoid overwhelming LinkedIn
)

applyWorker.on('failed', (job, err) => {
  console.error(`[apply] Job ${job?.id} failed:`, err)
})
