import { getDb } from '../lib/db.js';
import axios from 'axios';

// ─── SSE (Server-Sent Events) ───────────────────────────────────────────────
export const sseClients = new Set();

export function broadcastBoardUpdate(taskId, action) {
  const payload = JSON.stringify({ type: 'board_update', taskId: String(taskId), action });
  console.log(`📡 SSE Broadcast: board_update (Task: ${taskId}, Action: ${action}) to ${sseClients.size} clients.`);
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

// ─── Webhooks para o Bot Discord ─────────────────────────────────────────────
export async function triggerWebhook(event, data, actorContext = {}) {
  const BOT_BASE_URL = process.env.BOT_WEBHOOK_BASE_URL || 'http://localhost:3005';
  
  try {
    const payload = {
      event,
      data,
      actor: actorContext,
      timestamp: new Date().toISOString()
    };
    
    // Configura headers se a API KEY estiver definida no bot e na API
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

export async function triggerCriticalReviewWebhook(data) {
  return triggerWebhook('critical_review_needed', data, { name: data.actor_name, discord_id: data.actor_discord_id });
}

// ─── Utils de Auth e Request ────────────────────────────────────────────────
export function isAdminRequest(req) {
  // Simplificação
  return true; 
}

export function actorFromRequest(req, body = {}) {
  // Extrai dos dados fornecidos na requisição ou do payload
  const name = body.actor_name || 'Usuário Desconhecido';
  const discordId = body.actor_discord_id || null;
  return { name, discordId };
}

// ─── Database Helpers ────────────────────────────────────────────────────────
export async function getTaskOrNull(id) {
  try {
    const db = await getDb();
    const task = await db.oneOrNone('SELECT * FROM tasks WHERE id = $1', [id]);
    return task;
  } catch (error) {
    return null;
  }
}

export async function addTimeEntry({ taskId, phase, minutes, note, source, actorName, actorDiscordId }) {
  const m = parseFloat(minutes) || 0;
  if (m <= 0) return null;
  
  const db = await getDb();
  
  return await db.tx(async t => {
    const entry = await t.one(`
      INSERT INTO task_time_entries (task_id, phase, minutes, source, note, actor_name, actor_discord_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [taskId, phase, m, source, note || '', actorName, actorDiscordId]);
    
    await t.none(`
      UPDATE tasks SET time_spent = time_spent + $1 WHERE id = $2
    `, [m, taskId]);
    
    return entry;
  });
}

export async function formatTask(t) {
  if (!t) return null;
  
  const db = await getDb();
  
  // Fetch related data
  const labels = await db.any(`
    SELECT l.* FROM labels l
    JOIN task_labels tl ON tl.label_id = l.id
    WHERE tl.task_id = $1
  `, [t.id]);
  
  const checklists = await db.any(`
    SELECT * FROM task_checklists WHERE task_id = $1 ORDER BY position ASC
  `, [t.id]);
  
  const customFields = await db.any(`
    SELECT f.id, f.name, f.type, f.options, v.value 
    FROM board_fields f
    LEFT JOIN task_field_values v ON v.field_id = f.id AND v.task_id = $1
    WHERE f.board_id = $2
    ORDER BY f.position ASC
  `, [t.id, t.board_id]);

  // Convert fields from underscore to camelcase to maintain backwards API compatibility if needed, 
  // or just return as is (if API expects the pg schema names, which are underscores).
  return {
    ...t,
    labels,
    checklists,
    custom_fields: customFields
  };
}
