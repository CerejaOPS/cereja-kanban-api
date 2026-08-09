import { getDb } from '../lib/db.js';
import axios from 'axios';

// ─── SSE (Server-Sent Events) ───────────────────────────────────────────────

/**
 * Set global que armazena todas as conexões ativas de Server-Sent Events (SSE).
 * @type {Set<import('express').Response>}
 */
export const sseClients = new Set();

/**
 * Dispara um evento SSE para todos os clientes conectados.
 * Usado para atualizar o quadro Kanban em tempo real para todos os usuários.
 *
 * @param {string|number} taskId - ID da tarefa que sofreu alteração
 * @param {string} action - Ação realizada (ex: 'updated', 'deleted', 'created')
 */
export function broadcastBoardUpdate(taskId, action) {
  const payload = JSON.stringify({ type: 'board_update', taskId: String(taskId), action });
  console.log(`📡 SSE Broadcast: board_update (Task: ${taskId}, Action: ${action}) to ${sseClients.size} clients.`);
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

// ─── Webhooks para o Bot Discord ─────────────────────────────────────────────

/**
 * Dispara um webhook HTTP genérico para o Bot do Discord.
 * O bot escuta na porta 3005 e repassa a notificação para os canais corretos.
 *
 * @param {string} event - Nome do evento (ex: 'task_created', 'task_phase_changed')
 * @param {Object} data - Dados da tarefa ou do evento
 * @param {Object} [actorContext={}] - Informações do usuário que disparou a ação
 * @param {string} [actorContext.name] - Nome do usuário
 * @param {string} [actorContext.discord_id] - Discord ID do usuário
 * @returns {Promise<void>}
 */
export async function triggerWebhook(event, data, actorContext = {}) {
  const BOT_BASE_URL = process.env.BOT_WEBHOOK_BASE_URL || 'http://localhost:3005';
  
  try {
    const payload = {
      event,
      data,
      actor: actorContext,
      timestamp: new Date().toISOString()
    };
    
    // Configura headers se a API KEY estiver definida no bot e na API (Segurança)
    const headers = {};
    if (process.env.API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.API_KEY}`;
    }

    await axios.post(`${BOT_BASE_URL}/webhook/kanban-event`, payload, { headers });
    console.log(`Webhook '${event}' enviado com sucesso.`);
  } catch (err) {
    console.error(`Erro ao disparar webhook '${event}':`, err.message);
  }
}

/**
 * Atalho para disparar o webhook de "Revisão Necessária".
 * Chamado automaticamente quando uma task é movida para a coluna "Em Revisão".
 *
 * @param {Object} data - Dados da tarefa movida
 * @returns {Promise<void>}
 */
export async function triggerCriticalReviewWebhook(data) {
  return triggerWebhook('critical_review_needed', data, { name: data.actor_name, discord_id: data.actor_discord_id });
}

// ─── Utils de Auth e Request ────────────────────────────────────────────────

/**
 * Verifica se a requisição foi feita por um administrador.
 * Atualmente simplificado para retornar sempre true.
 *
 * @param {import('express').Request} req - Requisição Express
 * @returns {boolean} True se for admin
 */
export function isAdminRequest(req) {
  // Simplificação: no futuro verificar JWT ou role do usuário
  return true; 
}

/**
 * Extrai os dados de quem disparou a ação a partir da requisição.
 * O frontend injeta os headers `x-actor-name` ou via `req.body` usando Axios Interceptors.
 *
 * @param {import('express').Request} req - Requisição Express
 * @param {Object} [body={}] - Corpo da requisição (fallback)
 * @returns {{ name: string, discordId: string|null }} Dados do ator
 */
export function actorFromRequest(req, body = {}) {
  // Extrai dos dados fornecidos na requisição ou do payload
  const name = body.actor_name || 'Usuário Desconhecido';
  const discordId = body.actor_discord_id || null;
  return { name, discordId };
}

// ─── Database Helpers ────────────────────────────────────────────────────────

/**
 * Busca uma tarefa no banco de dados pelo seu ID.
 *
 * @param {number|string} id - ID da tarefa
 * @returns {Promise<Object|null>} A tarefa ou null se não encontrada
 */
export async function getTaskOrNull(id) {
  try {
    const db = await getDb();
    const task = await db.oneOrNone('SELECT * FROM tasks WHERE id = $1', [id]);
    return task;
  } catch (error) {
    return null;
  }
}

/**
 * Adiciona um registro de tempo (time entry) em uma tarefa e incrementa
 * o `time_spent` total da tarefa em uma única transação SQL.
 *
 * @param {Object} params - Parâmetros do log de tempo
 * @param {number|string} params.taskId - ID da tarefa
 * @param {string} params.phase - Fase onde a tarefa estava quando o tempo foi registrado
 * @param {number|string} params.minutes - Quantidade de minutos gastos
 * @param {string} [params.note] - Observação/Comentário sobre o tempo gasto
 * @param {string} params.source - Fonte (ex: 'manual', 'timer')
 * @param {string} params.actorName - Nome do usuário
 * @param {string} params.actorDiscordId - Discord ID do usuário
 * @returns {Promise<Object|null>} A entrada de tempo criada
 */
export async function addTimeEntry({ taskId, phase, minutes, note, source, actorName, actorDiscordId }) {
  const m = parseFloat(minutes) || 0;
  if (m <= 0) return null;
  
  const db = await getDb();
  
  return await db.tx(async t => {
    // 1. Insere o log de histórico
    const entry = await t.one(`
      INSERT INTO task_time_entries (task_id, phase, minutes, source, note, actor_name, actor_discord_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [taskId, phase, m, source, note || '', actorName, actorDiscordId]);
    
    // 2. Incrementa o contador total da Task
    await t.none(`
      UPDATE tasks SET time_spent = time_spent + $1 WHERE id = $2
    `, [m, taskId]);
    
    return entry;
  });
}

/**
 * Busca uma tarefa no banco e hidrata (junta) todos os relacionamentos necessários:
 * Labels (etiquetas), Checklists e Custom Fields.
 *
 * @param {Object} t - Tarefa bruta vinda do banco (apenas tabela `tasks`)
 * @returns {Promise<Object|null>} A tarefa formatada com todos os relacionamentos
 */
export async function formatTask(t) {
  if (!t) return null;
  
  const db = await getDb();
  
  // Buscar etiquetas associadas
  const labels = await db.any(`
    SELECT l.* FROM labels l
    JOIN task_labels tl ON tl.label_id = l.id
    WHERE tl.task_id = $1
  `, [t.id]);
  
  // Buscar checklists (ordenados por posição)
  const checklists = await db.any(`
    SELECT * FROM task_checklists WHERE task_id = $1 ORDER BY position ASC
  `, [t.id]);
  
  // Buscar campos customizados específicos deste board
  const customFields = await db.any(`
    SELECT f.id, f.name, f.type, f.options, v.value 
    FROM board_fields f
    LEFT JOIN task_field_values v ON v.field_id = f.id AND v.task_id = $1
    WHERE f.board_id = $2
    ORDER BY f.position ASC
  `, [t.id, t.board_id]);

  return {
    ...t,
    labels,
    checklists,
    custom_fields: customFields
  };
}
