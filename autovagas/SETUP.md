# AutoVagas — Setup Local

## Status atual

### Concluído
- [x] `.env.local` — variáveis de ambiente criadas (Supabase preenchido)
- [x] `middleware.ts` — proteção de rotas ativa (redireciona para `/sign-in` se não logado)
- [x] `workers/index.ts` — entry point que inicia todos os BullMQ workers
- [x] `package.json` — script `npm run workers` adicionado, `tsx` e `dotenv` instalados
- [x] Dependências não utilizadas removidas (`@clerk/nextjs`, `svix`, `@libsql/client`, `@prisma/adapter-libsql`, `better-sqlite3`, `@electric-sql/pglite*`)

### Pendente
- [x] **Redis** — rodando via Docker (`docker run -d --name redis -p 6379:6379 redis:alpine`)
- [ ] **Stripe** — preencher as 4 variáveis no `.env.local`

---

## 1. Instalar Redis

### Opção A — Docker (recomendado)
```bash
# Instale o Docker Desktop: https://www.docker.com/products/docker-desktop
docker run -d --name redis -p 6379:6379 redis:alpine
```

### Opção B — Memurai (Redis nativo para Windows, sem Docker)
Baixe em: https://www.memurai.com/get-memurai
Instala como serviço Windows e já roda na porta 6379.

---

## 2. Configurar Stripe

No `.env.local`, preencha:
```
STRIPE_SECRET_KEY=sk_test_...         # dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=whsec_...       # dashboard.stripe.com/webhooks
STRIPE_PRICE_PLUS=price_...           # dashboard.stripe.com/products
STRIPE_PRICE_PRO=price_...
```

Para testar webhooks localmente:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 3. Rodar o projeto

Com Redis rodando, abra dois terminais:

```bash
# Terminal 1 — app Next.js
npm run dev

# Terminal 2 — workers BullMQ (scraper, matching, apply, cron)
npm run workers
```

---

## Fluxo de automação

```
Cron (08:00 BRT)
  └─> scraperQueue  — busca vagas no LinkedIn por desiredRole
        └─> matchingQueue — filtra por skills/salário/empresa, calcula score
              └─> applyQueue — preenche formulários e candidata
                    └─> Email (Resend) — resumo diário + alertas de falha
```

O cron só dispara para usuários com:
- `automationPaused = false`
- CV enviado (`cvUrl` preenchido)
- Pelo menos 3 skills cadastradas
- Cota diária não atingida (`dailyQuota`: FREE=1, PLUS=10, PRO=20)
