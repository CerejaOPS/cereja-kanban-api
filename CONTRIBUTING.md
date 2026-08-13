# Guia de Contribuição

Bem-vindo ao projeto CherDeal Operacional! Siga estas regras para manter o projeto organizado e o código limpo.

## Fluxo de Trabalho (Git Flow)

1. **Nunca faça commit direto na `main`**. A branch `main` é sagrada e deve conter apenas código testado.
2. Para cada nova feature ou correção, crie uma branch a partir da `main`:
   - Features novas: `feature/nome-da-feature` (ex: `feature/profile-modal`)
   - Correções de bug: `bugfix/nome-do-bug` (ex: `bugfix/fix-login`)
   - Refatorações: `refactor/nome-do-refactor`
3. Trabalhe na sua branch localmente.
4. Quando terminar, abra um **Pull Request (PR)** para a `main`.
5. Preencha o template do PR (ele vai aparecer automaticamente).
6. Peça para pelo menos **1 colega** revisar o seu código (Code Review).
7. Se aprovado, faça o merge na `main`.

## Regras de Código

- **Prettier:** O projeto usa Prettier. Sempre formate seu código antes de commitar (ou deixe o linter fazer isso no pre-commit se estiver configurado).
- **Backend:** Se for mexer na API, siga a [Clean Architecture descrita no ARCHITECTURE.md](./ARCHITECTURE.md). Não crie rotas espaguete.
- **Frontend:** Siga o padrão [Feature-Sliced Design (FSD)](./ARCHITECTURE.md).

## Mensagens de Commit

Use mensagens descritivas. Padrão sugerido:

- `feat: Adiciona modal de perfil`
- `fix: Corrige erro 500 ao criar task`
- `docs: Atualiza README`
- `style: Formata arquivos do frontend`
