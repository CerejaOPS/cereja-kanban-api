# 🍒 Cereja Kanban — API (Backend)

API REST do Cereja Kanban, construída com **Java 17**, **Spring Boot** e **Clean Architecture**.

## 🏗️ Arquitetura

O projeto segue rigorosamente os princípios da **Clean Architecture**, separando responsabilidades em 4 camadas:

```
src/main/java/com/cereja/kanban/
├── domain/          → Entidades puras (POJOs) e interfaces de repositório
├── application/     → Services com regras de negócio
├── infrastructure/  → Entidades JPA, Adapters, integrações externas
└── presentation/    → Controllers REST e DTOs
```

> **Regra de Ouro:** O `domain` nunca importa nada do Spring ou JPA. As dependências vão de fora para dentro.

## ⚙️ Pré-requisitos

- **Java 17** (ou superior)
- **Maven** (já incluso via `mvnw`)
- **PostgreSQL** rodando na porta 5432
- **Node.js** (necessário apenas para o Husky/Commitlint que valida os commits)

## 🚀 Como rodar o projeto

### 1. Clone o repositório
```bash
git clone https://github.com/CerejaOPS/cereja-kanban-api.git
cd cereja-kanban-api
```

### 2. Troque para a branch de integração
```bash
git checkout rc
git pull origin rc
```

### 3. Configure o banco de dados
Copie o arquivo de ambiente e preencha suas credenciais do PostgreSQL:
```bash
cp .env.example .env
```

### 4. Instale as dependências do Husky (trava de commits)
```bash
npm install
```

### 5. Rode o projeto
```bash
./mvnw spring-boot:run
```
Ou, se estiver no Windows:
```bash
mvnw.cmd spring-boot:run
```

A API estará disponível em `http://localhost:8080`.

## 📐 Padrão de Commits

Este repositório utiliza **Conventional Commits** com validação automática via Husky. Seus commits devem seguir o padrão:

```
feat: adiciona endpoint de criação de tasks
fix: corrige validação de transição de fase
chore: atualiza dependências do pom.xml
docs: atualiza documentação da API
```

## 📚 Documentação Interna

- [`docs/CONTEXTO_SISTEMA.md`](docs/CONTEXTO_SISTEMA.md) — Contexto histórico e mapa das features.
- [`docs/GUIA_USO_IA.md`](docs/GUIA_USO_IA.md) — Como usar a IA (Cursor/Windsurf) corretamente neste projeto.

## 🤝 Contribuindo

1. Puxe a branch mais recente: `git checkout rc && git pull`
2. Crie sua branch: `git checkout -b feat/nome-da-feature`
3. Desenvolva e commite seguindo o padrão.
4. Abra um **Pull Request** apontando para a branch `rc`.
5. Aguarde a aprovação do PM antes de mergear.
