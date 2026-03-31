# Plan: OAuth2 Authentication (Google + GitHub)

## TL;DR

Criar autenticação OAuth2 com provedores Google e GitHub em um projeto **Next.js novo** usando **Auth.js v5** (NextAuth) com **MongoDB** como banco de dados. Auth.js é o padrão de mercado para autenticação em Next.js, com suporte nativo a Google e GitHub, App Router, e adaptador oficial para MongoDB.

---

## Decisões Técnicas

- **Auth Library**: Auth.js v5 (NextAuth.js) — padrão de mercado para Next.js, suporte nativo aos provedores solicitados
- **Router**: App Router (Next.js 14+) — abordagem moderna com route handlers
- **Session Strategy**: JWT — mais simples, sem necessidade de queries ao banco para validar sessões
- **Database Adapter**: `@auth/mongodb-adapter` — persiste usuários, contas e sessões no MongoDB
- **Escopo**: Apenas login social (Google + GitHub), sem email/senha

---

## Steps

### Fase 1: Setup do Projeto

1. **Inicializar projeto Next.js** com App Router, TypeScript, Tailwind CSS
   - `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir`

2. **Instalar dependências de autenticação**
   - `npm install next-auth@beta @auth/mongodb-adapter mongodb`
   - `next-auth@beta` = Auth.js v5 (versão estável para App Router)

3. **Configurar variáveis de ambiente** — criar `.env.local`:
   - `AUTH_SECRET` (gerar com `npx auth secret`)
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
   - `MONGODB_URI`

4. **Criar `.env.example`** — documentar todas variáveis necessárias (sem valores reais)

### Fase 2: Infraestrutura (MongoDB + Auth.js)

5. **Criar lib de conexão MongoDB** — `src/lib/mongodb.ts`
   - Singleton de `MongoClient` com reuso em dev (via `global`)
   - Pattern padrão do adaptador oficial

6. **Configurar Auth.js** — `src/auth.ts` (arquivo raiz de config)
   - Exportar `handlers`, `signIn`, `signOut`, `auth`
   - Configurar providers: `Google` e `GitHub`
   - Configurar adapter: `MongoDBAdapter(clientPromise)`
   - Session strategy: `jwt`
   - Callbacks: `session` (incluir `userId` no token/session)
   - Pages customizadas (opcional): `signIn: "/login"`

7. **Criar route handler** — `src/app/api/auth/[...nextauth]/route.ts`
   - Exportar `GET` e `POST` dos handlers do Auth.js

8. **Criar proxy de proteção** — `src/proxy.ts`
   - Exportar `auth` como proxy padrão do Auth.js v5
   - Configurar `matcher` para rotas protegidas (ex: `/dashboard/:path*`)

### Fase 3: UI de Autenticação

9. **Criar SessionProvider wrapper** — `src/components/providers/session-provider.tsx`
   - Client component que envolve `SessionProvider` do next-auth/react

10. **Atualizar layout raiz** — `src/app/layout.tsx`
    - Envolver children com `SessionProvider`

11. **Criar página de login** — `src/app/login/page.tsx`
    - Botão "Entrar com Google" (ícone + texto)
    - Botão "Entrar com GitHub" (ícone + texto)
    - Usar `signIn("google")` e `signIn("github")` do next-auth/react
    - Redirect para `/dashboard` após login

12. **Criar componente de header com estado de auth** — `src/components/header.tsx`
    - Exibir nome/avatar do usuário quando logado
    - Botão de logout (`signOut()`)
    - Link para login quando deslogado

13. **Criar página protegida de exemplo** — `src/app/dashboard/page.tsx`
    - Exibir dados do usuário da sessão
    - Demonstrar acesso a `session.user` (nome, email, imagem)

14. **Criar página inicial** — `src/app/page.tsx`
    - Hero simples com link para login/dashboard

### Fase 4: Segurança e Polimento

15. **Configurar CSRF** — Auth.js v5 já inclui proteção CSRF nativa

16. **Adicionar tipagem TypeScript** — `src/types/next-auth.d.ts`
    - Extender tipos de `Session` e `JWT` se necessário (ex: `userId`)

17. **Criar `.gitignore` adequado** — garantir que `.env.local` está listado

---

## Relevant Files

- `src/lib/mongodb.ts` — singleton de conexão MongoDB (reusável em dev/prod)
- `src/auth.ts` — configuração central Auth.js com providers Google/GitHub e MongoDBAdapter
- `src/app/api/auth/[...nextauth]/route.ts` — route handler do Auth.js
- `src/proxy.ts` — proxy de proteção de rotas
- `src/components/providers/session-provider.tsx` — wrapper do SessionProvider
- `src/app/layout.tsx` — layout raiz com SessionProvider
- `src/app/login/page.tsx` — página de login com botões Google/GitHub
- `src/components/header.tsx` — header com estado de autenticação
- `src/app/dashboard/page.tsx` — página protegida de exemplo
- `src/app/page.tsx` — página inicial
- `src/types/next-auth.d.ts` — extensão de tipos TypeScript
- `.env.local` — variáveis de ambiente (secrets)
- `.env.example` — template de variáveis de ambiente

---

## Verification

1. **Login Google**: clicar "Entrar com Google" → redireciona para consent screen → volta logado com nome/email/avatar
2. **Login GitHub**: clicar "Entrar com GitHub" → redireciona para GitHub auth → volta logado com nome/email/avatar
3. **Sessão persistida**: recarregar página → continua logado
4. **Logout**: clicar logout → sessão destruída, redirecionado para home
5. **Rota protegida**: acessar `/dashboard` sem login → redirecionado para `/login`
6. **MongoDB**: verificar no banco que collections `users`, `accounts`, `sessions` foram criadas
7. **CSRF**: Auth.js v5 protege automaticamente; verificar que token CSRF está presente nos forms
8. **Build**: `npm run build` passa sem erros

---

## Pré-requisitos do Usuário (fora do escopo de implementação)

- **Google Cloud Console**: criar projeto, habilitar Google OAuth, criar credenciais OAuth2 (client ID + secret), configurar redirect URI: `http://localhost:3000/api/auth/callback/google`
- **GitHub Developer Settings**: criar OAuth App, obter Client ID + Secret, configurar callback URL: `http://localhost:3000/api/auth/callback/github`
- **MongoDB**: ter instância rodando (Atlas ou local), obter connection string

---

## Decisões

- Auth.js v5 (beta) escolhido por ser a versão com suporte nativo a App Router — é estável para produção apesar do rótulo "beta"
- JWT como session strategy para simplicidade (sem query ao banco a cada request)
- MongoDBAdapter ainda persiste users/accounts para linking de providers
- Sem email/senha — escopo restrito a login social conforme solicitado
- Sem testes automatizados nesta fase — pode ser adicionado depois
