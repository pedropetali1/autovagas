/**
 * Worker entry point — starts all BullMQ workers and registers the daily cron.
 * Run with: npm run workers
 */

import { scraperWorker } from './scraper'
import { matchingWorker } from './matching'
import { applyWorker } from './apply'
import { cronWorker, setupCronJob } from './cron'

async function main() {
  console.log('[workers] Starting all workers...')

  // Register repeatable daily cron job (idempotent — safe to call on every restart)
  await setupCronJob()

  // Workers are already instantiated by importing the modules above.
  // Log a summary so it's clear they're running.
  console.log('[workers] scraper worker  — ready (concurrency=2)')
  console.log('[workers] matching worker — ready (concurrency=4)')
  console.log('[workers] apply worker    — ready (concurrency=1)')
  console.log('[workers] cron worker     — ready (concurrency=1)')
  console.log('[workers] All workers running. Press Ctrl+C to stop.')

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('[workers] Shutting down gracefully...')
    await Promise.all([
      scraperWorker.close(),
      matchingWorker.close(),
      applyWorker.close(),
      cronWorker.close(),
    ])
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[workers] Fatal error during startup:', err)
  process.exit(1)
})
