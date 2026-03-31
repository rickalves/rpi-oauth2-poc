# rpi-oauth2-poc

POC que demonstra o uso do workflow **RPI** (Research → Plan → Implement) com agentes de IA para desenvolver um sistema de autenticação OAuth2 com Google e GitHub.

---

## O que é esta POC

Dois objetivos em um único repositório:

1. **Produto**: sistema de autenticação OAuth2 (Google + GitHub) construído com Next.js, Auth.js v5 e MongoDB
2. **Metodologia**: demonstrar como o workflow RPI + agentes Claude acelera o desenvolvimento com qualidade e rastreabilidade

---

## Stack do Produto

| Camada         | Tecnologia                        |
| -------------- | --------------------------------- |
| Framework      | Next.js 16.2 (App Router)         |
| Autenticação   | Auth.js v5 (NextAuth)             |
| Banco de dados | MongoDB + `@auth/mongodb-adapter` |
| Linguagem      | TypeScript                        |
| Estilo         | Tailwind CSS 4                    |
| Provedores     | Google OAuth2, GitHub OAuth       |

---

## Workflow RPI

```
Request → /rpi:research → /rpi:plan → /rpi:implement
```

| Fase      | Comando           | Output                                      |
| --------- | ----------------- | ------------------------------------------- |
| Request   | (descrição livre) | `rpi/{feature}/REQUEST.md`                  |
| Research  | `/rpi:research`   | `research/RESEARCH.md` + veredicto GO/NO-GO |
| Plan      | `/rpi:plan`       | `plan/PLAN.md`, `pm.md`, `ux.md`, `eng.md`  |
| Implement | `/rpi:implement`  | código + `implement/IMPLEMENT.md`           |

Todos os artefatos de cada feature ficam em `rpi/{feature-slug}/`.

---

## Estrutura do Repositório

```
.claude/
├── agents/          # Agentes especializados (product-manager, senior-software-engineer, etc.)
└── commands/rpi/    # Comandos /rpi:research, /rpi:plan, /rpi:implement
rpi/
└── oauth2-authentication/
    ├── REQUEST.md               # Descrição e decisões técnicas
    ├── research/
    │   └── RESEARCH.md          # Análise de viabilidade (veredicto: GO)
    ├── plan/
    │   ├── PLAN.md              # Plano de implementação (17 tarefas, 4 fases)
    │   ├── pm.md                # Requisitos e histórias de usuário
    │   ├── ux.md                # Fluxos e especificações de UI
    │   └── eng.md               # Arquitetura técnica e especificações de componentes
    └── implement/
        └── IMPLEMENT.md         # Log de implementação e arquivos criados
src/
├── auth.ts                      # Config central Auth.js (providers, adapter, callbacks)
├── proxy.ts                     # Edge proxy — proteção de rotas (/dashboard)
├── lib/
│   └── mongodb.ts               # Singleton MongoClient
├── types/
│   └── next-auth.d.ts           # Augmentações TypeScript (Session.user.id, JWT)
├── app/
│   ├── api/auth/[...nextauth]/  # Route handler Auth.js
│   ├── login/page.tsx           # Página de login pública
│   ├── dashboard/page.tsx       # Página protegida (Server Component)
│   ├── layout.tsx               # Layout raiz com SessionProvider
│   └── page.tsx                 # Landing page
└── components/
    ├── header.tsx               # Header com estado de autenticação
    └── providers/
        └── session-provider.tsx # Wrapper 'use client' do SessionProvider
tests/
└── phase1/
    └── setup.test.ts            # 24 testes de aceitação (Fase 1) — todos passando
rpi-workflow.md                      # Documentação do workflow RPI
```

---

## Pré-requisitos

Antes de rodar o projeto, você precisa de:

- **Google Cloud Console** — criar credenciais OAuth2, adicionar redirect URI:
  `http://localhost:3000/api/auth/callback/google`
- **GitHub Developer Settings** — criar OAuth App, adicionar callback URL:
  `http://localhost:3000/api/auth/callback/github`
- **MongoDB** — instância local ou Atlas, obter connection string

---

## Configuração

```bash
# 1. Instalar dependências
npm install

# 2. Copiar template de variáveis de ambiente
cp .env.example .env.local

# 3. Preencher .env.local com suas credenciais
# AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET,
# AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONGODB_URI

# 4. Rodar em desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.

---

## Status

### Workflow RPI

| Fase RPI  | Status                         |
| --------- | ------------------------------ |
| Request   | ✅ Concluído                   |
| Research  | ✅ Concluído — Veredicto: GO   |
| Plan      | ✅ Concluído                   |
| Implement | ✅ Concluído — 17/17 tarefas   |

### Qualidade (oauth2-authentication)

| Gate                              | Resultado                    |
| --------------------------------- | ---------------------------- |
| TypeScript (`npm run type-check`) | ✅ 0 erros                    |
| Lint (`npm run lint`)             | ✅ 0 erros, 0 warnings        |
| Format (`npm run format:check`)   | ✅ Todos os arquivos formatados |
| Testes Fase 1 (`npm test`)        | ✅ 24/24 passando             |
| Testes Fase 2–4                  | ⏳ Pendente                   |
