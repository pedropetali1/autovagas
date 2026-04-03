import { Worker, Queue, type Job } from 'bullmq'
import { chromium } from 'playwright-core'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
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

// ─── Field heuristics ─────────────────────────────────────────────────────────

/**
 * Known patterns for each field type.
 * Returns the user value to fill if a match is found.
 */
const FIELD_PATTERNS: Array<{
  key: string
  patterns: RegExp[]
  required: boolean
}> = [
  {
    key: 'name',
    patterns: [/\bname\b/i, /\bnome\b/i, /full.?name/i, /nome.?completo/i],
    required: true,
  },
  {
    key: 'email',
    patterns: [/\bemail\b/i, /\be-?mail\b/i],
    required: true,
  },
  {
    key: 'phone',
    patterns: [/\bphone\b/i, /\btel\b/i, /\btelefone\b/i, /\bcelular\b/i, /\bmobile\b/i],
    required: false,
  },
  {
    key: 'resume',
    patterns: [/\bresume\b/i, /\bcv\b/i, /\bcurriculo\b/i, /\bcurrículo\b/i, /\battachment\b/i, /\bfile\b/i],
    required: false,
  },
]

interface DetectedField {
  key: string
  inputIndex: number
  isFile: boolean
}

/**
 * Scan the page for required/optional input fields and identify which ones
 * correspond to known patterns.
 * Returns { detected, totalRequired, mappedRequired }.
 */
async function detectFields(page: import('playwright-core').Page): Promise<{
  detected: DetectedField[]
  totalRequired: number
  mappedRequired: number
}> {
  // Collect all visible inputs (excluding hidden/submit/button/checkbox/radio)
  const inputs = page.locator(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="image"]), textarea',
  )
  const count = await inputs.count()

  const detected: DetectedField[] = []
  const matchedKeys = new Set<string>()

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i)
    const inputType = (await input.getAttribute('type')) ?? 'text'
    const nameAttr = (await input.getAttribute('name')) ?? ''
    const idAttr = (await input.getAttribute('id')) ?? ''
    const placeholderAttr = (await input.getAttribute('placeholder')) ?? ''
    const ariaLabel = (await input.getAttribute('aria-label')) ?? ''

    // Try to get associated label text
    let labelText = ''
    const inputId = idAttr
    if (inputId) {
      const label = page.locator(`label[for="${inputId}"]`)
      if ((await label.count()) > 0) {
        labelText = (await label.first().innerText()) ?? ''
      }
    }

    const haystack = [nameAttr, idAttr, placeholderAttr, ariaLabel, labelText]
      .join(' ')
      .toLowerCase()

    for (const field of FIELD_PATTERNS) {
      if (matchedKeys.has(field.key)) continue // already matched
      if (field.patterns.some((p) => p.test(haystack))) {
        detected.push({ key: field.key, inputIndex: i, isFile: inputType === 'file' })
        matchedKeys.add(field.key)
        break
      }
    }
  }

  // Additionally scan for file inputs by type
  const fileInputs = page.locator('input[type="file"]')
  const fileCount = await fileInputs.count()
  if (fileCount > 0 && !matchedKeys.has('resume')) {
    // Check if any file input wasn't already captured above
    for (let i = 0; i < fileCount; i++) {
      const fi = fileInputs.nth(i)
      const accept = (await fi.getAttribute('accept')) ?? ''
      if (accept.includes('pdf') || accept.includes('doc') || accept === '') {
        detected.push({ key: 'resume', inputIndex: -1, isFile: true })
        matchedKeys.add('resume')
        break
      }
    }
  }

  const totalRequired = FIELD_PATTERNS.filter((f) => f.required).length
  const mappedRequired = FIELD_PATTERNS.filter(
    (f) => f.required && matchedKeys.has(f.key),
  ).length

  return { detected, totalRequired, mappedRequired }
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
      try {
        await primaryBtn.first().click({ timeout: 10_000 })
      } catch {
        return { success: false, failReason: 'SUBMIT_BUTTON_NOT_FOUND' }
      }
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
      return { success: false, failReason: `TIMEOUT: ${message.slice(0, 200)}` }
    }

    // Treat navigation/challenge errors as CAPTCHA
    if (message.includes('CAPTCHA') || message.includes('captcha') || message.includes('checkpoint')) {
      return { success: false, failReason: 'CAPTCHA' }
    }

    // Re-throw unexpected errors with context
    throw new Error(`[applyEasyApply] applicationId=${applicationId} url=${jobUrl}: ${message}`)
  } finally {
    await browser.close()
  }
}

// ─── External form handler ────────────────────────────────────────────────────

async function applyExternal(
  applicationId: string,
  jobUrl: string,
  user: { name: string | null; email: string; phone: string | null; cvUrl: string | null },
): Promise<{ success: boolean; failReason?: string; mappedFields?: number; totalRequired?: number }> {
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

    // Navigate to LinkedIn job page — it will redirect to external form
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Check for captcha/challenge before redirect
    let currentUrl = page.url()
    if (
      currentUrl.includes('/checkpoint') ||
      currentUrl.includes('/authwall') ||
      currentUrl.includes('/captcha')
    ) {
      return { success: false, failReason: 'CAPTCHA' }
    }

    // Wait for potential external redirect (LinkedIn may redirect on button click)
    // Look for an "Apply" or "Apply on company site" button and click it
    const applyButton = page.locator(
      'a.jobs-apply-button[target="_blank"], a[href*="apply"]:not([href*="linkedin"]), button:has-text("Apply on company"), button:has-text("Candidatar no site")',
    )

    try {
      // If there's an explicit "apply on company site" link, open it
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 10_000 }).catch(() => null),
        applyButton.first().click({ timeout: 10_000 }).catch(() => null),
      ])

      if (newPage) {
        await newPage.waitForLoadState('domcontentloaded', { timeout: 30_000 })
        currentUrl = newPage.url()

        if (
          currentUrl.includes('/checkpoint') ||
          currentUrl.includes('/captcha') ||
          currentUrl.includes('/authwall')
        ) {
          return { success: false, failReason: 'CAPTCHA' }
        }

        // Work on the external page
        const detection = await detectFields(newPage)
        const { detected, totalRequired, mappedRequired } = detection
        const mappingRatio = totalRequired > 0 ? mappedRequired / totalRequired : 1

        console.log(
          `[apply] External form detection: mappedRequired=${mappedRequired}/${totalRequired} ratio=${mappingRatio.toFixed(2)} detected=${detected.length}`,
        )

        if (mappingRatio < 0.7) {
          return {
            success: false,
            failReason: 'FORM_NOT_SUPPORTED',
            mappedFields: mappedRequired,
            totalRequired,
          }
        }

        // Fill the detected fields
        const inputs = newPage.locator(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="image"]), textarea',
        )

        for (const field of detected) {
          if (field.isFile) {
            // Handle file input separately below
            continue
          }

          const input = inputs.nth(field.inputIndex)
          let value: string | null = null

          switch (field.key) {
            case 'name':
              value = user.name
              break
            case 'email':
              value = user.email
              break
            case 'phone':
              value = user.phone
              break
          }

          if (value) {
            try {
              await input.fill(value, { timeout: 5_000 })
            } catch {
              console.warn(`[apply] Failed to fill field '${field.key}' on external form`)
            }
          }
        }

        // Upload CV to file input if available
        if (user.cvUrl && detected.some((f) => f.key === 'resume')) {
          const fileInput = newPage.locator('input[type="file"]')
          if ((await fileInput.count()) > 0) {
            try {
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
              console.warn(`[apply] Failed to upload CV to external form for ${applicationId}:`, err)
            }
          }
        }

        // Take screenshot before submission
        const screenshotBuffer = await newPage.screenshot({ fullPage: false })
        const screenshotUrl = await uploadScreenshot(applicationId, screenshotBuffer)

        await prisma.applicationLog.create({
          data: {
            applicationId,
            action: LogAction.SCREENSHOT,
            screenshotUrl: screenshotUrl ?? undefined,
          },
        })

        // Submit the form
        const submitButton = newPage.locator(
          'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Enviar"), button:has-text("Apply"), button:has-text("Candidatar")',
        )

        try {
          await submitButton.first().click({ timeout: 10_000 })
        } catch {
          console.warn(`[apply] Could not find submit button on external form for ${applicationId} (url=${currentUrl})`)
          return { success: false, failReason: 'SUBMIT_BUTTON_NOT_FOUND' }
        }

        // Wait for submission confirmation
        await newPage.waitForTimeout(3_000)

        // Check for post-submit challenge
        const postSubmitUrl = newPage.url()
        if (
          postSubmitUrl.includes('/checkpoint') ||
          postSubmitUrl.includes('/captcha') ||
          postSubmitUrl.includes('/authwall')
        ) {
          return { success: false, failReason: 'CAPTCHA' }
        }

        await context.close()
        return { success: true }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Timeout') || message.includes('timeout')) {
        return { success: false, failReason: `TIMEOUT: ${message.slice(0, 200)}` }
      }
      throw err
    }

    // Fallback: no external page opened — treat as FORM_NOT_SUPPORTED
    return {
      success: false,
      failReason: 'FORM_NOT_SUPPORTED',
      mappedFields: 0,
      totalRequired: FIELD_PATTERNS.filter((f) => f.required).length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('Timeout') || message.includes('timeout')) {
      return { success: false, failReason: `TIMEOUT: ${message.slice(0, 200)}` }
    }

    if (
      message.includes('CAPTCHA') ||
      message.includes('captcha') ||
      message.includes('checkpoint')
    ) {
      return { success: false, failReason: 'CAPTCHA' }
    }

    throw new Error(`[applyExternal] applicationId=${applicationId} url=${jobUrl}: ${message}`)
  } finally {
    await browser.close()
  }
}

// ─── Main apply logic ─────────────────────────────────────────────────────────

async function runApply(applicationIds: string[]): Promise<void> {
  console.log(`[apply] Processing ${applicationIds.length} applications`)

  // Track pipeline stats for digest email
  let digestUser: {
    name: string | null
    email: string
    emailDigest: boolean
    emailOnFailed: boolean
  } | null = null
  let totalSent = 0
  let totalFailed = 0
  const failedApplications: Array<{ title: string; company: string; directUrl?: string | null }> = []

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

    // Capture user info for digest email (same user for all applications in a batch)
    if (!digestUser) {
      digestUser = {
        name: application.user.name,
        email: application.user.email,
        emailDigest: application.user.emailDigest,
        emailOnFailed: application.user.emailOnFailed,
      }
    }

    // Only handle EASY_APPLY and EXTERNAL; skip unknown types
    if (
      application.job.applyType !== ApplyType.EASY_APPLY &&
      application.job.applyType !== ApplyType.EXTERNAL
    ) {
      console.log(
        `[apply] Skipping application ${applicationId} (unsupported applyType=${application.job.applyType})`,
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

    // Perform apply based on type
    let result: { success: boolean; failReason?: string; mappedFields?: number; totalRequired?: number }

    const userPayload = {
      name: application.user.name,
      email: application.user.email,
      phone: application.user.phone,
      cvUrl: application.user.cvUrl,
    }

    try {
      if (application.job.applyType === ApplyType.EASY_APPLY) {
        result = await applyEasyApply(applicationId, application.job.linkedinUrl, userPayload)
      } else {
        result = await applyExternal(applicationId, application.job.linkedinUrl, userPayload)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isTimeout = msg.includes('Timeout') || msg.includes('timeout')
      const unexpectedFailReason = isTimeout ? 'TIMEOUT' : 'UNKNOWN_ERROR'
      console.error(`[apply] Unexpected error for ${applicationId} (${application.job.applyType}): ${msg}`)
      result = { success: false, failReason: unexpectedFailReason }

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.FAILED,
          failReason: unexpectedFailReason,
          errorLog: msg,
        },
      })

      await prisma.applicationLog.create({
        data: {
          applicationId,
          action: LogAction.SUBMIT,
          detail: { reason: unexpectedFailReason, error: msg },
        },
      })

      totalFailed++
      failedApplications.push({
        title: application.job.title,
        company: application.job.company,
        directUrl: null,
      })

      if (digestUser?.emailOnFailed) {
        void sendEmail({
          template: 'alerta-failed',
          to: digestUser.email,
          props: {
            userName: digestUser.name ?? digestUser.email,
            jobTitle: application.job.title,
            company: application.job.company,
            failReason: unexpectedFailReason,
            directUrl: null,
          },
        })
      }

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

      totalSent++
      console.log(`[apply] Successfully applied to ${applicationId}`)
    } else {
      const failReason = result.failReason ?? 'TIMEOUT'

      // For FORM_NOT_SUPPORTED, store directUrl so the user can apply manually
      const updateData: {
        status: ApplicationStatus
        failReason: string
        directUrl?: string
      } = {
        status: ApplicationStatus.FAILED,
        failReason,
      }

      if (failReason === 'FORM_NOT_SUPPORTED') {
        updateData.directUrl = application.job.linkedinUrl
      }

      await prisma.application.update({
        where: { id: applicationId },
        data: updateData,
      })

      const logDetail =
        failReason === 'FORM_NOT_SUPPORTED'
          ? {
              reason: failReason,
              mappedFields: result.mappedFields ?? 0,
              totalRequired: result.totalRequired ?? 0,
            }
          : { reason: failReason }

      await prisma.applicationLog.create({
        data: {
          applicationId,
          action: LogAction.SUBMIT,
          detail: logDetail,
        },
      })

      totalFailed++
      const directUrl =
        failReason === 'FORM_NOT_SUPPORTED' ? application.job.linkedinUrl : null
      failedApplications.push({
        title: application.job.title,
        company: application.job.company,
        directUrl,
      })

      // Send alerta-failed email immediately (fire-and-forget)
      if (digestUser?.emailOnFailed) {
        void sendEmail({
          template: 'alerta-failed',
          to: digestUser.email,
          props: {
            userName: digestUser.name ?? digestUser.email,
            jobTitle: application.job.title,
            company: application.job.company,
            failReason,
            directUrl,
          },
        })
      }

      console.warn(`[apply] Failed to apply to ${applicationId}: ${failReason}`)
    }
  }

  // Send daily digest email after all applications are processed
  if (digestUser?.emailDigest && applicationIds.length > 0) {
    void sendEmail({
      template: 'resumo-diario',
      to: digestUser.email,
      props: {
        userName: digestUser.name ?? digestUser.email,
        totalAnalyzed: applicationIds.length,
        totalSent,
        totalFailed,
        failedApplications,
      },
    })
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
  const applicationIds = (job?.data as ApplyJobData | undefined)?.applicationIds ?? []
  console.error(
    `[apply] Job ${job?.id} failed (applicationIds=[${applicationIds.join(', ')}]): ${err.message}`,
    err,
  )
})
