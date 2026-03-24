import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface AlertaFailedProps {
  userName: string
  jobTitle: string
  company: string
  failReason: string
  directUrl?: string | null
}

const FAIL_REASON_LABELS: Record<string, string> = {
  CAPTCHA: 'O sistema detectou um captcha e não conseguiu continuar automaticamente.',
  TIMEOUT: 'O tempo limite de submissão foi excedido.',
  FORM_NOT_SUPPORTED:
    'O formulário externo desta vaga não é suportado automaticamente.',
}

export function AlertaFailed({
  userName,
  jobTitle,
  company,
  failReason,
  directUrl,
}: AlertaFailedProps) {
  const failLabel =
    FAIL_REASON_LABELS[failReason] ?? 'Ocorreu um erro inesperado durante a candidatura.'

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        Falha na candidatura para {jobTitle} em {company}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>AutoVagas</Heading>
          <Text style={badgeStyle}>⚠️ Candidatura falhou</Text>
          <Text style={greetingStyle}>Olá, {userName}.</Text>
          <Text style={textStyle}>
            Infelizmente não foi possível enviar sua candidatura para a vaga de{' '}
            <strong>{jobTitle}</strong> em <strong>{company}</strong>.
          </Text>
          <Text style={reasonStyle}>{failLabel}</Text>

          {directUrl && (
            <>
              <Text style={textStyle}>
                Você pode se candidatar manualmente clicando no botão abaixo:
              </Text>
              <Button href={directUrl} style={buttonStyle}>
                Candidatar manualmente
              </Button>
            </>
          )}

          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            Você está recebendo este e-mail porque tem alertas de falha ativados.{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/perfil`} style={linkStyle}>
              Gerenciar preferências
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default AlertaFailed

// ─── Styles ───────────────────────────────────────────────────────────────────

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#fafaf8',
  fontFamily: 'DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  margin: 0,
  padding: 0,
}

const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e8e7e0',
  borderRadius: '8px',
  margin: '40px auto',
  maxWidth: '560px',
  padding: '40px',
}

const headingStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 24px',
}

const badgeStyle: React.CSSProperties = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '20px',
  color: '#c2410c',
  display: 'inline-block',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0 0 20px',
  padding: '4px 12px',
}

const greetingStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const textStyle: React.CSSProperties = {
  color: '#4a4a4a',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const reasonStyle: React.CSSProperties = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '6px',
  color: '#7c2d12',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0 0 20px',
  padding: '12px 16px',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: '600',
  padding: '10px 20px',
  textDecoration: 'none',
  display: 'inline-block',
}

const hrStyle: React.CSSProperties = {
  borderColor: '#e8e7e0',
  margin: '24px 0',
}

const footerStyle: React.CSSProperties = {
  color: '#9b9b9b',
  fontSize: '12px',
  margin: '0',
}

const linkStyle: React.CSSProperties = {
  color: '#1a1a1a',
}
