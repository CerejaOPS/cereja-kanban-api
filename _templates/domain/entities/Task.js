/**
 * TEMPLATE: Entidade de Domínio
 * ─────────────────────────────
 * Entidades representam os dados centrais do sistema e suas regras de negócio.
 *
 * REGRAS para este arquivo:
 *  - Sem imports externos ao domain/
 *  - Sem acesso ao banco de dados
 *  - Sem chamadas HTTP
 *  - Só contém: estrutura de dados + validações de negócio
 */

/**
 * Representa uma Task (tarefa) no sistema.
 * Esta é a entidade central do Kanban.
 */
export class Task {
  /**
   * @param {Object} props - Dados da task
   * @param {number}  props.id              - ID único da task (gerado pelo banco)
   * @param {string}  props.title           - Título da task (obrigatório)
   * @param {string}  props.phase           - ID da fase atual (ex: 'backlog', 'todo')
   * @param {number}  props.board_id        - ID do quadro ao qual a task pertence
   * @param {string}  [props.description]   - Descrição detalhada (opcional)
   * @param {string}  [props.assignee_discord_id] - Discord ID do responsável
   * @param {string}  [props.due_date]      - Prazo no formato ISO 8601
   * @param {Date}    [props.created_at]    - Data de criação
   * @param {Date}    [props.updated_at]    - Data da última atualização
   */
  constructor(props) {
    this.id = props.id
    this.title = props.title
    this.phase = props.phase
    this.board_id = props.board_id
    this.description = props.description || null
    this.assignee_discord_id = props.assignee_discord_id || null
    this.due_date = props.due_date || null
    this.created_at = props.created_at || new Date()
    this.updated_at = props.updated_at || new Date()

    // Valida os campos obrigatórios ao criar a entidade
    this.#validate()
  }

  /**
   * Valida as regras de negócio da Task.
   * Lança um erro se alguma regra for violada.
   *
   * @throws {Error} Se o título estiver vazio
   * @throws {Error} Se a fase for inválida
   * @private
   */
  #validate() {
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('O título da task é obrigatório.')
    }

    if (this.title.length > 255) {
      throw new Error('O título da task não pode ter mais de 255 caracteres.')
    }

    const fases_validas = ['backlog', 'todo', 'andamento', 'revisao', 'concluido', 'bloqueado']
    if (!fases_validas.includes(this.phase)) {
      throw new Error(`Fase inválida: "${this.phase}". Use uma das fases: ${fases_validas.join(', ')}`)
    }
  }

  /**
   * Retorna true se a task estiver concluída.
   *
   * @returns {boolean}
   */
  isConcluida() {
    return this.phase === 'concluido'
  }

  /**
   * Retorna true se a task estiver bloqueada.
   *
   * @returns {boolean}
   */
  isBloqueada() {
    return this.phase === 'bloqueado'
  }

  /**
   * Retorna true se a task estiver em revisão.
   *
   * @returns {boolean}
   */
  isEmRevisao() {
    return this.phase === 'revisao'
  }
}
