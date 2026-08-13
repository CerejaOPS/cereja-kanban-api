---
name: clean-arch-and-fsd
description: Regras obrigatórias de arquitetura (Clean Architecture no Backend, FSD no Frontend)
trigger: always_on
---

# Regras de Arquitetura (CherDeal Operacional)

Você está trabalhando no projeto CherDeal Operacional. Este projeto está sendo desenvolvido por estudantes universitários, portanto, o código precisa ser legível, bem comentado (JSDoc/TSDoc em pt-BR) e extremamente organizado.

## 1. Frontend (chdeal-frontend)

- O frontend usa **React**, **TypeScript** e **Vite**.
- O padrão arquitetural é o **Feature-Sliced Design (FSD)**.
  - O fluxo de importação deve ser SEMPRE unidirecional: `app -> pages -> features -> entities -> shared`.
  - Uma feature (`features/kanban`) NUNCA pode importar outra feature (`features/profile`). Se precisarem de algo em comum, o código deve ir para `shared/` ou `entities/`.
  - Funções de API (TanStack Query) ficam EXCLUSIVAMENTE dentro das `entities/*/api.ts`. Componentes nunca chamam `fetch` ou `axios` diretamente.
- Use **Shadcn UI** para os componentes base.

## 2. Backend (chdeal-kanban-api)

- O backend usa **Node.js**, **Express** e **PostgreSQL** (com `pg-promise`).
- A arquitetura exigida é a **Clean Architecture**.
  - **NÃO** crie "Rotas Espaguete" (validação, regra de negócio e SQL no mesmo arquivo).
  - Toda regra de negócio vai para `application/use-cases/`.
  - Todo acesso a banco de dados vai para `infrastructure/database/` (Repositories).
  - Toda comunicação com a API do Discord vai para `infrastructure/discord/`.
  - As rotas (`interfaces/http/routes/`) apenas leem a requisição (`req.body`) e chamam o Use Case adequado.
  - Acesse a pasta `_templates/` no backend para ver os moldes.
- Nunca retorne erros crus de banco de dados para o Frontend. Trate no Use Case e retorne `400` ou `500` na rota HTTP.

## 3. Geral

- Sempre que criar uma função complexa, escreva JSDoc/TSDoc em **Português (pt-BR)**.
- Ao usar o terminal, lembre-se que o ambiente atual é Windows (PowerShell).
- Se não souber se uma rota existe, consulte `chdeal-kanban-api/openapi.yaml`.
