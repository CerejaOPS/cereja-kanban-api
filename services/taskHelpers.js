import { db } from '../database.js';

/**
 * Verifica se a requisição foi feita por um admin ou bot.
 * @param {import('express').Request} req 
 * @returns {boolean}
 */
export function isAdminRequest(req) {
  return Boolean(req.isBot || (req.user && req.user.role === 'admin'));
}

/**
 * Obtém o ator da requisição.
 * @param {import('express').Request} req 
 * @param {Object} [body={}] 
 * @returns {{name: string, discordId: string|null}}
 */
export function actorFromRequest(req, body = {}) {
  return {
    name: body.actor_name || (req.user && req.user.name) || 'System',
    discordId: body.actor_discord_id || (req.user && req.user.id) || null
  };
}

/**
 * Retorna uma tarefa pelo ID.
 * @param {string|number} taskId 
 * @returns {Object|null}
 */
export function getTaskOrNull(taskId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

/**
 * Adiciona uma atividade na log da task.
 * @param {string|number} taskId 
 * @param {string} action 
 * @param {string} phase 
 * @param {string|null} fromValue 
 * @param {string|null} toValue 
 * @param {string} actorName 
 * @param {string|null} actorDiscordId 
 */
export function addTaskActivity(taskId, action, phase, fromValue, toValue, actorName, actorDiscordId) {
  db.prepare(`
    INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, action, phase || null, fromValue || null, toValue || null, actorName, actorDiscordId || null);
}

/**
 * Adiciona um registro de tempo e atualiza a task.
 * @param {Object} params 
 * @param {string|number} params.taskId 
 * @param {string} params.phase 
 * @param {number|string} params.minutes 
 * @param {string} [params.note=''] 
 * @param {string} [params.source='manual'] 
 * @param {string} params.actorName 
 * @param {string|null} params.actorDiscordId 
 * @returns {Object|null}
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
 * Retorna o sumário de tempo de uma task.
 * @param {string|number} taskId 
 * @returns {{entries: any[], byPhase: any[], byUser: any[]}}
 */
export function getTimeSummary(taskId) {
  const entries = db.prepare(`
    SELECT *
    FROM task_time_entries
    WHERE task_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(taskId);

  const byPhase = db.prepare(`
    SELECT phase, SUM(minutes) as minutes
    FROM task_time_entries
    WHERE task_id = ?
    GROUP BY phase
  `).all(taskId);

  const byUser = db.prepare(`
    SELECT actor_name, actor_discord_id, SUM(minutes) as minutes
    FROM task_time_entries
    WHERE task_id = ?
    GROUP BY actor_name, actor_discord_id
    ORDER BY minutes DESC
  `).all(taskId);

  return { entries, byPhase, byUser };
}

const BOT_BASE_URL = process.env.BOT_WEBHOOK_BASE_URL || 'http://localhost:3005';

/**
 * Dispara webhook genérico para o bot.
 * @param {string} event 
 * @param {Object} taskData 
 */
export function triggerWebhook(event, taskData) {
  fetch(`${BOT_BASE_URL}/webhook/kanban-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      task: taskData
    })
  }).catch(err => console.error(`Failed to notify bot webhook for event ${event}:`, err.message));
}

/**
 * Dispara webhook de revisão crítica.
 * @param {Object} payload 
 */
export function triggerCriticalReviewWebhook(payload) {
  fetch(`${BOT_BASE_URL}/webhook/critical-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error('Failed to notify bot critical-review webhook:', err.message));
}

/**
 * Formata os dados de uma tarefa e anexa entidades relacionadas.
 * @param {Object} task 
 * @returns {Object|null}
 */
export function formatTask(task) {
  if (!task) return null;

  const phaseRow = db.prepare('SELECT name FROM phases WHERE id = ?').get(task.phase);
  const phaseName = phaseRow ? phaseRow.name : task.phase;

  const taskLabels = db.prepare(`
    SELECT l.id, l.name, l.color 
    FROM labels l 
    JOIN task_labels tl ON l.id = tl.label_id 
    WHERE tl.task_id = ?
  `).all(task.id);

  const checklists = db.prepare(`
    SELECT * FROM task_checklists 
    WHERE task_id = ? 
    ORDER BY position ASC, id ASC
  `).all(task.id);

  const checklistsWithDetails = checklists.map(cl => {
    const comments = db.prepare('SELECT * FROM checklist_comments WHERE checklist_id = ? ORDER BY created_at ASC').all(cl.id);
    const activity = db.prepare('SELECT * FROM checklist_activity WHERE checklist_id = ? ORDER BY created_at ASC').all(cl.id);
    return {
      ...cl,
      comments,
      activity
    };
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
    current_phase: {
      id: task.phase,
      name: phaseName
    },
    labels: taskLabels,
    checklists: checklistsWithDetails,
    assignees: task.assignee_name ? [{ 
      name: task.assignee_name, 
      email: task.assignee_email || '',
      discord_id: task.assignee_discord_id 
    }] : [],
    fields: [
      { name: 'descrição', value: task.description || '' }
    ]
  };
}
