# PRD: Pipeline Agendada por Usuário + Correções de Incoerências

## Introduction

Substituir a lógica de busca fixa em 08:00 BRT por um sistema de agendamento individual por usuário, onde cada pessoa define dias da semana e horário em que o sistema executa automaticamente o pipeline de busca de vagas. O fluxo manual via botão é mantido, com restrições por plano. Além disso, corrigir as incoerências identificadas na codebase que afetam corretude, manutenibilidade e experiência do usuário.

---

## Goals

- Cada usuário define seu próprio horário de execução automática (dias da semana + hora)
- Um cron global roda a cada hora e dispara o pipeline apenas para usuários cujo horário bate
- Botão de execução manual permanece disponível, com cota compartilhada para FREE e ilimitada para planos pagos
- As configurações de agendamento ficam no dashboard, junto ao toggle de automação
- Corrigir todos os bugs e más práticas identificadas sem quebrar funcionalidades existentes

---

## User Stories

### US-001: Adicionar campos de agendamento ao modelo de dados

**Description:** As a developer, I need to persist the user's scheduled days and time so the cron can check who should run at each hour.

**Acceptance Criteria:**
- [ ] Adicionar campo `scheduleDays Int[]` ao modelo `User` no `prisma/schema.prisma` (valores: 0=Dom, 1=Seg, ..., 6=Sáb; default `[1,2,3,4,5]`)
- [ ] Adicionar campo `scheduleTime String?` ao modelo `User` (formato `"HH:MM"` no fuso BRT, ex: `"08:00"`)
- [ ] Gerar e aplicar migration com `npx prisma migrate dev --name add-schedule-fields`
- [ ] Typecheck passa (`npx tsc --noEmit`)

---

### US-002: Endpoints TRPC para salvar configuração de agendamento

**Description:** As a user, I want to save my preferred schedule so the system knows when to run automatically.

**Acceptance Criteria:**
- [ ] Criar mutation `user.updateSchedule` em `server/routers/user.ts`
- [ ] Input validado com Zod: `{ scheduleDays: z.array(z.number().min(0).max(6)), scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).nullable() }`
- [ ] Retorna perfil atualizado
- [ ] Typecheck passa

---

### US-003: UI de agendamento no Dashboard

**Description:** As a user, I want to configure my automation schedule from the dashboard so I can control when the system searches for jobs.

**Acceptance Criteria:**
- [ ] Adicionar seção "Agendamento" no dashboard (`app/dashboard/page.tsx`) abaixo do toggle de automação existente
- [ ] Exibir seletor de dias da semana com 7 botões toggle (Dom–Sáb), multi-seleção, com estilo consistente com o restante da UI (fundo `#1a1a1a`, accent `#b5ff4e`)
- [ ] Exibir input de hora tipo `<input type="time">` para definir o horário
- [ ] Exibir badge indicativo: "Próxima execução: seg, 14/04 às 08:00" (calculado no frontend)
- [ ] Botão "Salvar agendamento" chama `user.updateSchedule`
- [ ] Toast de sucesso/erro após salvar
- [ ] Campos desabilitados quando `automationPaused = true`
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

---

### US-004: Substituir cron fixo por cron horário com verificação de agenda

**Description:** As a developer, I need to replace the fixed daily cron with an hourly cron that dispatches only users whose schedule matches the current time.

**Acceptance Criteria:**
- [ ] Alterar `workers/cron.ts`: trocar expressão `0 11 * * *` por `0 * * * *` (toda hora em ponto)
- [ ] Na lógica de seleção de usuários, filtrar apenas usuários onde:
  - `scheduleTime` não é null
  - O dia da semana atual (em BRT) está em `scheduleDays`
  - A hora atual (em BRT) bate com a hora em `scheduleTime` (comparar `HH:MM`)
- [ ] Manter todos os outros filtros existentes: `cvUrl`, `automationPaused`, skills >= 3, quota diária
- [ ] Criar helper `getCurrentBRTTime(): { hour: string, dayOfWeek: number }` em `lib/timezone.ts` para centralizar a lógica de timezone BRT (UTC-3), eliminando a duplicação entre `cron.ts` e `application.ts`
- [ ] Substituir cálculo inline de BRT em ambos os arquivos pelo novo helper
- [ ] Typecheck passa

---

### US-005: Controle de cota para execução manual por plano

**Description:** As a user on a paid plan, I want to be able to trigger the pipeline manually at any time, while free users are limited to once per day.

**Acceptance Criteria:**
- [ ] Em `server/routers/application.ts`, na mutation `triggerPipeline`:
  - Se `user.plan === 'FREE'`: manter restrição existente de 1x/dia via `lastPipelineRunAt`
  - Se `user.plan === 'PLUS'` ou `'PRO'`: permitir execução manual sem restrição de tempo
- [ ] No dashboard, o botão "Buscar Vagas" exibe tooltip diferente por plano:
  - FREE: "Busca manual (1x por dia)"
  - PLUS/PRO: "Buscar vagas agora"
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

---

### US-006: Extrair constante PLANS para fonte única

**Description:** As a developer, I need a single source of truth for plan definitions to avoid divergence between the billing router and landing page.

**Acceptance Criteria:**
- [ ] Criar arquivo `lib/plans.ts` com o array `PLANS` (FREE/PLUS/PRO com quotas, preços e features)
- [ ] Remover definição duplicada de `app/page.tsx` e importar de `lib/plans.ts`
- [ ] Remover definição duplicada de `server/routers/billing.ts` e importar de `lib/plans.ts`
- [ ] Typecheck passa

---

### US-007: Corrigir lógica duplicada de matching de skills

**Description:** As a developer, I need to eliminate duplicated skill-matching code in the matching worker to avoid maintenance bugs.

**Acceptance Criteria:**
- [ ] Em `workers/matching.ts`, extrair o cálculo de `skillsMatched`/`skillsMissed` para uma função `calculateSkillMatch(userSkills: string[], requirements: string[]): { matched: string[], missed: string[], score: number }`
- [ ] Substituir as duas ocorrências duplicadas (linhas ~72-75 e ~96-102) pela chamada à nova função
- [ ] Resultado idêntico ao comportamento atual
- [ ] Typecheck passa

---

### US-008: Adicionar limite de paginação em ApplicationLog

**Description:** As a developer, I need to cap the ApplicationLog query to prevent slow responses when an application accumulates hundreds of log entries.

**Acceptance Criteria:**
- [ ] Em `server/routers/application.ts`, na query `getLogs`, adicionar `take: 100` e `orderBy: { createdAt: 'desc' }`
- [ ] Se houver mais de 100 registros, retornar os 100 mais recentes
- [ ] Typecheck passa

---

### US-009: Adicionar middleware de autenticação de rotas

**Description:** As a developer, I need a Next.js middleware to redirect unauthenticated users who try to access protected routes directly.

**Acceptance Criteria:**
- [ ] Criar `middleware.ts` na raiz do projeto Next.js
- [ ] Rotas protegidas: `/dashboard`, `/vagas`, `/perfil`, `/planos`
- [ ] Verificar sessão Supabase; se ausente, redirecionar para `/sign-in`
- [ ] Rotas públicas (`/`, `/sign-in`, `/sign-up`, `/api/**`) não são afetadas
- [ ] Typecheck passa

---

### US-010: Adicionar error boundaries nas páginas protegidas

**Description:** As a user, I should see a friendly error message instead of a crashed blank page if something fails.

**Acceptance Criteria:**
- [ ] Criar `app/dashboard/error.tsx`, `app/vagas/error.tsx`, `app/perfil/error.tsx` com componente `ErrorBoundary` padrão do Next.js App Router
- [ ] Exibir mensagem em português: "Algo deu errado. Tente recarregar a página."
- [ ] Botão "Recarregar" que chama `reset()`
- [ ] Estilo consistente com a UI existente (dark theme)
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

---

### US-011: Corrigir falha silenciosa no envio de e-mails

**Description:** As a developer, I need email send failures to be logged so we can detect and diagnose notification issues.

**Acceptance Criteria:**
- [ ] Em `lib/email.ts`, no bloco `catch`, adicionar `console.error('[email] Failed to send:', template, error)` antes de retornar
- [ ] Em `workers/apply.ts`, substituir chamadas `void sendEmail(...)` por `await sendEmail(...).catch(err => console.error('[apply] email failed:', err))`
- [ ] Typecheck passa

---

## Functional Requirements

- **FR-1:** O modelo `User` deve conter `scheduleDays: Int[]` (default `[1,2,3,4,5]`) e `scheduleTime: String?`
- **FR-2:** A mutation `user.updateSchedule` valida e persiste `scheduleDays` e `scheduleTime`
- **FR-3:** O cron global executa a cada hora em ponto (`0 * * * *`)
- **FR-4:** O cron filtra usuários cujo `scheduleTime` bate com a hora atual em BRT e cujo dia da semana atual está em `scheduleDays`
- **FR-5:** Todos os outros critérios de elegibilidade existentes (`cvUrl`, `automationPaused`, skills >= 3, quota) permanecem
- **FR-6:** O helper `getCurrentBRTTime()` em `lib/timezone.ts` centraliza conversão de timezone BRT para todo o sistema
- **FR-7:** Plano FREE: execução manual limitada a 1x/dia. Planos PLUS/PRO: execuções manuais ilimitadas
- **FR-8:** Dashboard exibe seção "Agendamento" com seletor de dias e input de hora, desabilitado quando automação pausada
- **FR-9:** A constante `PLANS` tem fonte única em `lib/plans.ts`
- **FR-10:** `getLogs` retorna no máximo 100 registros, os mais recentes
- **FR-11:** `middleware.ts` protege rotas `/dashboard`, `/vagas`, `/perfil`, `/planos` com redirecionamento para `/sign-in`
- **FR-12:** Páginas protegidas têm `error.tsx` com UI de fallback amigável
- **FR-13:** Falhas no envio de e-mail são logadas via `console.error` (sem travar o worker)

---

## Non-Goals

- Múltiplos horários por dia (ex: "08:00 e 18:00") — fora de escopo desta versão
- Notificações push ou in-app quando o pipeline for executado
- Histórico de execuções agendadas no dashboard
- Configuração de fuso horário por usuário (assumir sempre BRT/UTC-3)
- Implementação de webhooks do LinkedIn para status "Viewed"
- Implementação do webhook do Stripe (já documentado como pendente no SETUP.md)

---

## Design Considerations

- A seção "Agendamento" no dashboard deve ser inserida imediatamente após o card de toggle de automação existente
- Usar o mesmo padrão visual das outras seções: card com fundo `#1a1a1a`, bordas `#2a2a2a`, texto `#e5e5e5`, accent `#b5ff4e` para seleção ativa
- Os botões de dias da semana devem ser compactos (ex: "Seg", "Ter", ...) com estado ativo destacado
- O badge "Próxima execução" pode ser calculado no frontend com base nos campos `scheduleDays` e `scheduleTime`
- Campos desabilitados (quando `automationPaused = true`) devem ter opacidade reduzida e cursor `not-allowed`

---

## Technical Considerations

- **BullMQ repeatable job:** Ao alterar a cron expression de `0 11 * * *` para `0 * * * *`, é necessário remover o job repetível antigo do Redis antes de adicionar o novo, ou o BullMQ manterá os dois. Usar `queue.removeRepeatable()` com o jobId `daily-pipeline` antes de adicionar o novo.
- **Timezone helper:** `lib/timezone.ts` deve usar `Intl.DateTimeFormat` ou cálculo manual (UTC - 3h) sem dependência de bibliotecas externas para manter o bundle leve.
- **Prisma `Int[]`:** O tipo array de inteiros é suportado nativamente pelo provider PostgreSQL no Prisma. Não requer extensão adicional.
- **Middleware Next.js + Supabase SSR:** Usar `createServerClient` do `@supabase/ssr` no middleware, conforme padrão já usado em `lib/supabase-server.ts`.
- **Ordem de implementação recomendada:** US-001 → US-004 (backend) → US-002 → US-005 → US-006 → US-007 → US-008 → US-009 → US-011 (fixes) → US-003 → US-010 (frontend)

---

## Success Metrics

- Usuários conseguem configurar e salvar agendamento em menos de 3 interações
- Cron horário dispara corretamente apenas para usuários com agendamento no horário atual
- Planos PLUS/PRO não são bloqueados ao clicar em "Buscar Vagas" mais de uma vez por dia
- Nenhuma regressão nas funcionalidades existentes (matching, apply, dashboard stats)
- Zero erros TypeScript em `npx tsc --noEmit`

---

## Decisions (Open Questions Resolved)

- **Granularidade do horário:** Apenas horas cheias. `scheduleTime` aceita somente valores `"HH:00"`. O `<input type="time">` no frontend deve ter `step="3600"` para forçar seleção em hora cheia.
- **Horário padrão:** Ao criar o perfil ou acessar a seção de agendamento pela primeira vez (sem `scheduleTime` definido), pré-popular com `scheduleDays = [1,3,5]` (seg/qua/sex) e `scheduleTime = "08:00"`. O usuário ainda precisa clicar em "Salvar agendamento" para persistir.
- **FREE sem agendamento:** A execução automática só ocorre se `scheduleTime` estiver definido. Se o usuário FREE nunca configurar um horário, o pipeline **não** roda automaticamente.
