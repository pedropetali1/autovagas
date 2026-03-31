import { Queue } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export const scraperQueue = new Queue('scraper', { connection })
export const matchingQueue = new Queue('matching', { connection })
export const applyQueue = new Queue('apply', { connection })
