# Contexto do Sistema (Backend)

Este documento serve como a **Memória Central** para os desenvolvedores e para a IA entenderem o fluxo do projeto.

## A Grande Missão
Migrar a API (antiga Node.js) para **Java com Spring Boot**, utilizando **Clean Architecture**. O objetivo principal não é apenas funcionar, mas isolar completamente o Domínio de Negócios (regras puras) da Infraestrutura (Spring, Banco de Dados, Web).

## A Jornada de Construção (O Porquê de cada Task)
O desenvolvimento é construído de "dentro para fora". Uma task depende da outra:

### B1. Setup do projeto
- **Problema:** Precisamos de um esqueleto inicial seguro.
- **O que faz:** Cria a estrutura de pastas (domain, application, infrastructure, presentation) para forçar o time a não misturar conceitos.
- **Vem antes de:** Todas as outras.

### B2. Domínio (As regras do jogo)
- **Problema:** O coração do software não pode ser poluído.
- **O que faz:** Criação das entidades `Task`, `Board`, `DiscordUser` como POJOs (Java puro), sem anotação do JPA (`@Entity`). Também define as interfaces dos repositórios (contratos).
- **Vem depois de:** B1. A estrutura deve estar pronta.
- **Vem antes de:** B3 e B4. A aplicação não existe sem o domínio.

### B3. Casos de uso (Application)
- **Problema:** Precisamos da lógica que faz as coisas acontecerem (ex: não permitir transição de fase incorreta).
- **O que faz:** Os `Services` que implementam a regra de negócio orquestrando o domínio e usando os contratos dos repositórios.
- **Meios:** Recebem DTOs e não conhecem Controllers nem Bancos de Dados reais.

### B4. Banco de dados (Infrastructure)
- **Problema:** O sistema precisa salvar dados, mas o domínio não conhece o JPA.
- **O que faz:** Cria as entidades do PostgreSQL (`TaskEntity`), os repositórios reais do Spring Data e as classes `Adapter` que convertem entre o Domínio e o Banco de Dados.
- **Vem depois de:** B2 (As interfaces já devem existir para serem implementadas aqui).

### B5. Controllers e integrações (Presentation)
- **Problema:** O mundo externo (React / Webhooks) precisa conversar com nosso sistema.
- **O que faz:** Recebe JSON, valida (`@Valid`), e repassa para os Casos de Uso (B3). Trata erros para retornar HTTP 400 em vez de 500 genéricos. Integrar chamadas externas pro Discord Bot.
- **Vem depois de:** B3 (A lógica precisa estar lá para o Controller chamar).
