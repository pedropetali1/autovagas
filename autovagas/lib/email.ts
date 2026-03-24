import { Resend } from 'resend'
import { createElement } from 'react'
import { ResumoDiario } from '@/emails/resumo-diario'
import { AlertaViewed } from '@/emails/alerta-viewed'
import { AlertaFailed } from '@/emails/alerta-failed'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'AutoVagas <noreply@autovagas.com.br>'

// ─── Template types ───────────────────────────────────────────────────────────

interface FailedApplication {
  title: string
  company: string
  directUrl?: string | null
}

export type EmailPayload =
  | {
      template: 'resumo-diario'
      to: string
      props: {
        userName: string
        totalAnalyzed: number
        totalSent: number
        totalFailed: number
        failedApplications: FailedApplication[]
      }
    }
  | {
      template: 'alerta-viewed'
      to: string
      props: {
        userName: string
        jobTitle: string
        company: string
      }
    }
  | {
      template: 'alerta-failed'
      to: string
      props: {
        userName: string
        jobTitle: string
        company: string
        failReason: string
        directUrl?: string | null
      }
    }

// ─── sendEmail helper ─────────────────────────────────────────────────────────

/**
 * Fire-and-forget email sender. Logs errors but never throws.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  try {
    let subject: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let react: React.ReactElement

    if (payload.template === 'resumo-diario') {
      subject = `Resumo diário: ${payload.props.totalSent} candidatura(s) enviada(s)`
      react = createElement(ResumoDiario, payload.props)
    } else if (payload.template === 'alerta-viewed') {
      subject = `Sua candidatura para ${payload.props.jobTitle} foi visualizada!`
      react = createElement(AlertaViewed, payload.props)
    } else {
      subject = `Falha na candidatura: ${payload.props.jobTitle} — ${payload.props.company}`
      react = createElement(AlertaFailed, payload.props)
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.to,
      subject,
      react,
    })

    if (error) {
      console.error('[email] Resend error:', error)
    }
  } catch (err) {
    console.error('[email] Failed to send email:', err)
  }
}
