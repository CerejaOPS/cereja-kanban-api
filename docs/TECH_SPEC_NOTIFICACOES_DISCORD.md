# 📋 Tech Spec: Notificações de PRs no Discord (Cereja Kanban)

> **Documento:** Technical Specification (Tech Spec) / RFC  
> **Autor:** Gustavo Braga (PM / Tech Lead)  
> **Status:** Aprovado para implementação nas férias de Dezembro  
> **Data de Planejamento:** Outubro/2026  
> **Previsão de Execução:** Início das férias (Dezembro/2026)  

---

## 1. 🎯 Contexto e Motivação

Durante o período letivo, a comunicação da equipe do Cereja Kanban ocorre prioritariamente de forma presencial no ambiente universitário. 

Com a chegada das férias de dezembro:
- O time trabalhará de forma **100% remota e assíncrona**.
- A comunicação oficial do projeto migrará integralmente para o **Discord**.
- Para evitar gargalos e PRs parados esperando revisão, o sistema precisa **notificar o time ativamente no Discord** a cada evento relevante do GitHub.

---

## 2. 🚀 Objetivos da Feature

1. **Notificação de Abertura de PR (`opened`):**
   - Alertar imediatamente os revisores no canal `#pull-requests` do Discord.
   - Fornecer título, autor, branch de origem, branch destino (`rc`) e link direto para o PR.
2. **Notificação de Merge de PR (`merged`):**
   - Comemorar a entrega aprovada na branch `rc`.
   - Dar visibilidade ao progresso da sprint para todo o time.

---

## 3. 🏗️ Arquitetura e Estratégia de Implementação

Adotaremos uma abordagem em **duas fases evolutivas**:

```
[ GitHub Repositories (API & Frontend) ]
             │
             │ Evento de PR (opened / merged)
             ▼
   [ GitHub Actions CI ]  ──────── (Fase 1: Serverless / Imediata)
             │
             │ Webhook com Embed Formatado
             ▼
       [ Discord ] ─── #pull-requests (Notificação do time)
             ▲
             │ (Fase 2: Evolução Integrada)
   [ Cereja API (Spring Boot) ] ─── Sincronização de Boards e Gamificação
```

### 🔹 Fase 1: MVP para as Férias (GitHub Actions + Webhook do Discord)
- **Como funciona:** Um workflow simples de CI/CD que intercepta os eventos de PR e dispara um webhook HTTP com um **Embed rico** para o Discord.
- **Vantagem:** Não depende de infraestrutura ligada nem de servidores públicos. Custo zero e 100% resiliente.

### 🔹 Fase 2: Evolução (Integração Direta com a API Java)
- A API do Cereja Kanban recebe o webhook do GitHub via `POST /api/webhooks/github`.
- Além de avisar no Discord, o backend move o card correspondente no Kanban para "Review" ou "Done" e credita pontos de XP no perfil do `DiscordUser`.

---

## 4. 🎨 Design dos Alertas no Discord (Embeds)

### A. Alerta de Novo PR Aberto
- **Cor da barra lateral:** Laranja / Amarelo Alerta (`#f59e0b`) ou Cereja (`#e11d48`)
- **Título:** `🔔 Novo Pull Request Aberto!`
- **Campos:**
  - **Título da Task:** `FS-03 — Indicadores Visuais nos Cards`
  - **Autor:** `@marcus`
  - **Branches:** `feat/indicadores-visuais` ➔ `rc`
  - **Link:** `[Clique aqui para revisar no GitHub](https://github.com/...)`
- **Mensagem:** *"Pessoal, quem puder fazer o code review desse PR para não travar a esteira!"*

### B. Alerta de PR Mergeado
- **Cor da barra lateral:** Verde Sucesso (`#10b981`) ou Roxo Vitória (`#8b5cf6`)
- **Título:** `🚀 PR Mergeado com Sucesso na RC!`
- **Campos:**
  - **Task:** `FS-03 — Indicadores Visuais nos Cards`
  - **Autor:** `@marcus`
  - **Branch de destino:** `rc`
- **Mensagem:** *"Mais uma feature entregue! Parabéns pelo trampo, time!"*

---

## 5. 📝 Checklist de Implementação (Para Dezembro)

Quando você for sentar para implementar no início das férias, basta seguir esta receita:

- [ ] **1. Setup no Discord:**
  - Criar o canal de texto `#pull-requests` no servidor do Discord.
  - Ir em: `Editar Canal` ➔ `Integrações` ➔ `Webhooks` ➔ `Novo Webhook`.
  - Nomear como "Cereja Bot" e copiar a `URL do Webhook`.

- [ ] **2. Setup de Segurança no GitHub:**
  - Nos repositórios `cereja-kanban-api` e `cereja-kanban-frontend`:
  - Ir em: `Settings` ➔ `Secrets and variables` ➔ `Actions`.
  - Criar a secret com o nome: `DISCORD_WEBHOOK_URL` e colar a URL do webhook.

- [ ] **3. Criação do Workflow de CI/CD:**
  - Criar o arquivo `.github/workflows/pr-notification.yml`.
  - Configurar os triggers `pull_request: [opened, closed]`.
  - Fazer o payload JSON para o Discord usando `curl` ou uma Action da comunidade (`Ilshidur/action-discord`).

- [ ] **4. Teste em Homologação:**
  - Abrir um PR teste da branch `rc` para verificar se o card chega bonito no canal.
  - Fazer o merge do PR teste e validar a notificação de sucesso.

- [ ] **5. Alinhamento com a Equipe:**
  - Mandar mensagem no grupo geral avisando que o canal `#pull-requests` agora é o centro das atenções da sprint de férias.
