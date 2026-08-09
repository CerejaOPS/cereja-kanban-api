/**
 * TEMPLATE: Rota HTTP (Camada de Interface)
 * ──────────────────────────────────────────
 * As rotas são a "porta de entrada" da API.
 * Elas recebem o HTTP e delegam para o Use Case correto.
 *
 * REGRAS para este arquivo:
 *  - Não contém SQL
 *  - Não contém regras de negócio
 *  - Só trata: req/res, autenticação básica, e chamada ao use case
 *  - Erros do use case são capturados e transformados em respostas HTTP
 */

import { Router } from 'express'
import { CreateTaskUseCase } from '../../application/use-cases/CreateTask.js'

const router = Router()

// Instancia o use case uma vez (poderia ser injetado também)
const createTaskUseCase = new CreateTaskUseCase()

/**
 * POST /api/tasks
 *
 * Cria uma nova task no quadro Kanban.
 *
 * Body esperado:
 * @param {string}  title                  - Título da task (obrigatório)
 * @param {string}  [phase]                - Fase inicial (padrão: 'backlog')
 * @param {number}  [board_id]             - ID do quadro (padrão: 1)
 * @param {string}  [description]          - Descrição
 * @param {string}  [assignee_discord_id]  - Discord ID do responsável
 * @param {string}  [actor_name]           - Nome de quem está criando (injetado pelo interceptor do frontend)
 * @param {string}  [actor_discord_id]     - Discord ID de quem está criando
 *
 * Respostas:
 * - 201: Task criada com sucesso
 * - 400: Dados inválidos (título vazio, fase inválida, etc.)
 * - 500: Erro interno do servidor
 */
router.post('/api/tasks/template', async (req, res) => {
  try {
    const {
      title,
      phase,
      board_id,
      description,
      assignee_discord_id,
      actor_name,
      actor_discord_id,
    } = req.body

    // Delega toda a lógica para o use case
    const task = await createTaskUseCase.execute({
      title,
      phase,
      board_id,
      description,
      assignee_discord_id,
      actor: {
        name: actor_name || 'Usuário Desconhecido',
        discord_id: actor_discord_id || null,
      },
    })

    return res.status(201).json(task)

  } catch (error) {
    // Erros de validação da entidade (ex: título vazio) → 400
    if (error.message.includes('obrigatório') || error.message.includes('inválid')) {
      return res.status(400).json({ error: error.message })
    }

    // Erros inesperados → 500
    console.error('[POST /api/tasks] Erro inesperado:', error)
    return res.status(500).json({ error: 'Erro interno do servidor.' })
  }
})

export default router
