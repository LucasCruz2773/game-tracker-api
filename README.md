# GameTrack API

Backend REST da aplicação GameTrack. Documentação geral do projeto: [README na raiz](../README.md).

## Stack

- NestJS 12 + TypeScript
- PostgreSQL 18 (Docker)
- Prisma 7
- JWT em cookie httpOnly
- Google OAuth 2.0 (PKCE)
- Integração com catálogo [RAWG](https://rawg.io/apidocs)
- Swagger em `/docs` (desenvolvimento)

## Requisitos

- Node.js **24** (`nvm use` lê `.nvmrc`)
- Docker

## Setup

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:migrate
npm run start:dev
```

Servidor em `http://localhost:3000`.

### Variáveis de ambiente

Veja [`.env.example`](./.env.example). Principais:

- `DATABASE_URL` — deve bater com `POSTGRES_*` do Docker Compose
- `JWT_SECRET` — gere com: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `RAWG_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `FRONTEND_URL` — redirect pós-login

### Banco de dados

```bash
npm run db:up       # sobe Postgres
npm run db:down     # para o container
npm run db:migrate  # aplica migrations
npm run db:studio   # Prisma Studio
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run start:dev` | API com hot reload |
| `npm run build` | Build de produção |
| `npm run start:prod` | Roda `dist/main.js` |
| `npm run test` | Testes unitários |
| `npm run test:e2e` | Testes de integração (API + Postgres) |
| `npm run lint` | Oxlint |

## Módulos

```text
src/
├── auth/       # Google OAuth, JWT, guards
├── users/
├── games/      # busca e detalhes (RAWG + cache local)
├── library/    # biblioteca do usuário
├── reviews/
├── health/
└── common/
```

## Endpoints

| Módulo | Rotas |
| --- | --- |
| Health | `GET /health` |
| Auth | `GET /auth/google`, `GET /auth/google/callback`, `GET /auth/me`, `POST /auth/logout` |
| Games | `GET /games`, `GET /games/:id` |
| Library | `GET/POST /library`, `GET/PATCH/DELETE /library/:gameId`, `GET /library/stats` |
| Reviews | `GET/POST /games/:gameId/reviews`, `GET .../reviews/mine`, `PATCH/DELETE /reviews/:id` |

Autenticação: cookie `gametrack_session` (httpOnly). Endpoints protegidos exigem sessão válida.

## Modelo de dados

Entidades principais: `User`, `Game`, `GameLibrary`, `Review`, `Genre`, `Platform`.

Status da biblioteca: `BACKLOG`, `PLAYING`, `COMPLETED`, `DROPPED`.

Um usuário não pode ter o mesmo jogo duplicado na biblioteca (`unique userId + gameId`). Reviews: uma por usuário por jogo, nota 1–10 (meias estrelas de 0,5 a 5).

Schema: [`prisma/schema.prisma`](./prisma/schema.prisma).

## Testes e2e da API

```bash
npm run test:e2e
```

Usa banco de teste separado. Para servir a API compilada em cenários e2e do frontend:

```bash
npm run e2e:serve
npm run e2e:session -- <username> "<Display Name>"
```

## Produção

1. `npm run build`
2. Defina `NODE_ENV=production` (Swagger fica desabilitado)
3. Configure secrets, `DATABASE_URL` e URLs de OAuth para o domínio real
4. `npm run start:prod`
