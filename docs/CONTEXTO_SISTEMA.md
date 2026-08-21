# Contexto do Sistema (Backend)

Este documento serve como a **Memória Central** para os desenvolvedores e para a IA entenderem o fluxo do projeto.

## A Grande Missão
Migrar a API (antiga Node.js) para **Java com Spring Boot**, utilizando **Clean Architecture**. O objetivo principal não é apenas funcionar, mas isolar completamente o Domínio de Negócios (regras puras) da Infraestrutura (Spring, Banco de Dados, Web).

## Estrutura de Camadas (Clean Architecture)
Toda feature DEVE respeitar estas 4 camadas, de dentro pra fora:
- **`domain`**: Entidades puras (POJOs sem anotações JPA). Interfaces de repositório (contratos).
- **`application`**: Services com regras de negócio. Usam apenas as interfaces do domain.
- **`infrastructure`**: Entidades JPA (`@Entity`), repositórios Spring Data, adaptadores que implementam os contratos do domain.
- **`presentation`**: Controllers REST (`@RestController`), DTOs de request/response, validações (`@Valid`).

## A Base Fundacional (Feita pelo PM Gustavo)
Antes do time começar, o PM criou o esqueleto inicial do projeto:
- **Setup Spring Boot (B1):** Projeto Maven com Java 17, dependências configuradas, estrutura de pacotes criada.
- **Domínio Base (B2):** Classes de domínio puro (`Task`, `Board`, `DiscordUser`) e interfaces de repositório. Essas classes são o "contrato" que todo o time vai usar.

## A Jornada de Construção (Fatiamento Vertical por Feature)
Cada desenvolvedor pega uma **feature completa** e a implementa de ponta a ponta (Controller → Service → Banco). Isso permite que todos trabalhem em paralelo sem um bloquear o outro.

### FEAT-01: CRUD de Tasks (Criar, Listar, Editar, Deletar)
- **Problema:** Sem tasks, não existe Kanban. É o coração do sistema.
- **O que faz:** Cria o fluxo completo de uma tarefa: endpoint para criar, listar todas, buscar por ID, atualizar campos e deletar.
- **Camadas envolvidas:** Controller (`TaskController`) → Service (`TaskService`) → Adapter → JPA Entity (`TaskEntity`).
- **Pré-requisito:** O domínio base (classe `Task` e `TaskRepositoryInterface`) já deve estar no repositório.

### FEAT-02: Mover Task de Fase (Transição de Coluna)
- **Problema:** No Kanban, arrastar um card de "A Fazer" para "Em Progresso" é a ação mais importante.
- **O que faz:** Cria o endpoint `PATCH /api/tasks/{id}/move` que recebe a nova fase e aplica regras de validação (ex: não pular fases, registrar log de movimentação).
- **Camadas envolvidas:** Controller → Service (com regra de negócio pesada) → Adapter → JPA.
- **Pré-requisito:** FEAT-01 precisa existir (a task precisa estar salva no banco para ser movida).

### FEAT-03: Gestão de Boards (Quadros)
- **Problema:** O sistema suporta múltiplos quadros Kanban. Precisamos criar, listar e associar tasks a boards.
- **O que faz:** Cria o CRUD de `Board` e o relacionamento entre `Board` e `Task`.
- **Camadas envolvidas:** `BoardController` → `BoardService` → Adapter → `BoardEntity`.
- **Pré-requisito:** Nenhum além do domínio base.

### FEAT-04: Autenticação e Usuários Discord
- **Problema:** Os usuários logam via Discord OAuth2. Precisamos salvar e gerenciar os perfis.
- **O que faz:** Cria o fluxo de login com Discord, salva o `DiscordUser` no banco, gera JWT para sessão.
- **Camadas envolvidas:** `AuthController` → `AuthService` → `DiscordUserAdapter` → `DiscordUserEntity`.
- **Pré-requisito:** Nenhum além do domínio base.

### FEAT-05: Webhook e Notificações (Discord Bot)
- **Problema:** Quando algo acontece no Kanban (task criada, movida), o bot do Discord precisa ser notificado.
- **O que faz:** Cria o `DiscordWebhookService` na camada `infrastructure` que dispara HTTP para a porta 3005 do bot. Integra esse serviço nos fluxos de FEAT-01 e FEAT-02.
- **Camadas envolvidas:** `infrastructure/external` (RestClient/WebClient para chamar o bot).
- **Pré-requisito:** FEAT-01 e FEAT-02 (precisa ter eventos para notificar).

## Regra de Ouro
> Cada dev fura o bolo inteiro de cima a baixo (Controller → Service → Banco) da SUA feature. Ninguém fica "dono" de uma camada. Todos tocam em todas as camadas, mas cada um na sua feature.
