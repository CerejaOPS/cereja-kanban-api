# 🍒 Cereja Kanban API

A API REST oficial do ecossistema Cereja. Responsável por toda a lógica de negócio do sistema Kanban, integração com o banco de dados e comunicação em tempo real com o Frontend e o Bot do Discord.

## 🛠️ Tecnologias Principais

*   **Linguagem:** Java 17+
*   **Framework:** Spring Boot 3.x
*   **Banco de Dados:** PostgreSQL (via Spring Data JPA / Hibernate)
*   **Migrações:** Flyway
*   **Documentação:** Swagger / springdoc-openapi
*   **Containerização:** Docker Compose (PostgreSQL)

## 🏗️ Arquitetura

Este projeto segue o padrão **Clean Architecture**, dividido em camadas:

```text
src/main/java/com/cereja/api/
 ├── controller/       → @RestController (recebe requisições HTTP)
 ├── service/          → @Service (regras de negócio / Use Cases)
 ├── repository/       → @Repository (acesso ao banco de dados)
 ├── model/            → @Entity (entidades do domínio: Task, Phase, Label)
 ├── dto/              → Data Transfer Objects (entrada e saída da API)
 ├── exception/        → AppException + GlobalExceptionHandler
 └── config/           → Configurações (CORS, SSE, Swagger)
```

## 🔌 Integrações

| Integração | Descrição |
| :--- | :--- |
| **SSE (Server-Sent Events)** | Atualiza o quadro Kanban em tempo real para todos os usuários conectados. |
| **Webhooks → Discord Bot** | Dispara notificações HTTP para o Bot sempre que uma task é criada, movida ou concluída. |
| **Swagger UI** | Documentação interativa da API acessível em `/swagger-ui.html`. |

## 🚀 Como Executar Localmente

### Pré-requisitos
*   Java 17+ (JDK)
*   Maven ou Gradle
*   Docker (para subir o PostgreSQL)

### Passo a passo
1. Clone este repositório.
2. Suba o banco de dados com Docker:
   ```bash
   docker compose up -d
   ```
3. Execute a aplicação:
   ```bash
   ./mvnw spring-boot:run
   ```
   Ou, se usar Gradle:
   ```bash
   ./gradlew bootRun
   ```
4. Acesse a documentação da API em `http://localhost:8080/swagger-ui.html`.

## 📂 Referências Internas

*   **`_templates/`** → Contém exemplos didáticos da arquitetura (Entities, Use Cases, Repositories e Routes) que servem como modelo para a equipe.
*   **`docker-compose.yml`** → Sobe uma instância do PostgreSQL 16 automaticamente.

## 🏗️ Padrões da Equipe
Este projeto utiliza **Husky** e **Prettier** (para arquivos de configuração). O código Java deve seguir as convenções padrão do Spring Boot. Certifique-se de ler o arquivo `CONTRIBUTING.md` para entender as regras de pull requests e nomenclatura de branches.
