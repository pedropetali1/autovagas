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
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface FailedApplication {
  title: string
  company: string
  directUrl?: string | null
}

interface ResumoDiarioProps {
  userName: string
  totalAnalyzed: number
  totalSent: number
  totalFailed: number
  failedApplications: FailedApplication[]
}

export function ResumoDiario({
  userName,
  totalAnalyzed,
  totalSent,
  totalFailed,
  failedApplications,
}: ResumoDiarioProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Resumo diário de candidaturas — ${totalSent} enviadas`}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>AutoVagas</Heading>
          <Text style={greetingStyle}>Olá, {userName}!</Text>
          <Text style={textStyle}>Aqui está o resumo das suas candidaturas de hoje:</Text>

          <Section style={statsSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={statCell}>
                    <Text style={statNumber}>{totalAnalyzed}</Text>
                    <Text style={statLabel}>Vagas analisadas</Text>
                  </td>
                  <td style={statCell}>
                    <Text style={statNumber}>{totalSent}</Text>
                    <Text style={statLabel}>Candidaturas enviadas</Text>
                  </td>
                  <td style={statCell}>
                    <Text style={statNumber}>{totalFailed}</Text>
                    <Text style={statLabel}>Falhas</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {failedApplications.length > 0 && (
            <>
              <Hr style={hrStyle} />
              <Text style={sectionTitleStyle}>Candidaturas que precisam de atenção:</Text>
              {failedApplications.map((app, i) => (
                <Section key={i} style={failedItemStyle}>
                  <Text style={jobTitleStyle}>{app.title}</Text>
                  <Text style={companyStyle}>{app.company}</Text>
                  {app.directUrl && (
                    <Button href={app.directUrl} style={buttonStyle}>
                      Candidatar manualmente
                    </Button>
                  )}
                </Section>
              ))}
            </>
          )}

          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            Você está recebendo este e-mail porque tem o resumo diário ativado.{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/perfil`} style={linkStyle}>
              Gerenciar preferências
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ResumoDiario

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
  margin: '0 0 24px',
}

const statsSection: React.CSSProperties = {
  backgroundColor: '#fafaf8',
  border: '1px solid #e8e7e0',
  borderRadius: '6px',
  padding: '20px',
  margin: '0 0 24px',
}

const statCell: React.CSSProperties = {
  textAlign: 'center',
  padding: '8px',
}

const statNumber: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  lineHeight: '1',
}

const statLabel: React.CSSProperties = {
  color: '#6b6b6b',
  fontSize: '12px',
  margin: '4px 0 0',
}

const hrStyle: React.CSSProperties = {
  borderColor: '#e8e7e0',
  margin: '24px 0',
}

const sectionTitleStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 16px',
}

const failedItemStyle: React.CSSProperties = {
  border: '1px solid #e8e7e0',
  borderRadius: '6px',
  padding: '16px',
  margin: '0 0 12px',
}

const jobTitleStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 4px',
}

const companyStyle: React.CSSProperties = {
  color: '#6b6b6b',
  fontSize: '13px',
  margin: '0 0 12px',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: '600',
  padding: '8px 16px',
  textDecoration: 'none',
  display: 'inline-block',
}

const footerStyle: React.CSSProperties = {
  color: '#9b9b9b',
  fontSize: '12px',
  margin: '0',
}

const linkStyle: React.CSSProperties = {
  color: '#1a1a1a',
}
