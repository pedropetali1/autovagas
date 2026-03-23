# PRD: AutoVagas — Automação de Candidaturas a Vagas de Emprego

## 1. Visão Geral

O **AutoVagas** é um SaaS que automatiza o processo de candidatura a vagas de emprego no LinkedIn. A plataforma analisa vagas que correspondem ao perfil e às skills do profissional cadastrado, acessa as publicações e envia o currículo automaticamente — reduzindo o tempo gasto em candidaturas manuais de horas para minutos.

**Problema:** Profissionais em busca de recolocação perdem horas por dia pesquisando, filtrando e se candidatando manualmente a vagas no LinkedIn. O processo é repetitivo, demorado e sujeito a erros humanos (vagas esquecidas, formulários incompletos).

**Solução:** Um pipeline assíncrono que, diariamente e dentro da cota do plano contratado, faz scraping anônimo de vagas relevantes via proxies rotativos, calcula um score de compatibilidade e preenche formulários de candidatura (Easy Apply e externos) com automação headless Playwright. O usuário acompanha cada passo pelo dashboard com logs completos e screenshots.

---

## 2. Personas

### Persona 1 — Ana, 28 anos, Desenvolvedora Frontend
- **Contexto:** Desenvolvedora pleno procurando recolocação após layoff. Atualiza LinkedIn mas não tem tempo de ficar revisando vagas toda manhã.
- **Dor principal:** Perde vagas boas porque não verifica o feed com frequência; candidaturas manuais consomem 1–2h por dia.
- **Objetivo:** Ser candidatada automaticamente às vagas mais compatíveis com seu perfil enquanto trabalha em outros projetos.
- **Plano esperado:** Plus (10 vagas/dia).

### Persona 2 — Carlos, 42 anos, Gerente de Projetos
- **Contexto:** Executivo sênior em transição de carreira. Perfil premium no LinkedIn, disposto a pagar por ferramentas que aumentem suas chances.
- **Dor principal:** Quer maximizar visibilidade perante recrutadores sem dedicar horas ao processo.
- **Objetivo:** Volume alto de candidaturas qualificadas por dia, com rastreabilidade completa de status e prova de que as candidaturas foram enviadas.
- **Plano esperado:** Pro (20 vagas/dia).

### Persona 3 — Julia, 23 anos, Recém-formada em Marketing
- **Contexto:** Primeira experiência de busca de emprego. Pouco tempo livre por causa de freelances.
- **Dor principal:** Não sabe quais vagas se encaixam no seu perfil; processo de candidatura é confuso.
- **Objetivo:** Descobrir vagas relevantes e enviar currículo sem esforço.
- **Plano esperado:** Free (1 vaga/dia) para testar a plataforma.

---

## 3. User Stories

### US-001: Cadastro e onboarding via Clerk
**Descrição:** Como novo usuário, quero criar minha conta e preencher meu perfil inicial para que o sistema possa iniciar a busca de vagas.

**Acceptance Criteria:**
- [ ] Autenticação via Clerk (e-mail, Google, GitHub)
- [ ] Após login, usuário sem perfil completo é redirecionado para `/perfil`
- [ ] Indicador de progresso mostra quais campos faltam (dados pessoais, skills, CV)
- [ ] Salvar perfil cria registro `User` no banco com `clerkId`
- [ ] Typecheck passes

---

### US-002: Upload de currículo em PDF
**Descrição:** Como usuário, quero fazer upload do meu currículo em PDF para que o sistema o envie nas candidaturas automáticas.

**Acceptance Criteria:**
- [ ] Campo de upload aceita apenas arquivos `.pdf` (máx 5 MB)
- [ ] Arquivo é enviado ao Supabase Storage no bucket `cvs/{userId}/cv.pdf`
- [ ] `cvUrl` é salvo no modelo `User`
- [ ] Preview do arquivo exibe nome do arquivo e data de upload
- [ ] Substituição de arquivo sobrescreve o anterior no Storage (1 CV por usuário no MVP)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-003: Gerenciamento de skills com tags
**Descrição:** Como usuário, quero adicionar e remover skills do meu perfil para que o sistema calcule a compatibilidade com as vagas.

**Acceptance Criteria:**
- [ ] Campo de input com autocomplete exibe skills sugeridas
- [ ] Skills são renderizadas como tags removíveis
- [ ] Ao adicionar skill, cria registro `Skill` associado ao `userId`
- [ ] Ao remover tag, deleta registro do banco
- [ ] Mínimo de 3 skills exigido para ativar candidaturas automáticas
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: Visualização do Dashboard
**Descrição:** Como usuário logado, quero ver meu dashboard com métricas de candidaturas para acompanhar meu progresso diário.

**Acceptance Criteria:**
- [ ] Exibe saudação com nome do usuário
- [ ] Card de plano mostra plano atual, cota diária e quantas candidaturas foram feitas hoje
- [ ] Metric cards exibem: total candidaturas, enviadas com sucesso, taxa de resposta, score médio
- [ ] Timeline de atividade lista as últimas 10 candidaturas com status colorido, timestamp e nome da empresa
- [ ] Toggle "Pausar automação" visível no dashboard; quando pausado exibe badge amarelo "Automação pausada"
- [ ] Dados carregam via tRPC query com skeleton loader
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: Listagem de vagas com match score
**Descrição:** Como usuário, quero ver a lista de vagas encontradas com o score de compatibilidade para entender quais são mais relevantes para mim.

**Acceptance Criteria:**
- [ ] Lista pagina 20 vagas por vez com infinite scroll ou paginação
- [ ] Cada card exibe: título, empresa, localização, salário (se disponível), badge de status, badge de tipo (Easy Apply / Externo), barra de compatibilidade
- [ ] Score de compatibilidade é exibido em porcentagem e cor (verde ≥70%, âmbar 40–69%, vermelho <40%)
- [ ] Filtro por status: Todas / Pendente / Candidatando / Enviada / Falhou / Visualizada
- [ ] Candidaturas com status FAILED e `directUrl` exibem botão "Candidatar manualmente" que abre a vaga no LinkedIn
- [ ] Clicar no card abre modal com descrição completa, requisitos e log de ações
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-006: Seleção e contratação de plano via Stripe
**Descrição:** Como usuário, quero visualizar os planos disponíveis e fazer upgrade para aumentar minha cota diária.

**Acceptance Criteria:**
- [ ] Página `/planos` exibe 3 cards: Free, Plus (R$29/mês), Pro (R$59/mês)
- [ ] Plano atual é destacado com badge "Seu plano"
- [ ] Clicar em "Assinar" redireciona para Stripe Checkout
- [ ] Após pagamento bem-sucedido, webhook do Stripe atualiza `plan` e `dailyQuota` do usuário
- [ ] Cancelamento de assinatura rebaixa para Free ao fim do período
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Worker de scraping anônimo de vagas (Playwright)
**Descrição:** Como sistema, preciso coletar vagas do LinkedIn usando sessões anônimas e proxies rotativos para que o pipeline de matching possa ser executado sem expor credenciais do usuário.

**Acceptance Criteria:**
- [ ] Job BullMQ `scraper` é enfileirado diariamente para cada usuário elegível
- [ ] Playwright opera em modo headless com sessão anônima (sem credenciais do usuário)
- [ ] Cada sessão recebe fingerprint único: `userAgent`, `viewport`, `timezone` e `locale` randomizados
- [ ] Requisições são roteadas via proxy residencial rotativo (Bright Data ou Oxylabs), máximo 2 req/s por IP
- [ ] Em caso de captcha ou bloqueio de IP: backoff exponencial (30s, 60s, 120s) antes de retentar com novo proxy
- [ ] Após 3 tentativas sem sucesso: fallback para LinkedIn Jobs Guest API (endpoint público)
- [ ] Vagas coletadas são filtradas por `desiredRole` + `zipCode` do usuário
- [ ] Cada vaga é salva como registro `Job` com campo `applyType` (EASY_APPLY ou EXTERNAL), deduplicado por `linkedinUrl`
- [ ] Máximo de `dailyQuota × 3` vagas coletadas por execução
- [ ] Cria `ApplicationLog` com `action: SCRAPE` para cada vaga coletada
- [ ] Typecheck passes

---

### US-008: Worker de matching (cálculo de score)
**Descrição:** Como sistema, preciso calcular o score de compatibilidade entre as skills do usuário e os requisitos da vaga, aplicando filtros excludentes antes de selecionar candidaturas.

**Acceptance Criteria:**
- [ ] Job BullMQ `matching` é enfileirado após conclusão do job `scraper`
- [ ] Vagas de empresas presentes em `User.excludeCompanies[]` são descartadas antes do scoring
- [ ] Vagas com salário abaixo de `User.minSalary` (quando preenchido) são descartadas
- [ ] Score é calculado como: `(skills_em_comum / total_requisitos_da_vaga) × 100`
- [ ] Vagas com score ≥ 40% são elegíveis para candidatura
- [ ] Score é salvo em `Application.matchScore`
- [ ] As top N vagas (N = `dailyQuota`) por score são selecionadas para candidatura
- [ ] Cria `ApplicationLog` com `action: MATCH` e `detail: { score, skillsMatched[], skillsMissed[] }` para cada vaga avaliada
- [ ] Typecheck passes

---

### US-009: Worker de candidatura automática — Easy Apply e Formulários Externos (Playwright)
**Descrição:** Como sistema, preciso preencher e enviar formulários de candidatura no LinkedIn (Easy Apply) e em sites externos, com fallback para candidatura manual quando o formulário não puder ser mapeado.

**Acceptance Criteria:**
- [ ] Job BullMQ `apply` é enfileirado após o matching com lista de `applicationIds`
- [ ] Status → `APPLYING`; cria `ApplicationLog` com `action: FILL_FORM`
- [ ] **Easy Apply (`applyType = EASY_APPLY`):** Playwright clica em "Candidatar-se fácil", preenche modal com nome, e-mail, telefone e faz upload do CV; cria log com `action: SUBMIT` e screenshot do formulário preenchido
- [ ] **Formulário externo (`applyType = EXTERNAL`):** Playwright segue o redirect, identifica campos via heurísticas (atributos `label`, `name`, `id`, `placeholder`), preenche com dados do perfil; faz upload do CV se campo de arquivo for detectado
- [ ] Se mapeamento de campos externos for < 70% dos campos obrigatórios: marca `Application.status = FAILED`, `failReason = FORM_NOT_SUPPORTED`, salva `directUrl` com URL original da vaga para candidatura manual; cria log com `action: SUBMIT` e `detail: { reason: 'FORM_NOT_SUPPORTED', mappedFields, totalRequired }`
- [ ] Screenshot do estado final do formulário é salvo no Supabase Storage (`screenshots/{applicationId}/final.png`) e URL salva em `ApplicationLog.screenshotUrl`
- [ ] Status → `SENT` (sucesso) com `appliedAt = now()` | `FAILED` com `failReason` (CAPTCHA / TIMEOUT / FORM_NOT_SUPPORTED)
- [ ] Typecheck passes

---

### US-010: Cron diário de disparo de jobs
**Descrição:** Como sistema, preciso disparar o pipeline de candidaturas diariamente para todos os usuários ativos que não pausaram a automação.

**Acceptance Criteria:**
- [ ] Cron BullMQ configurado para executar às 08h00 (horário de Brasília) todos os dias
- [ ] Itera sobre todos os usuários com `cvUrl` preenchido, pelo menos 3 skills e `automationPaused = false`
- [ ] Cria jobs `scraper` para cada usuário elegível
- [ ] Não dispara para usuários que já atingiram `dailyQuota` no dia
- [ ] Log de execução registra quantos usuários foram processados / ignorados
- [ ] Typecheck passes

---

### US-011: Landing page pública
**Descrição:** Como visitante, quero entender o produto e iniciar um cadastro para começar a automatizar minhas candidaturas.

**Acceptance Criteria:**
- [ ] Seção Hero com headline, subtítulo e botão "Começar grátis"
- [ ] Seção "Como funciona" com 3 passos ilustrados
- [ ] Seção de stats (ex: "10.000+ candidaturas enviadas", "500+ usuários ativos")
- [ ] Seção de pricing com os 3 planos
- [ ] CTA final com botão de cadastro
- [ ] Página é renderizada via SSG (sem dados dinâmicos)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-012: Notificações por e-mail via Resend
**Descrição:** Como usuário, quero receber e-mails automáticos sobre o resultado das minhas candidaturas para acompanhar meu progresso sem precisar abrir o dashboard.

**Acceptance Criteria:**
- [ ] **Resumo diário:** ao término do pipeline, e-mail enviado via Resend com: total de vagas analisadas, candidaturas enviadas, falhas e links diretos para vagas com status FAILED (se `emailDigest = true`)
- [ ] **Alerta VIEWED:** quando `Application.status` muda para `VIEWED`, e-mail enviado em tempo real com nome da vaga e empresa (se `emailOnViewed = true`)
- [ ] **Alerta FAILED:** quando `Application.status` muda para `FAILED`, e-mail contém motivo da falha e link para candidatura manual via `directUrl` (se `emailOnFailed = true`)
- [ ] Cada preferência de e-mail possui toggle na página `/perfil` (seção "Notificações")
- [ ] Templates de e-mail em pt-BR, design alinhado ao design system (cores, fontes)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-013: Toggle pausar/retomar automação e filtros excludentes
**Descrição:** Como usuário, quero pausar temporariamente a automação e configurar filtros para excluir empresas indesejadas e estabelecer salário mínimo.

**Acceptance Criteria:**
- [ ] Toggle "Pausar automação" no dashboard muda `User.automationPaused` via tRPC mutation
- [ ] Quando `automationPaused = true`, o cron ignora o usuário e badge amarelo "Automação pausada" aparece no dashboard e na página de vagas
- [ ] Seção "Filtros" na página `/perfil` com campo de texto para adicionar empresas a excluir (`excludeCompanies[]`), renderizadas como tags removíveis
- [ ] Campo `minSalary` (texto livre, ex: "R$ 5.000") salvo no perfil; exibido como dica na listagem de vagas descartadas
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-014: Log detalhado de candidatura com screenshots
**Descrição:** Como usuário, quero ver o log completo de cada candidatura — com timestamps, ações e screenshot do formulário preenchido — para ter prova transparente do que foi enviado.

**Acceptance Criteria:**
- [ ] Modal de detalhe da candidatura (aberto ao clicar no card da vaga) exibe timeline de `ApplicationLog` com: ícone por action, timestamp, campo `detail` formatado
- [ ] Entradas com `action: SCREENSHOT` exibem thumbnail clicável que abre o screenshot em tela cheia
- [ ] Screenshot armazenado em Supabase Storage com RLS (apenas o dono acessa)
- [ ] Log exibe mensagem clara quando `failReason = FORM_NOT_SUPPORTED` e botão "Candidatar manualmente" com `directUrl`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

## 4. Requisitos Funcionais

- **FR-1:** O sistema deve autenticar usuários exclusivamente via Clerk (e-mail/Google/GitHub).
- **FR-2:** O sistema deve permitir que o usuário faça upload de um único arquivo PDF (máx 5 MB) como currículo, armazenado no Supabase Storage. Upload novo substitui o anterior.
- **FR-3:** O sistema deve permitir que o usuário gerencie suas skills como tags (adicionar/remover).
- **FR-4:** O sistema deve calcular um `matchScore` (0–100) para cada vaga com base na sobreposição entre as skills do usuário e os requisitos da vaga.
- **FR-5:** O sistema deve disparar um cron diário às 08h00 BRT para enfileirar jobs de scraping, matching e candidatura para cada usuário elegível (com `automationPaused = false`).
- **FR-6:** O worker `scraper` deve operar com sessões anônimas via Playwright, proxies residenciais rotativos, fingerprint randomizado por sessão (user-agent, viewport, timezone), rate limit de 2 req/s por IP, backoff exponencial em caso de captcha/bloqueio, e fallback para LinkedIn Jobs Guest API após 3 tentativas falhas.
- **FR-7:** O worker `matching` deve descartar vagas de `excludeCompanies[]`, aplicar filtro de `minSalary` quando preenchido, e selecionar as top N vagas (N = `dailyQuota`) com score ≥ 40% para candidatura.
- **FR-8:** O worker `apply` deve suportar dois tipos de formulário: Easy Apply (modal LinkedIn) e External (formulário em site terceiro via heurísticas de campo). Quando mapeamento < 70% dos campos obrigatórios, marca como `FAILED` com `failReason = FORM_NOT_SUPPORTED` e salva `directUrl`.
- **FR-9:** O worker `apply` deve capturar screenshot do formulário preenchido, salvar no Supabase Storage e registrar URL no `ApplicationLog`.
- **FR-10:** O sistema deve respeitar a `dailyQuota` do plano do usuário (Free: 1, Plus: 10, Pro: 20).
- **FR-11:** O sistema deve processar pagamentos e gerenciar assinaturas via Stripe (Checkout + Webhooks).
- **FR-12:** O sistema deve atualizar o status de `Application` em tempo real conforme o pipeline avança, criando entradas em `ApplicationLog` a cada ação.
- **FR-13:** O dashboard deve exibir métricas (total, enviadas, taxa de resposta, score médio), timeline de atividade e toggle de pausa da automação.
- **FR-14:** A listagem de vagas deve permitir filtro por status, exibir badge de tipo (Easy Apply / Externo) e botão de candidatura manual para vagas com `failReason = FORM_NOT_SUPPORTED`.
- **FR-15:** O sistema deve deduplicar vagas pelo campo `linkedinUrl` para evitar candidaturas duplicadas.
- **FR-16:** O sistema deve enviar e-mails transacionais via Resend: resumo diário, alerta VIEWED e alerta FAILED, com preferências configuráveis individualmente no perfil.
- **FR-17:** O sistema deve permitir ao usuário pausar/retomar a automação e configurar filtros excludentes (empresas e salário mínimo) no perfil.
- **FR-18:** Interface, e-mails e mensagens de erro devem estar em português brasileiro. A estrutura do código deve usar `next-intl` com strings extraídas em arquivo de mensagens para preparar futura internacionalização.

---

## 5. Requisitos Não-Funcionais

- **RNF-1 (Performance):** O dashboard deve carregar em menos de 2 segundos em conexão 4G.
- **RNF-2 (Escalabilidade):** A fila BullMQ deve suportar pelo menos 1.000 jobs simultâneos sem degradação.
- **RNF-3 (Disponibilidade):** O frontend deve ter SLA de 99,9% (Vercel). Os workers podem ter janelas de manutenção de até 30 min/mês.
- **RNF-4 (Segurança):** CVs e screenshots em PDF devem ser acessíveis apenas pelo próprio usuário (RLS no Supabase Storage). Nenhuma credencial do LinkedIn é armazenada no banco.
- **RNF-5 (Conformidade):** O scraping deve respeitar rate limit de máximo 2 req/s por IP; proxies residenciais rotativos minimizam risco de bloqueio de conta ou IP da infraestrutura.
- **RNF-6 (Observabilidade):** Todos os jobs devem registrar logs estruturados com `userId`, `jobId`, duração e status final. `ApplicationLog` persiste histórico granular de cada ação do pipeline.
- **RNF-7 (Manutenibilidade):** Cobertura de testes ≥ 70% para lógica de matching e workers críticos.
- **RNF-8 (Acessibilidade):** Interface deve seguir WCAG 2.1 nível AA.
- **RNF-9 (Internacionalização):** Toda string visível ao usuário deve ser gerenciada via `next-intl` com locale `pt-BR` como padrão. Não usar strings hardcoded no JSX.

---

## 6. Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vercel)                        │
│  Next.js 14 App Router + React 18 + TypeScript                │
│  Tailwind CSS + Shadcn/ui + tRPC Client + next-intl (pt-BR)  │
└─────────────────────┬────────────────────────────────────────┘
                      │ tRPC over HTTPS
┌─────────────────────▼────────────────────────────────────────┐
│                    API LAYER (Vercel)                          │
│  tRPC Router (Next.js Route Handlers)                         │
│  Clerk Middleware (JWT auth)                                  │
│  Stripe Webhooks Handler                                      │
│  Clerk Webhooks Handler                                       │
└──────┬──────────────────────┬───────────────────────────────┘
       │ Prisma ORM           │ BullMQ enqueue         │ Resend SDK
┌──────▼──────────┐  ┌────────▼─────────────────┐  ┌──▼──────────┐
│  PostgreSQL      │  │  Redis (Railway/Fly.io)   │  │   Resend    │
│  (Supabase)      │  │  BullMQ Queue Manager     │  │  (e-mails)  │
└─────────────────┘  └──────────┬───────────────┘  └────────────┘
                                │ consume jobs
             ┌──────────────────▼──────────────────────────────┐
             │              WORKERS (Railway/Fly.io)            │
             │  ┌──────────────┐  ┌──────────┐  ┌──────────┐  │
             │  │   scraper    │  │ matching │  │  apply   │  │
             │  │ Playwright   │  │ scoring  │  │Playwright│  │
             │  │ + Proxy Pool │  │ filters  │  │Easy Apply│  │
             │  │(Bright Data) │  │          │  │+ External│  │
             │  └──────────────┘  └──────────┘  └──────────┘  │
             │               ┌─────────────┐                   │
             │               │    CRON      │                   │
             │               │ (BullMQ Rep.)│                   │
             └───────────────┴─────────────┴───────────────────┘
                                      │
              ┌───────────────────────▼──────────────────────┐
              │              Supabase Storage                  │
              │  cvs/{userId}/cv.pdf         (RLS: owner)     │
              │  screenshots/{appId}/final.png (RLS: owner)   │
              └──────────────────────────────────────────────┘
```

### Comunicação entre camadas
- **Frontend → API:** tRPC (type-safe RPC sobre HTTP)
- **API → Workers:** Enfileiramento de jobs no BullMQ via Redis
- **Workers → DB:** Prisma (conexão direta ao PostgreSQL Supabase)
- **Workers → LinkedIn:** Playwright headless (Chromium) com proxy residencial rotativo
- **Workers → Resend:** SDK Resend para disparo de e-mails transacionais pós-pipeline
- **Stripe → API:** Webhook POST para `/api/webhooks/stripe`
- **Clerk → API:** Webhook POST para `/api/webhooks/clerk` + Middleware JWT validation

---

## 7. Modelos de Dados

```prisma
enum Plan {
  FREE
  PLUS
  PRO
}

enum ApplicationStatus {
  PENDING
  APPLYING
  SENT
  FAILED
  VIEWED
}

enum ApplyType {
  EASY_APPLY
  EXTERNAL
}

enum LogAction {
  SCRAPE
  MATCH
  FILL_FORM
  SUBMIT
  SCREENSHOT
}

model User {
  id                String        @id @default(cuid())
  clerkId           String        @unique
  email             String        @unique
  name              String
  phone             String?
  zipCode           String?
  linkedinUrl       String?
  desiredRole       String?
  cvUrl             String?
  plan              Plan          @default(FREE)
  dailyQuota        Int           @default(1)
  // Preferências de notificação
  emailDigest       Boolean       @default(true)
  emailOnViewed     Boolean       @default(true)
  emailOnFailed     Boolean       @default(true)
  // Controle de automação
  automationPaused  Boolean       @default(false)
  // Filtros excludentes
  excludeCompanies  String[]      @default([])
  minSalary         String?
  // Relações
  skills            Skill[]
  applications      Application[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([clerkId])
}

model Skill {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([name, userId])
  @@index([userId])
}

model Job {
  id           String        @id @default(cuid())
  title        String
  company      String
  location     String?
  salary       String?
  description  String?
  linkedinUrl  String        @unique
  requirements String[]
  remote       Boolean       @default(false)
  applyType    ApplyType     @default(EASY_APPLY)
  applications Application[]
  createdAt    DateTime      @default(now())

  @@index([linkedinUrl])
}

model Application {
  id         String            @id @default(cuid())
  userId     String
  jobId      String
  status     ApplicationStatus @default(PENDING)
  matchScore Float             @default(0)
  appliedAt  DateTime?
  errorLog   String?
  // Campos para fallback de candidatura manual
  failReason String?           // FORM_NOT_SUPPORTED | CAPTCHA | TIMEOUT
  directUrl  String?           // URL original da vaga para candidatura manual
  // Relações
  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  job        Job               @relation(fields: [jobId], references: [id])
  logs       ApplicationLog[]
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@unique([userId, jobId])
  @@index([userId, status])
  @@index([createdAt])
}

model ApplicationLog {
  id            String      @id @default(cuid())
  applicationId String
  action        LogAction
  detail        Json?       // ex: { score: 82, skillsMatched: ["React"], skillsMissed: ["Vue"] }
  screenshotUrl String?     // URL do Supabase Storage (apenas action: SCREENSHOT)
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())

  @@index([applicationId])
  @@index([createdAt])
}
```

---

## 8. Endpoints da API (tRPC)

### `user` router

| Procedure | Tipo | Descrição |
|-----------|------|-----------|
| `user.getProfile` | query | Retorna perfil completo do usuário logado |
| `user.updateProfile` | mutation | Atualiza dados pessoais (name, phone, zipCode, linkedinUrl, desiredRole, minSalary) |
| `user.uploadCv` | mutation | Recebe URL pré-assinada do Supabase e salva `cvUrl` no User |
| `user.addSkill` | mutation | Cria registro Skill para o usuário |
| `user.removeSkill` | mutation | Remove registro Skill pelo id |
| `user.updateNotificationPrefs` | mutation | Atualiza emailDigest, emailOnViewed, emailOnFailed |
| `user.toggleAutomation` | mutation | Alterna `automationPaused` true/false |
| `user.addExcludeCompany` | mutation | Adiciona empresa ao array `excludeCompanies` |
| `user.removeExcludeCompany` | mutation | Remove empresa do array `excludeCompanies` |

### `application` router

| Procedure | Tipo | Descrição |
|-----------|------|-----------|
| `application.list` | query | Lista paginada de Applications com dados do Job (filtro por status) |
| `application.getStats` | query | Retorna métricas: total, sent, failRate, avgScore |
| `application.getTimeline` | query | Retorna as últimas 10 Applications ordenadas por `createdAt` desc |
| `application.getLogs` | query | Retorna todos os `ApplicationLog` de uma Application pelo id |

### `billing` router

| Procedure | Tipo | Descrição |
|-----------|------|-----------|
| `billing.getPlans` | query | Retorna definição dos 3 planos com preços e quotas |
| `billing.createCheckoutSession` | mutation | Cria Stripe Checkout Session e retorna URL de redirecionamento |
| `billing.getSubscription` | query | Retorna status atual da assinatura do usuário |

### Webhooks HTTP (Route Handlers)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/webhooks/stripe` | POST | Processa eventos Stripe: `checkout.session.completed`, `customer.subscription.deleted` |
| `/api/webhooks/clerk` | POST | Sincroniza criação/atualização de usuário Clerk → Prisma |

---

## 9. Fluxos do Sistema

### Fluxo 1: Onboarding do Usuário
```
Usuário acessa / → Clerk Login → Callback → /dashboard
→ profileComplete? Não → redirect /perfil
→ Usuário preenche: nome, telefone, CEP, URL LinkedIn, cargo desejado
→ (Opcional) Define minSalary e excludeCompanies
→ Usuário adiciona skills (≥3)
→ Usuário faz upload de CV PDF → Supabase Storage → cvUrl salvo
→ profileComplete = true → redirect /dashboard
```

### Fluxo 2: Pipeline Diário de Candidaturas
```
CRON 08h00 BRT
  └─ Para cada User elegível
     (cvUrl ≠ null + skills ≥ 3 + automationPaused = false):
       └─ Enfileira job: scraper({ userId })

Worker SCRAPER (sessão anônima)
  └─ Inicializa sessão Playwright com fingerprint único
     (userAgent, viewport, timezone, locale randomizados)
  └─ Roteia via proxy residencial (Bright Data/Oxylabs)
  └─ Busca vagas LinkedIn por desiredRole + zipCode (2 req/s máx por IP)
  └─ Captcha ou bloqueio?
       └─ Sim: backoff exponencial (30s/60s/120s) + troca de proxy
       └─ 3 tentativas sem sucesso: fallback LinkedIn Jobs Guest API
  └─ Identifica applyType de cada vaga (EASY_APPLY | EXTERNAL)
  └─ Salva Jobs no DB (dedup por linkedinUrl)
  └─ Cria ApplicationLog { action: SCRAPE } por vaga
  └─ Enfileira job: matching({ userId, jobIds[] })

Worker MATCHING
  └─ Filtra vagas de excludeCompanies[] → descarta
  └─ Filtra vagas com salário < minSalary → descarta
  └─ Para cada Job restante: calcula matchScore vs skills do usuário
  └─ Filtra vagas com score < 40% → descarta
  └─ Seleciona top N (N = dailyQuota) por score decrescente
  └─ Cria registros Application { status: PENDING }
  └─ Cria ApplicationLog { action: MATCH, detail: { score, skillsMatched, skillsMissed } }
  └─ Enfileira job: apply({ applicationIds[] })

Worker APPLY
  └─ Para cada Application:
       └─ Status → APPLYING
       └─ Cria ApplicationLog { action: FILL_FORM }
       │
       ├─ Se applyType = EASY_APPLY:
       │    └─ Playwright clica "Candidatar-se fácil"
       │    └─ Preenche modal: nome, e-mail, telefone, CV upload
       │    └─ Tira screenshot → Storage → ApplicationLog { action: SCREENSHOT }
       │    └─ Submete formulário
       │
       └─ Se applyType = EXTERNAL:
            └─ Playwright segue redirect para site externo
            └─ Identifica campos via heurísticas (label/name/id/placeholder)
            └─ Mapeamento ≥ 70% campos obrigatórios?
                 ├─ Sim: preenche + screenshot + submete
                 └─ Não: status = FAILED, failReason = FORM_NOT_SUPPORTED
                         directUrl = URL original da vaga
                         ApplicationLog { action: SUBMIT, detail: { reason, mappedFields, totalRequired } }
       │
       └─ Sucesso: status = SENT, appliedAt = now()
          Falha (captcha/timeout): status = FAILED, failReason = CAPTCHA | TIMEOUT
       │
       └─ Cria ApplicationLog { action: SUBMIT }

Pós-pipeline (após processar todos os applies do usuário):
  └─ emailDigest = true? → Resend: e-mail com resumo (vagas analisadas, enviadas, falhas)
  └─ Para cada FAILED com emailOnFailed = true: → Resend: alerta com directUrl

Evento assíncrono (quando status muda para VIEWED):
  └─ emailOnViewed = true? → Resend: alerta em tempo real
```

### Fluxo 3: Upgrade de Plano
```
Usuário acessa /planos → Clica em "Assinar Plus/Pro"
→ billing.createCheckoutSession({ plan: 'PLUS' })
→ Redirect para Stripe Checkout
→ Pagamento aprovado → Stripe dispara webhook
→ /api/webhooks/stripe: evento checkout.session.completed
→ Atualiza User: plan = PLUS, dailyQuota = 10
→ Redirect para /dashboard com toast de confirmação
```

### Fluxo 4: Cancelamento de Assinatura
```
Usuário cancela no Stripe Portal
→ Stripe dispara evento customer.subscription.deleted
→ /api/webhooks/stripe atualiza User: plan = FREE, dailyQuota = 1
→ Na próxima execução do cron, usuário opera com quota reduzida
```

### Fluxo 5: Pausa e Retomada da Automação
```
Usuário clica toggle "Pausar automação" no dashboard
→ user.toggleAutomation() → User.automationPaused = true
→ Dashboard exibe badge "Automação pausada"
→ Cron ignora usuário até que automationPaused = false

Usuário clica "Retomar automação"
→ user.toggleAutomation() → User.automationPaused = false
→ Pipeline retoma na próxima execução do cron (08h00 BRT)
```

### Fluxo 6: Candidatura Manual (Fallback FORM_NOT_SUPPORTED)
```
Dashboard exibe candidatura com status FAILED e badge "Formulário não suportado"
→ Usuário vê botão "Candidatar manualmente"
→ Clica → abre directUrl no LinkedIn em nova aba
→ Usuário realiza candidatura manualmente
(Status permanece FAILED no sistema — não há atualização automática)
```

---

## 10. Design System

### Paleta de Cores

| Token | Valor | Uso |
|-------|-------|-----|
| `background` | `#fafaf8` | Fundo global da aplicação |
| `surface` | `#ffffff` | Cards, modais, sidebars |
| `text-primary` | `#1a1a1a` | Texto principal |
| `text-muted` | `#6b6b6b` | Labels, placeholders |
| `border` | `#e8e7e0` | Bordas de cards e inputs |
| `accent-green` | `#16a34a` | Status SENT, scores altos, sucesso |
| `accent-amber` | `#d97706` | Status APPLYING, scores médios, alertas, automação pausada |
| `accent-red` | `#dc2626` | Status FAILED, scores baixos, erros |
| `accent-purple` | `#7c3aed` | Plano Pro, destaques premium, Status VIEWED |
| `accent-blue` | `#2563eb` | Links, plano Plus |

### Tipografia

| Fonte | Uso | Pesos |
|-------|-----|-------|
| DM Sans | Interface geral, corpo, labels | 400, 500, 600 |
| Playfair Display | Headlines da landing page, títulos H1/H2 | 400, 700 |

### Componentes Principais

| Componente | Border Radius | Sombra |
|------------|---------------|--------|
| Cards | `10px` | `0 1px 3px rgba(0,0,0,0.08)` |
| Botões primários | `100px` (pill) | nenhuma |
| Inputs | `8px` | nenhuma (border only) |
| Badges de status | `100px` | nenhuma |
| Modais | `16px` | `0 8px 32px rgba(0,0,0,0.12)` |

### Badges de Status de Candidatura

| Status | Cor de fundo | Cor do texto |
|--------|-------------|--------------|
| PENDING | `#f3f4f6` | `#6b7280` |
| APPLYING | `#fef3c7` | `#d97706` |
| SENT | `#dcfce7` | `#16a34a` |
| FAILED | `#fee2e2` | `#dc2626` |
| VIEWED | `#ede9fe` | `#7c3aed` |

### Badges de Tipo de Candidatura

| Tipo | Cor de fundo | Cor do texto |
|------|-------------|--------------|
| EASY_APPLY | `#dbeafe` | `#2563eb` |
| EXTERNAL | `#f3f4f6` | `#6b7280` |

### Barra de Compatibilidade (Match Score)

- `≥70%`: cor `accent-green`, label "Alta compatibilidade"
- `40–69%`: cor `accent-amber`, label "Compatibilidade média"
- `<40%`: cor `accent-red`, label "Baixa compatibilidade"

---

## 11. Métricas de Sucesso

### Métricas de Produto
- **Ativação:** ≥60% dos usuários cadastrados completam o perfil (skills + CV) na primeira sessão.
- **Retenção:** ≥40% dos usuários retornam ao dashboard no dia seguinte ao cadastro.
- **Conversão free → pago:** ≥15% dos usuários free fazem upgrade nos primeiros 14 dias.
- **Taxa de sucesso de candidatura:** ≥85% dos jobs `apply` terminam com status `SENT` (não `FAILED`).
- **Taxa de suporte EXTERNAL:** ≥60% dos formulários externos são mapeados com sucesso (≥ 70% dos campos obrigatórios).

### Métricas de Negócio
- MRR de R$5.000 no fim do mês 2 pós-lançamento.
- Churn mensal < 5%.
- CAC < R$50 por usuário pago.

### Métricas Técnicas
- P95 de latência do dashboard < 2s.
- Taxa de falha de workers < 5% por execução diária.
- Uptime do frontend ≥ 99,9%.
- Taxa de entrega de e-mails via Resend ≥ 98%.

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| LinkedIn bloqueia IPs dos workers por scraping | Alta | Alto | Proxies residenciais rotativos (Bright Data/Oxylabs); fingerprint randomizado por sessão; rate limit 2 req/s por IP; backoff exponencial em captcha; fallback para LinkedIn Jobs Guest API |
| Mudança no DOM do LinkedIn quebra automação | Alta | Alto | Seletores CSS/XPath em arquivo de configuração separado (`selectors.config.ts`); alertas automáticos quando taxa de FAILED > 20% em 1h; equipe monitora falhas diárias |
| Heurísticas de formulários externos mapeiam campos incorretamente | Alta | Médio | Threshold de 70% obrigatório antes de submeter; fallback FORM_NOT_SUPPORTED preserva candidatura manual via `directUrl`; log de detalhe com campos mapeados/não mapeados para análise |
| Custos de proxy residencial escalam com base de usuários | Médio | Médio | Cache de sessões Playwright por usuário (reuso de contexto por 30 min); scraping em pool compartilhado de vagas por cargo/localização para evitar buscas duplicadas |
| Vazamento de dados de CV ou screenshots | Baixa | Alto | RLS no Supabase Storage (apenas o dono acessa); URLs pré-assinadas com TTL curto para exibição; nenhum dado sensível em logs públicos |
| Fraude em pagamentos via Stripe | Baixa | Médio | Verificar assinatura do webhook com `STRIPE_WEBHOOK_SECRET`; validar evento antes de atualizar DB; idempotência no handler |
| E-mails de notificação marcados como spam | Médio | Médio | Domínio de envio com SPF/DKIM/DMARC configurados no Resend; frequência limitada (1 resumo/dia + alertas pontuais); link de descadastro em todos os e-mails |
| Workers demoram mais que 24h para processar todos os usuários | Baixo | Médio | Concorrência configurável no BullMQ; filas separadas por prioridade de plano (Pro > Plus > Free); timeout por job de 10 min |

---

## 13. Roadmap de MVP

### Fase 1 — Fundação (Semanas 1–2)
- [ ] Setup do projeto: Next.js 14, Prisma, Supabase, Clerk, Tailwind, Shadcn/ui, next-intl
- [ ] Migrations do banco de dados (User, Skill, Job, Application, ApplicationLog)
- [ ] Integração Clerk (auth + webhook de sincronização)
- [ ] Supabase Storage: bucket `cvs/` e `screenshots/` com RLS
- [ ] tRPC setup com routers `user`, `application`, `billing`

### Fase 2 — Core do Produto (Semanas 3–4)
- [ ] Página de Perfil: formulário + skills tags + upload CV + notificações + filtros excludentes
- [ ] Dashboard: métricas + timeline + toggle pausar automação
- [ ] Página de Vagas: listagem + filtros + barra de match score + badge de tipo
- [ ] Modal de detalhe de candidatura com timeline de `ApplicationLog` e screenshots
- [ ] Setup Redis + BullMQ no Railway/Fly.io
- [ ] Worker `matching`: algoritmo de scoring + filtros excludeCompanies/minSalary

### Fase 3 — Automação (Semanas 5–6)
- [ ] Worker `scraper`: Playwright anônimo + proxies Bright Data + fingerprint randomizado + fallback Guest API
- [ ] Worker `apply`: Easy Apply (modal LinkedIn) + External forms (heurísticas) + fallback FORM_NOT_SUPPORTED
- [ ] Captura de screenshots e upload para Supabase Storage
- [ ] Cron diário: disparo às 08h00 BRT com respeito a `automationPaused`
- [ ] Integração Resend: resumo diário + alertas VIEWED/FAILED

### Fase 4 — Monetização (Semana 7)
- [ ] Integração Stripe: Checkout + Webhooks
- [ ] Página de Planos: 3 cards de pricing
- [ ] Lógica de quota por plano (Free/Plus/Pro)
- [ ] Proteção de rotas por plano

### Fase 5 — Go-to-market (Semana 8)
- [ ] Landing page: hero + como funciona + stats + CTA
- [ ] Testes E2E do pipeline completo
- [ ] Configuração de domínio e SSL
- [ ] Deploy final: Vercel (frontend) + Railway (workers)

---

## 14. Decisões Técnicas Resolvidas

As questões em aberto originais foram todas decididas. Este seção documenta as decisões para referência futura.

| # | Questão | Decisão |
|---|---------|---------|
| 1 | **Autenticação no LinkedIn** | Scraping 100% anônimo. Sem credenciais do usuário. Worker usa sessões anônimas Playwright + proxies residenciais rotativos (Bright Data/Oxylabs), fingerprint randomizado por sessão, backoff exponencial em bloqueio, fallback para LinkedIn Jobs Guest API. |
| 2 | **Easy Apply vs formulários externos** | MVP cobre ambos. Easy Apply preenche modal LinkedIn. Formulários externos usam heurísticas (label/name/id). Se mapeamento < 70% campos obrigatórios → `FAILED` com `failReason = FORM_NOT_SUPPORTED` e `directUrl` para candidatura manual. |
| 3 | **Notificações** | E-mail via Resend: resumo diário pós-pipeline, alerta VIEWED em tempo real, alerta FAILED com link manual. Push e in-app reservados para v2. Preferências configuráveis individualmente. |
| 4 | **Múltiplos CVs** | 1 PDF por usuário no MVP. Upload substitui anterior. v2 terá model `CV` com `id / userId / label / url / isDefault / targetRole`. |
| 5 | **Internacionalização** | Interface, e-mails e erros exclusivamente em pt-BR no MVP. Estrutura via `next-intl` com strings em arquivo de mensagens para facilitar futura expansão. |
| 6 | **Modo manual / aprovação prévia** | Automação totalmente automática com log transparente (timestamp + vaga + status + screenshot). Toggle pausar/retomar no dashboard. Filtros excludentes por empresa e salário mínimo. Modo "revisar antes de enviar" reservado para v2 no plano Pro. |
