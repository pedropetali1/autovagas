/**
 * Worker entry point — starts all BullMQ workers.
 * The pipeline is triggered manually by the user via the dashboard.
 * Run with: npm run workers
 */

import { scraperWorker } from './scraper'
import { matchingWorker } from './matching'
import { applyWorker } from './apply'

async function main() {
  console.log('[workers] Starting all workers...')

  // Workers are already instantiated by importing the modules above.
  console.log('[workers] scraper worker  — ready (concurrency=2)')
  console.log('[workers] matching worker — ready (concurrency=4)')
  console.log('[workers] apply worker    — ready (concurrency=1)')
  console.log('[workers] All workers running. Press Ctrl+C to stop.')

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('[workers] Shutting down gracefully...')
    await Promise.all([
      scraperWorker.close(),
      matchingWorker.close(),
      applyWorker.close(),
    ])
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[workers] Fatal error during startup:', err)
  process.exit(1)
})
