import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  datasource: {
    // Migrations use the direct connection (not the pooler)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
})
