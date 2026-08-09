/**
 * TEMPLATE: Notificador Discord (Infraestrutura Externa)
 * ───────────────────────────────────────────────────────
 * O DiscordNotifier é responsável por toda comunicação com o Bot Discord.
 * Ele envia eventos via HTTP para o servidor de webhooks do bot (:3005).
 *
 * REGRAS para este arquivo:
 *  - Não contém regras de negócio
 *  - Não acessa o banco de dados
 *  - Só faz chamadas HTTP para o bot
 */

import axios from 'axios'

export class DiscordNotifier {
  constructor() {
    // URL base do servidor de webhooks do bot (configurada no .env)
    this.botUrl = process.env.BOT_WEBHOOK_BASE_URL || 'http://localhost:3005'
    this.apiKey = process.env.API_KEY || ''
  }

  /**
   * Envia um evento genérico para o bot Discord.
   *
   * @param {string} event    - Nome do evento (ex: 'task_created')
   * @param {Object} task     - Dados da task
   * @param {Object} [actor]  - Quem realizou a ação
   * @returns {Promise<void>}
   * @private
   */
  async #send(event, task, actor = {}) {
    const headers = this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}

    await axios.post(
      `${this.botUrl}/webhook/kanban-event`,
      { event, task, actor, timestamp: new Date().toISOString() },
      { headers, timeout: 5000 }
    )
  }

  /**
   * Notifica o Discord que uma nova task foi criada.
   * O bot vai criar um post no canal de fórum configurado.
   *
   * @param {Object} task         - Task criada
   * @param {Object} [actor]      - Quem criou a task
   * @param {string} [actor.name] - Nome do usuário
   * @param {string} [actor.discord_id] - Discord ID do usuário
   * @returns {Promise<void>}
   *
   * @example
   * await discordNotifier.notifyTaskCreated(task, { name: 'Gustavo', discord_id: '123' })
   */
  async notifyTaskCreated(task, actor = {}) {
    await this.#send('task_created', task, actor)
  }

  /**
   * Notifica o Discord que uma task mudou de fase.
   * Se a nova fase for 'revisao', envia mensagem com botões para o canal de revisão.
   * Se for 'bloqueado', envia alerta de urgência.
   *
   * @param {Object} task         - Task atualizada (com a nova fase)
   * @param {Object} [actor]      - Quem moveu a task
   * @returns {Promise<void>}
   */
  async notifyPhaseChanged(task, actor = {}) {
    await this.#send('task_phase_changed', task, actor)
  }

  /**
   * Notifica o Discord que uma task foi atribuída a um usuário.
   * O bot envia uma DM ao usuário atribuído.
   *
   * @param {Object} task   - Task com o responsável atualizado
   * @param {Object} actor  - Quem fez a atribuição
   * @returns {Promise<void>}
   */
  async notifyAssigned(task, actor = {}) {
    await this.#send('task_assigned', task, actor)
  }
}
