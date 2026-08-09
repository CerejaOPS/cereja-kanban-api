/**
 * TEMPLATE: Use Case (Camada de Aplicação)
 * ─────────────────────────────────────────
 * Use Cases contêm as REGRAS DE NEGÓCIO da aplicação.
 * Eles orquestram as outras camadas para realizar uma ação do usuário.
 *
 * REGRAS para este arquivo:
 *  - Não acessa o banco diretamente (usa repositories)
 *  - Não conhece Express/HTTP (não usa req/res)
 *  - Não conhece Discord diretamente (usa o DiscordNotifier)
 *  - Pode importar de: domain/ e infrastructure/
 */

import { Task } from '../../domain/entities/Task.js'
import { TaskRepository } from '../../infrastructure/database/TaskRepository.js'
import { DiscordNotifier } from '../../infrastructure/discord/DiscordNotifier.js'

export class CreateTaskUseCase {
  /**
   * @param {Object} [deps] - Injeção de dependências (útil para testes)
   * @param {TaskRepository}   [deps.taskRepository]   - Repositório de tasks
   * @param {DiscordNotifier}  [deps.discordNotifier]  - Notificador do Discord
   */
  constructor(deps = {}) {
    // Se não for fornecida uma dependência, cria a padrão.
    // Isso permite substituir por um "mock" nos testes.
    this.taskRepository = deps.taskRepository || new TaskRepository()
    this.discordNotifier = deps.discordNotifier || new DiscordNotifier()
  }

  /**
   * Executa a criação de uma nova task.
   *
   * Fluxo:
   *  1. Valida os dados criando a entidade Task (erros lançados aqui)
   *  2. Persiste no banco via TaskRepository
   *  3. Notifica o Discord via DiscordNotifier
   *  4. Retorna a task criada
   *
   * @param {Object} input                         - Dados de entrada
   * @param {string} input.title                   - Título da task (obrigatório)
   * @param {string} [input.phase]                 - Fase inicial (padrão: 'backlog')
   * @param {number} [input.board_id]              - ID do quadro (padrão: 1)
   * @param {string} [input.description]           - Descrição (opcional)
   * @param {string} [input.assignee_discord_id]   - Discord ID do responsável
   * @param {Object} [input.actor]                 - Quem está criando a task
   * @param {string} [input.actor.name]            - Nome de quem criou
   * @param {string} [input.actor.discord_id]      - Discord ID de quem criou
   *
   * @returns {Promise<Task>} A task criada
   * @throws {Error} Se o título estiver vazio ou a fase for inválida
   *
   * @example
   * const useCase = new CreateTaskUseCase()
   *
   * const task = await useCase.execute({
   *   title: 'Implementar login com Discord',
   *   phase: 'backlog',
   *   board_id: 1,
   *   actor: { name: 'Gustavo', discord_id: '123456789' }
   * })
   *
   * console.log(task.id) // 42
   */
  async execute({ title, phase = 'backlog', board_id = 1, description, assignee_discord_id, actor = {} }) {
    // 1. Valida os dados criando a entidade.
    //    Se os dados forem inválidos, a classe Task lança um erro aqui.
    const taskData = new Task({ id: 0, title, phase, board_id, description, assignee_discord_id })

    // 2. Persiste no banco de dados.
    const createdTask = await this.taskRepository.create({
      title: taskData.title,
      phase: taskData.phase,
      board_id: taskData.board_id,
      description: taskData.description,
      assignee_discord_id: taskData.assignee_discord_id,
    })

    // 3. Notifica o Discord de forma assíncrona (não bloqueia a resposta ao usuário).
    //    Se o Discord falhar, a task já foi salva e o erro é apenas logado.
    this.discordNotifier.notifyTaskCreated(createdTask, actor).catch(err => {
      console.error('[CreateTaskUseCase] Falha ao notificar Discord:', err.message)
    })

    // 4. Retorna a task criada.
    return createdTask
  }
}
