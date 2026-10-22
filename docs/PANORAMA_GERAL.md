# 🍒 Panorama Geral e Estratégico — Cereja Kanban

> **Documento:** Visão Executiva & Panorama do Produto  
> **Líder do Projeto & Product Manager:** Gustavo Braga  
> **Status:** Visão Oficial do Projeto  
> **Última Atualização:** Outubro/2026  

---

## 🗺️ O Mapa Mental do Produto

```
                      [ GIGANTES CORPORATIVOS ]
                         Jira  |  Pipefy
                       (Pesados, burocráticos,
                         focados em bancos)
                                │
                      O VAZIO DE MERCADO (OCEANO AZUL)
                                │
                                ▼
                       [ CEREJA KANBAN ]
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
      [ USO INDIVIDUAL ]                  [ USO COLETIVO ]
    Rotina diária do aluno,             Projetos em grupo, TCCs,
    estudo pra provas e prazos          squads e entregas ágeis
              │                                   │
              └─────────────────┬─────────────────┘
                                ▼
                    [ OS 3 DIFERENCIAIS ]
          1. Gamificação real (XP, Níveis, Discord)
          2. Visibilidade em tempo real para Professores
          3. Plug-and-Play (Abre dentro do portal da faculdade)
```

---

## 1. 🎯 A Grande Missão (Bater de Frente com os Gigantes)

O **Cereja Kanban** foi idealizado para disputar mercado diretamente com soluções consagradas como **Jira** e **Pipefy**.

* **A Fragilidade dos Concorrentes:** O Jira consolidou-se como uma ferramenta pesada, lenta, com excesso de burocracia e interfaces intimidadoras. O Pipefy foca em processos administrativos corporativos frios.
* **A Nossa Proposta:** Entregar o mesmo nível de **robustez, integridade de dados e arquitetura sólida**, porém com uma experiência de uso **ultrarrápida, intuitiva, fluida e agradável**.

---

## 2. 🏹 O Nicho Estratégico: O "Oceano Azul" Educacional (EdTech)

Em vez de competir diretamente em licitações corporativas fechadas, o Cereja adota uma estratégia de entrada focada em um mercado carente e massivo: **Faculdades, Escolas Técnicas, Plataformas EAD e Bootcamps**.

* **O Cenário Atual na Educação:** Instituições dependem de plataformas tradicionais (Moodle, Canvas, Google Classroom) que funcionam essencialmente como "depósitos de PDF". O professor não tem visibilidade do processo de trabalho dos alunos, e os estudantes não aprendem a trabalhar com métodos ágeis de mercado.
* **A Oportunidade:** O Cereja atua como a ponte entre o aprendizado acadêmico e a metodologia de squads profissionais do mercado de tecnologia.

---

## 3. 📦 O Produto: Dupla Camada de Uso

O Cereja resolve dois problemas simultâneos, garantindo **utilização contínua (Daily Active Users)**:

### A. Camada de Gestão Individual (Painel Pessoal de Estudos)
* Organização da rotina diária do estudante: listas de exercícios, leituras, matérias e preparação para provas.
* Visão unificada de prazos pessoais e acadêmicos.
* Estímulo à disciplina diária e combate à procrastinação.

### B. Camada de Gestão Coletiva (Squads e Projetos em Equipe)
* Fluxo de trabalho ágil para trabalhos em grupo, laboratórios práticos e TCCs.
* Regras claras de transição de fase, indicadores visuais de prioridade (cores e ícones) e histórico auditável de quem realizou cada ação.

---

## 4. 💎 Os Três Pilares Diferenciais

### 1. Gamificação Real & Comunidade
* Transformação de entregas em **experiência (XP), progressão de níveis e medalhas de conquista**.
* Integração nativa com plataformas sociais e de comunicação onde os estudantes já interagem ativamente, como o **Discord**.

### 2. Filosofia Plug-and-Play (Integração sem Fricção)
* **Sem substituição forçada:** A instituição não precisa abandonar o sistema acadêmico existente.
* O Cereja nasce com **APIs Abertas, Webhooks e suporte a padrões de interoperabilidade educacional (LTI)**, permitindo ser embutido como um módulo direto dentro de portais próprios, plataformas EAD ou canais de comunicação.

### 3. Visibilidade e Acompanhamento Docente
* Painéis transparentes para professores e coordenadores acompanharem o desenvolvimento semanal dos grupos em tempo real, eliminando a dependência de relatórios manuais de status.

---

## 5. 🏗️ Alicerces de Engenharia

Para sustentar a ambição de um SaaS de classe mundial:

* **Backend (Java 17+ / Spring Boot):**
  - **Clean Architecture rigorosa:** Camada de domínio pura e isolada de frameworks e persistência.
  - Testabilidade, segurança com DTOs/Bean Validation e tratamento global de exceções.
* **Frontend (React / Vite / TypeScript):**
  - Modularidade com **CSS Modules** (sem dependência de frameworks visuais pesados).
  - Respostas instantâneas e **UI otimista** (o estado atualiza imediatamente ao comando do usuário).
* **Comunicação em Tempo Real:**
  - Sincronização de quadros e alertas instantâneos via Server-Sent Events (SSE).

---

## 🧭 Roadmap Estratégico de Evolução

| Fase | Marco | Entregas Principais |
| :--- | :--- | :--- |
| **Fase 1 (Atual)** | **Fundação do Produto** | CRUD completo de tasks, Clean Arch, drag & drop, modal rico com checklist e comentários, indicadores visuais de prioridade, healthcheck. |
| **Fase 2 (Férias)** | **Comunicação Assíncrona & Real-Time** | Automação de notificações de PRs no Discord via GitHub Actions, Server-Sent Events (sincronização sem F5), primeiros ganchos de gamificação. |
| **Fase 3 (Expansão)** | **Gestor Individual & Turmas** | Módulo de tarefas pessoais do aluno ("Minha Rotina"), múltiplos quadros por disciplina e controle de papéis (professor/aluno). |
| **Fase 4 (Mercado)** | **SaaS Educacional Aberto** | Suporte a LTI (Canvas/Moodle), APIs públicas para bootcamps e plataformas EAD, início dos pilotos com turmas reais. |

---

> *"O plano está traçado, a arquitetura está fundamentada e a direção está clara. Construir com excelência técnica para transformar a gestão de projetos e o aprendizado prático."*
