import {
  Body,
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

interface AlertaViewedProps {
  userName: string
  jobTitle: string
  company: string
}

export function AlertaViewed({ userName, jobTitle, company }: AlertaViewedProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        Sua candidatura para {jobTitle} em {company} foi visualizada!
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>AutoVagas</Heading>
          <Text style={badgeStyle}>👀 Candidatura visualizada</Text>
          <Text style={greetingStyle}>Boa notícia, {userName}!</Text>
          <Text style={textStyle}>
            O recrutador de <strong>{company}</strong> visualizou sua candidatura para a vaga de{' '}
            <strong>{jobTitle}</strong>.
          </Text>
          <Text style={textStyle}>
            Isso é um sinal positivo! Fique atento ao seu e-mail e LinkedIn para possíveis
            próximas etapas do processo seletivo.
          </Text>
          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            Você está recebendo este e-mail porque tem alertas de visualização ativados.{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/perfil`} style={linkStyle}>
              Gerenciar preferências
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default AlertaViewed

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
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '20px',
  color: '#1d4ed8',
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
