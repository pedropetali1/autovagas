/**
 * BRT (Brasília Time) is UTC-3.
 * Returns current BRT time components needed for scheduling logic.
 */
export function getCurrentBRTTime(): {
  hourStr: string
  dayOfWeek: number
  todayStartUTC: Date
} {
  const now = new Date()

  // BRT offset: UTC-3 (180 minutes)
  const brtOffsetMs = -3 * 60 * 60 * 1000
  const brtNow = new Date(now.getTime() + brtOffsetMs)

  const hour = brtNow.getUTCHours()
  const hourStr = `${String(hour).padStart(2, '0')}:00`

  // Day of week in BRT (0=Sun, 1=Mon, ..., 6=Sat)
  const dayOfWeek = brtNow.getUTCDay()

  // Today 00:00 BRT expressed as UTC (= today 03:00 UTC, adjusted if before 03:00 UTC)
  const todayStartUTC = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 3, 0, 0, 0),
  )

  return { hourStr, dayOfWeek, todayStartUTC }
}
