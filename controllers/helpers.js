/**
 * controllers/helpers.js — Funções Auxiliares Compartilhadas
 * ===========================================================
 * Este módulo centraliza as funções utilitárias usadas por todos os controllers.
 * Evita duplicação de código e garante consistência no acesso ao banco de dados.
 */

import { db } from '../database.js';

/** URL base do bot Discord para envio de webhooks de sincronização. */
const BOT_BASE_URL = process.env.BOT_WEBHOOK_BASE_URL || 'http://localhost:3005';

// ─── SSE (Server-Sent Events) ───────────────────────────────────────────────

/** Conjunto de conexões SSE ativas dos clientes web. */
export const sseClients = new Set();

/**
 * Transmite um evento de atualização do board para todos os clientes SSE conectados.
 * @param {string|number} taskId - ID da task que foi alterada.
 * @param {string} action - Descrição da ação realizada (ex: 'moved', 'edited').
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
 * Dispara o webhook de sincronização genérico para o fórum do Discord.
 * @param {string} event - Nome do evento (ex: 'task_created', 'task_phase_changed').
 * @param {Object} taskData - Dados completos da task formatada.
 */
export function triggerWebhook(event, taskData) {
  fetch(`${BOT_BASE_URL}/webhook/kanban-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, task: taskData })
  }).catch(err => console.error(`Failed to notify bot webhook for event ${event}:`, err.message));
}

/**
 * Dispara o webhook de revisão crítica (notifica o admin no Discord).
 * @param {Object} payload - Payload com taskId, title, labels, actor_name, etc.
 */
export function triggerCriticalReviewWebhook(payload) {
  fetch(`${BOT_BASE_URL}/webhook/critical-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error('Failed to notify bot critical-review webhook:', err.message));
}

// ─── Lógica de Negócio Compartilhada ─────────────────────────────────────────

/**
 * Verifica se a requisição veio do bot (via API key) ou de um admin logado.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function isAdminRequest(req) {
  return Boolean(req.isBot || (req.user && req.user.role === 'admin'));
}

/**
 * Extrai dados do ator (quem fez a ação) do body ou do usuário autenticado.
 * @param {import('express').Request} req
 * @param {Object} body - Body da requisição.
 * @returns {{ name: string, discordId: string|null }}
 */
export function actorFromRequest(req, body = {}) {
  return {
    name: body.actor_name || (req.user && req.user.name) || 'System',
    discordId: body.actor_discord_id || (req.user && req.user.id) || null
  };
}

/**
 * Busca uma task pelo ID no banco de dados.
 * @param {number|string} taskId
 * @returns {Object|undefined} Row da task ou undefined se não existir.
 */
export function getTaskOrNull(taskId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

/**
 * Insere um registro no log de atividades de uma task.
 * @param {number} taskId
 * @param {string} action - Tipo da ação (ex: 'moved', 'assigned', 'commented').
 * @param {string|null} phase - Fase atual onde a ação ocorreu.
 * @param {string|null} fromValue - Valor anterior (ex: fase de origem).
 * @param {string|null} toValue - Valor novo (ex: fase de destino).
 * @param {string} actorName - Nome de quem realizou a ação.
 * @param {string|null} actorDiscordId - Discord ID de quem realizou.
 */
export function addTaskActivity(taskId, action, phase, fromValue, toValue, actorName, actorDiscordId) {
  db.prepare(`
    INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, action, phase || null, fromValue || null, toValue || null, actorName, actorDiscordId || null);
}

/**
 * Registra uma entrada de tempo em uma task.
 * Atualiza o campo time_spent da task automaticamente.
 * @param {Object} params
 * @param {number} params.taskId
 * @param {string|null} params.phase - Fase em que o tempo foi gasto.
 * @param {number} params.minutes - Quantidade de minutos a registrar.
 * @param {string} [params.note] - Descrição do que foi feito.
 * @param {string} [params.source] - Origem do registro (ex: 'manual', 'bot').
 * @param {string} params.actorName
 * @param {string|null} params.actorDiscordId
 * @returns {Object|null} Linha inserida ou null se 0 minutos.
 */
export function addTimeEntry({ taskId, phase, minutes, note = '', source = 'manual', actorName, actorDiscordId }) {
  const parsedMinutes = Math.max(0, parseFloat(minutes) || 0);
  if (parsedMinutes <= 0) return null;

  const info = db.prepare(`
    INSERT INTO task_time_entries (task_id, phase, minutes, note, source, actor_name, actor_discord_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, phase || null, parsedMinutes, note || '', source, actorName, actorDiscordId || null);

  db.prepare(`
    UPDATE tasks
    SET time_spent = COALESCE(time_spent, 0) + ?,
        last_edited_by_name = ?,
        last_edited_by_discord_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(parsedMinutes, actorName, actorDiscordId || null, taskId);

  addTaskActivity(taskId, 'time_logged', phase, source, `${parsedMinutes}|${note || ''}`, actorName, actorDiscordId);
  return db.prepare('SELECT * FROM task_time_entries WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Retorna um resumo de tempo da task agrupado por fase e por usuário.
 * @param {number} taskId
 * @returns {{ entries: Array, byPhase: Array, byUser: Array }}
 */
export function getTimeSummary(taskId) {
  const entries = db.prepare(`
    SELECT * FROM task_time_entries WHERE task_id = ? ORDER BY created_at DESC, id DESC
  `).all(taskId);

  const byPhase = db.prepare(`
    SELECT phase, SUM(minutes) as minutes FROM task_time_entries WHERE task_id = ? GROUP BY phase
  `).all(taskId);

  const byUser = db.prepare(`
    SELECT actor_name, actor_discord_id, SUM(minutes) as minutes
    FROM task_time_entries WHERE task_id = ?
    GROUP BY actor_name, actor_discord_id ORDER BY minutes DESC
  `).all(taskId);

  return { entries, byPhase, byUser };
}

/**
 * Formata uma task do banco de dados adicionando dados de fase, etiquetas, checklists e responsáveis.
 * @param {Object} task - Row bruta da tabela `tasks`.
 * @returns {Object|null} Task formatada ou null se task for nula.
 */
export function formatTask(task) {
  if (!task) return null;

  const phaseRow = db.prepare('SELECT name FROM phases WHERE id = ?').get(task.phase);
  const phaseName = phaseRow ? phaseRow.name : task.phase;

  const taskLabels = db.prepare(`
    SELECT l.id, l.name, l.color FROM labels l
    JOIN task_labels tl ON l.id = tl.label_id WHERE tl.task_id = ?
  `).all(task.id);

  const checklists = db.prepare(`
    SELECT * FROM task_checklists WHERE task_id = ? ORDER BY position ASC, id ASC
  `).all(task.id);

  const checklistsWithDetails = checklists.map(cl => {
    const comments = db.prepare('SELECT * FROM checklist_comments WHERE checklist_id = ? ORDER BY created_at ASC').all(cl.id);
    const activity = db.prepare('SELECT * FROM checklist_activity WHERE checklist_id = ? ORDER BY created_at ASC').all(cl.id);
    return { ...cl, comments, activity };
  });

  const activeOwner = task.active_owner_discord_id ? {
    id: task.active_owner_discord_id,
    name: task.active_owner_name,
    avatarUrl: task.active_owner_avatar_url,
    startedAt: task.active_owner_started_at
  } : null;

  return {
    ...task,
    id: String(task.id),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    lastEditedByName: task.last_edited_by_name,
    lastEditedByDiscordId: task.last_edited_by_discord_id,
    timeSpent: task.time_spent || 0,
    timeSummary: getTimeSummary(task.id),
    dueDate: task.due_date || null,
    activeOwner,
    current_phase: { id: task.phase, name: phaseName },
    labels: taskLabels,
    checklists: checklistsWithDetails,
    assignees: task.assignee_name ? [{ 
      name: task.assignee_name, email: task.assignee_email || '', discord_id: task.assignee_discord_id 
    }] : [],
    fields: [{ name: 'descrição', value: task.description || '' }]
  };
}
