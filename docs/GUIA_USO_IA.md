# Guia de Uso da IA (Cursor/Windsurf)

Para extrair o melhor da Inteligência Artificial sem quebrar as regras de arquitetura (e sem pedir para a IA escrever o código por você), siga o nosso fluxo padrão de comunicação com a ferramenta:

## 1. Como iniciar uma Task (Comando de Contexto)
Quando você pegar uma task nova no Jira, abra o chat da IA e digite EXATAMENTE o seguinte modelo:

> **Comando de Prompt:**
> "INICIAR TASK: Peguei a Task [CÓDIGO DA TASK] (ex: FEAT-01 - CRUD de Tasks). Por favor, leia o arquivo `docs/CONTEXTO_SISTEMA.md` para entender onde essa task se encaixa, avalie o código que já existe no projeto e me dê o passo-a-passo inicial lógico do que eu preciso criar agora, mas **não escreva o código da implementação final**."

### 1.1. O Fluxo Obrigatório do Git
A primeira coisa que a IA vai fazer é te dar os comandos Git para você isolar o seu trabalho. O fluxo padrão do Cereja Kanban é:
1. Sempre partir da branch `rc` (Release Candidate).
2. Criar uma branch no formato `feat/NOME-DA-TASK`.
3. Desenvolver.
4. Fazer Push e abrir Pull Request para a `rc`.

## 2. Exemplos de Prompts por Situação

### Quando você está começando uma FEAT do zero:
> "INICIAR TASK: Peguei a FEAT-03 (Gestão de Boards). Leia o `docs/CONTEXTO_SISTEMA.md`. Me passe os comandos Git para iniciar e me diga o que eu preciso criar de ponta a ponta (Controller, Service, Adapter, Entity JPA)."

### Quando você travou num erro:
> "Estou tentando criar o TaskRepositoryAdapter mas o Spring não está injetando a dependência. Veja meu código: [cole o código aqui]. O que está errado?"

## 3. A Regra das 5 Tentativas
Não peça à IA: *"Escreva o Controller pra mim"*. A IA é instruída a recusar.
Você deve TENTAR escrever. Se der erro, cole o código com o erro na IA:
*"Tentei fazer o endpoint mas está dando erro no Lombok. Veja meu código:"*
Apenas quando você estiver travado de verdade a IA fornecerá o código de resgate.

## 4. O Que a IA vai Vigiar
A IA foi configurada como "Guardiã da Arquitetura e do Versionamento". Se você pedir algo que quebre as regras (como comitar na main ou acessar Banco de Dados dentro da pasta `domain`), ela vai dar um alerta informando que a operação viola o guia do PM Gustavo. 

## 5. Lembrete: Fatiamento Vertical
Cada dev implementa a feature INTEIRA de ponta a ponta (Controller → Service → Banco). Não fique "dono" de uma camada só. Consulte o `docs/CONTEXTO_SISTEMA.md` para ver a lista de FEATs e suas dependências.
