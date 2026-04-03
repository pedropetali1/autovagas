/**
 * Promotes an existing user to admin/PRO with unrestricted limits.
 *
 * Usage:
 *   npx tsx scripts/promote-admin.ts <email>
 *
 * Example:
 *   npx tsx scripts/promote-admin.ts admin@example.com
 *
 * The user must have signed up via the platform first.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx tsx scripts/promote-admin.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    console.error(`User not found: ${email}`)
    console.error('Make sure the user has signed up via the platform first.')
    process.exit(1)
  }

  await prisma.user.update({
    where: { email },
    data: {
      plan: 'PRO',
      dailyQuota: 9999,
      automationPaused: false,
      lastPipelineRunAt: null, // Reset any run limit
    },
  })

  console.log(`✓ User ${email} promoted to PRO (dailyQuota=9999, no run limits)`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
