/**
 * TEMPLATE: Repository (Infraestrutura de Banco de Dados)
 * ────────────────────────────────────────────────────────
 * Repositories são responsáveis por TODA a comunicação com o banco de dados.
 *
 * REGRAS para este arquivo:
 *  - Todo SQL fica aqui. Nunca escreva SQL em use cases ou rotas.
 *  - Recebe e retorna objetos simples ou entidades do domain/
 *  - Não contém regras de negócio (isso é responsabilidade do use case)
 */

import { getDb } from '../../lib/db.js'
import { Task } from '../../domain/entities/Task.js'

export class TaskRepository {
  /**
   * Busca uma task pelo seu ID.
   *
   * @param {number} id - ID da task
   * @returns {Promise<Task|null>} A task encontrada ou null se não existir
   *
   * @example
   * const repo = new TaskRepository()
   * const task = await repo.findById(42)
   * if (!task) throw new Error('Task não encontrada')
   */
  async findById(id) {
    const db = await getDb()
    const row = await db.oneOrNone('SELECT * FROM tasks WHERE id = $1', [id])
    if (!row) return null
    return new Task(row)
  }

  /**
   * Busca todas as tasks de um quadro, opcionalmente filtradas por fase.
   *
   * @param {number} board_id  - ID do quadro
   * @param {string} [phase]   - Filtra por fase (opcional)
   * @returns {Promise<Task[]>} Lista de tasks
   */
  async findAllByBoard(board_id, phase = null) {
    const db = await getDb()
    let query = 'SELECT * FROM tasks WHERE board_id = $1'
    const params = [board_id]

    if (phase) {
      query += ' AND phase = $2'
      params.push(phase)
    }

    query += ' ORDER BY created_at DESC'
    const rows = await db.any(query, params)
    return rows.map(row => new Task(row))
  }

  /**
   * Cria uma nova task no banco de dados.
   *
   * @param {Object} data                          - Dados da nova task
   * @param {string} data.title                    - Título
   * @param {string} data.phase                    - Fase inicial
   * @param {number} data.board_id                 - ID do quadro
   * @param {string} [data.description]            - Descrição (opcional)
   * @param {string} [data.assignee_discord_id]    - Discord ID do responsável
   * @returns {Promise<Task>} A task criada com o ID gerado pelo banco
   *
   * @example
   * const repo = new TaskRepository()
   * const task = await repo.create({
   *   title: 'Corrigir bug do login',
   *   phase: 'backlog',
   *   board_id: 1,
   * })
   * console.log(task.id) // 42
   */
  async create({ title, phase, board_id, description, assignee_discord_id }) {
    const db = await getDb()
    const row = await db.one(`
      INSERT INTO tasks (title, phase, board_id, description, assignee_discord_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [title, phase, board_id, description || null, assignee_discord_id || null])
    return new Task(row)
  }

  /**
   * Atualiza a fase de uma task.
   *
   * @param {number} id       - ID da task
   * @param {string} newPhase - Nova fase (ex: 'andamento')
   * @returns {Promise<Task>} A task atualizada
   */
  async updatePhase(id, newPhase) {
    const db = await getDb()
    const row = await db.one(`
      UPDATE tasks
      SET phase = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newPhase, id])
    return new Task(row)
  }

  /**
   * Remove uma task permanentemente do banco.
   *
   * @param {number} id - ID da task a ser removida
   * @returns {Promise<void>}
   */
  async delete(id) {
    const db = await getDb()
    await db.none('DELETE FROM tasks WHERE id = $1', [id])
  }
}
