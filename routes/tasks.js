/**
 * routes/tasks.js — CherDeal Kanban API - Roteador Principal
 * ===========================================================
 * Define todas as rotas da API REST do Kanban.
 *
 * ARQUITETURA:
 *  - Funções auxiliares (formatTask, addTimeEntry, broadcastBoardUpdate, etc.)
 *    foram centralizadas em `controllers/helpers.js` para facilitar reuso.
 *  - Este arquivo contém apenas as declarações de rotas, organizadas por seções.
 *
 * SEÇÕES DE ROTAS:
 *  1. SSE          — Conexão em tempo real (Server-Sent Events)
 *  2. FASES        — Gerenciamento de colunas/fases do board
 *  3. LABELS       — Sistema de etiquetas coloridas
 *  4. MEMBERS      — Lista de membros da equipe
 *  5. TASKS        — CRUD principal de tasks
 *  6. PHASE MOVE   — Movimentação de tasks entre fases
 *  7. ASSIGN       — Atribuição de responsável
 *  8. EDIÇÃO       — Edição de campos (título, descrição, vencimento, etc.)
 *  9. COMMENTS     — Comentários e timeline
 * 10. TIME         — Registro de tempo gasto
 * 11. OBSERVATIONS — Notas/observações estratégicas
 * 12. OWNERSHIP    — Controle de "dono ativo" (quem está trabalhando agora)
 * 13. CHECKLISTS   — Etapas de execução (subtarefas)
 * 14. ACTIVITY     — Histórico de atividades por fase
 */
import { Router } from 'express';
import { db } from '../database.js';
import { requireAuthOrApiKey } from '../middleware/auth.js';
import {
  sseClients,
  broadcastBoardUpdate,
  triggerWebhook,
  triggerCriticalReviewWebhook,
  isAdminRequest,
  actorFromRequest,
  getTaskOrNull,
  addTaskActivity,
  addTimeEntry,
  getTimeSummary,
  formatTask
} from '../controllers/helpers.js';

export { broadcastBoardUpdate };

const router = Router();

// ==========================================
// 1. SSE — Server-Sent Events
// ==========================================
/** Armazena conexões SSE ativas — gerenciado em controllers/helpers.js */

/**
 * GET /api/events
 * Server-Sent Events (SSE) to push real-time board updates to clients.
 */
router.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established.' })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});


// ─── Helpers abaixo foram movidos para controllers/helpers.js ─────────────────
// broadcastBoardUpdate, isAdminRequest, actorFromRequest, getTaskOrNull,
// addTaskActivity, addTimeEntry, getTimeSummary, triggerWebhook,
// triggerCriticalReviewWebhook e formatTask são agora importados no topo.
// ─────────────────────────────────────────────────────────────────────────────

// ==========================================
// 2. FASES — Colunas/Fases do Board
// ==========================================

// List columns/phases sorted by position
router.get('/api/phases', (req, res) => {
  try {
    const phases = db.prepare('SELECT * FROM phases ORDER BY position ASC').all();
    return res.json(phases);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Create new custom phase column
router.post('/api/phases', requireAuthOrApiKey, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Column name is required.' });
    }

    const id = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check if ID already exists
    const existing = db.prepare('SELECT id FROM phases WHERE id = ?').get(id);
    if (existing) {
      return res.status(400).json({ error: 'A column with a similar name already exists.' });
    }

    // Get max position to append column at the end
    const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM phases').get();
    const nextPos = (maxPosRow && maxPosRow.maxPos !== null) ? maxPosRow.maxPos + 1 : 0;

    db.prepare('INSERT INTO phases (id, name, position) VALUES (?, ?, ?)')
      .run(id, name.trim(), nextPos);

    broadcastBoardUpdate(0, 'phases_updated');
    return res.status(201).json({ id, name: name.trim(), position: nextPos });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Rename or reorder columns
router.patch('/api/phases/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, position } = req.body;
    const { id } = req.params;

    const column = db.prepare('SELECT * FROM phases WHERE id = ?').get(id);
    if (!column) {
      return res.status(404).json({ error: 'Column not found.' });
    }

    if (name !== undefined) {
      db.prepare('UPDATE phases SET name = ? WHERE id = ?').run(name.trim(), id);
    }

    if (position !== undefined) {
      db.prepare('UPDATE phases SET position = ? WHERE id = ?').run(position, id);
    }

    broadcastBoardUpdate(0, 'phases_updated');
    return res.json({ id, ...column, ...req.body });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete an empty column
router.delete('/api/phases/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are any tasks in this phase
    const countRow = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE phase = ?').get(id);
    if (countRow && countRow.count > 0) {
      return res.status(400).json({ error: 'Cannot delete column: column contains tasks.' });
    }

    db.prepare('DELETE FROM phases WHERE id = ?').run(id);

    broadcastBoardUpdate(0, 'phases_updated');
    return res.json({ success: true, message: 'Column deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});



// ==========================================
// 3. LABELS — Etiquetas Coloridas
// ==========================================

// List all reusable labels
router.get('/api/labels', (req, res) => {
  try {
    const labels = db.prepare('SELECT * FROM labels ORDER BY name ASC').all();
    return res.json(labels);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Create new custom label
router.post('/api/labels', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim() || !color) {
      return res.status(400).json({ error: 'Label name and solid color are required.' });
    }

    const info = db.prepare('INSERT OR IGNORE INTO labels (name, color) VALUES (?, ?)')
      .run(name.trim(), color.trim());

    if (info.changes === 0) {
      const existing = db.prepare('SELECT * FROM labels WHERE name = ?').get(name.trim());
      return res.json(existing);
    }

    return res.status(201).json({ id: info.lastInsertRowid, name: name.trim(), color: color.trim() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete a custom label
router.delete('/api/labels/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM task_labels WHERE label_id = ?').run(id);
    db.prepare('DELETE FROM labels WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Label deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 🚀 ENDPOINT DE MEMBROS MAPEADOS
// ==========================================

// List all mapped Discord users
router.get('/api/members', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM discord_users ORDER BY display_name ASC').all();
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 🚀 ENDPOINTS DE TASKS / TAREFAS
// ==========================================

// 1. GET /api/tasks (Public)
router.get('/api/tasks', (req, res) => {
  try {
    const { phase, limit } = req.query;
    
    let query = 'SELECT * FROM tasks';
    const params = [];
    
    if (phase) {
      query += ' WHERE phase = ?';
      params.push(phase);
    }
    
    query += ' ORDER BY id DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }
    
    const tasks = db.prepare(query).all(...params);
    const formatted = tasks.map(formatTask);
    
    return res.json(formatted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/tasks/:id (Public)
router.get('/api/tasks/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    
    return res.json(formatTask(task));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/tasks (Requires Auth or API Key)
router.post('/api/tasks', requireAuthOrApiKey, (req, res) => {
  try {
    if (!req.isBot && req.user && req.user.role === 'user') {
      return res.status(403).json({ error: 'Apenas administradores ou PMs podem criar tarefas.' });
    }

    const { title, description, phase = 'todo', due_date = null, actor_name = 'System', actor_discord_id = null, labels = [] } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    
    // Insert task
    const info = db.prepare(`
      INSERT INTO tasks (title, description, phase, due_date, time_spent, last_edited_by_name, last_edited_by_discord_id) 
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(title.trim(), description || '', phase, due_date || null, actor_name, actor_discord_id);
    
    const taskId = info.lastInsertRowid;
    
    // Link labels
    if (labels && Array.isArray(labels)) {
      for (const labelId of labels) {
        db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)').run(taskId, labelId);
      }
    }

    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    
    db.prepare(`
      INSERT INTO activity_log (task_id, action, phase, to_phase, actor_name, actor_discord_id)
      VALUES (?, 'created', ?, ?, ?, ?)
    `).run(taskId, newTask.phase, newTask.phase, actor_name, actor_discord_id);

    triggerWebhook('task_created', formatTask(newTask));
    broadcastBoardUpdate(taskId, 'created');
    return res.status(201).json(formatTask(newTask));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. PATCH /api/tasks/:id/phase - Direct transition phase shifter
router.patch('/api/tasks/:id/phase', requireAuthOrApiKey, (req, res) => {
  try {
    const { phase, actor_name = 'Bot', actor_discord_id = null, from_phase = null, time_spent = null, time_note = '' } = req.body;
    const taskId = req.params.id;
    
    if (!phase) {
      return res.status(400).json({ error: 'Phase is required.' });
    }
    
    // Check if phase is valid
    const phaseCheck = db.prepare('SELECT id FROM phases WHERE id = ?').get(phase);
    if (!phaseCheck) {
      return res.status(400).json({ error: `Invalid phase column: ${phase}` });
    }
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    
    // RBAC: Verificações de permissão para usuário comum
    if (!req.isBot && req.user && req.user.role === 'user') {
      const isAssignee = task.assignee_discord_id === req.user.id;
      const isReviewPhase = task.phase === 'revisao' || phase === 'revisao';
      const isBacklog = task.phase === 'backlog';
      
      if (isBacklog) {
        return res.status(403).json({ error: 'Membros não podem retirar tarefas do backlog.' });
      }
      
      if (!isAssignee && !isReviewPhase) {
        return res.status(403).json({ error: 'Você só pode mover tarefas atribuídas a você, ou tarefas ligadas à Revisão.' });
      }
    }
    
    const actualFromPhase = from_phase || task.phase;
    
    if (actualFromPhase === phase) {
      return res.json(formatTask(task)); // No phase change
    }

    // Direct update: updates columns and issues EXACTLY ONE update & logging event
    let query = `
      UPDATE tasks 
      SET phase = ?, last_edited_by_name = ?, last_edited_by_discord_id = ?, updated_at = datetime('now')
    `;
    const params = [phase, actor_name, actor_discord_id];

    query += ` WHERE id = ?`;
    params.push(taskId);

    db.prepare(query).run(...params);

    if (time_spent !== null) {
      addTimeEntry({
        taskId,
        phase: actualFromPhase,
        minutes: time_spent,
        note: time_note || `Tempo registrado ao mover para ${phase}`,
        source: 'phase_move',
        actorName: actor_name,
        actorDiscordId: actor_discord_id
      });
    }
    
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      
    db.prepare(`
      INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
      VALUES (?, 'moved', ?, ?, ?, ?, ?)
    `).run(taskId, phase, actualFromPhase, phase, actor_name, actor_discord_id);

    // --- Webhook for Critical Review ---
    if (phase === 'revisao' && actualFromPhase !== 'revisao') {
      try {
        const taskLabels = db.prepare(`
          SELECT l.name FROM labels l
          JOIN task_labels tl ON tl.label_id = l.id
          WHERE tl.task_id = ?
        `).all(taskId);

        const isCritical = taskLabels.some(l =>
          l.name.toLowerCase().includes('estratégica') ||
          l.name.toLowerCase().includes('estrategica') ||
          l.name.toLowerCase().includes('urgente') ||
          l.name.toLowerCase().includes('bug') ||
          l.name.toLowerCase().includes('crítica') ||
          l.name.toLowerCase().includes('critica') ||
          l.name.toLowerCase().includes('feature')
        );

        if (isCritical) {
          triggerCriticalReviewWebhook({
              taskId: taskId,
              title: updatedTask.title,
              actor_name: actor_name,
              assignee_discord_id: updatedTask.assignee_discord_id,
              labels: taskLabels
            });
        }
      } catch(e) { console.error('Error in webhook logic (phase route):', e); }
    }

    triggerWebhook('task_phase_changed', formatTask(updatedTask));
    broadcastBoardUpdate(taskId, 'moved');
    return res.json(formatTask(updatedTask));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. PATCH /api/tasks/:id/assign (Assignee shortcut endpoint)
router.patch('/api/tasks/:id/assign', requireAuthOrApiKey, (req, res) => {
  try {
    const { assignee_discord_id, assignee_name, assignee_email, actor_name = null, actor_discord_id = null } = req.body;
    const taskId = req.params.id;
    
    if (!assignee_name) {
      return res.status(400).json({ error: 'Assignee name is required.' });
    }
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    
    const finalActorName = actor_name || assignee_name || 'System';
    const finalActorDiscordId = actor_discord_id || assignee_discord_id || null;

    db.prepare(`
      UPDATE tasks 
      SET assignee_discord_id = ?, assignee_name = ?, assignee_email = ?, 
          last_edited_by_name = ?, last_edited_by_discord_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(assignee_discord_id || null, assignee_name, assignee_email || null, finalActorName, finalActorDiscordId, taskId);
    
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    
    db.prepare(`
      INSERT INTO activity_log (task_id, action, phase, to_phase, actor_name, actor_discord_id)
      VALUES (?, 'assigned', ?, ?, ?, ?)
    `).run(taskId, task.phase, assignee_name, finalActorName, finalActorDiscordId);

    triggerWebhook('task_assigned', formatTask(updatedTask));
    broadcastBoardUpdate(taskId, 'assigned');
    return res.json(formatTask(updatedTask));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. DELETE /api/tasks/:id/assign (Remove assignee shortcut endpoint)
router.delete('/api/tasks/:id/assign', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const { actor_name = 'System', actor_discord_id = null } = req.body || {};
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    
    const oldAssigneeName = task.assignee_name;
    const oldAssigneeDiscordId = task.assignee_discord_id;
    
    db.prepare(`
      UPDATE tasks 
      SET assignee_discord_id = NULL, assignee_name = NULL, assignee_email = NULL,
          last_edited_by_name = ?, last_edited_by_discord_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(actor_name, actor_discord_id, taskId);
    
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    
    db.prepare(`
      INSERT INTO activity_log (task_id, action, phase, from_phase, actor_name, actor_discord_id)
      VALUES (?, 'unassigned', ?, ?, ?, ?)
    `).run(taskId, task.phase, oldAssigneeName, actor_name, actor_discord_id);

    triggerWebhook('task_unassigned', formatTask(updatedTask));
    broadcastBoardUpdate(taskId, 'unassigned');
    return res.json(formatTask(updatedTask));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 6b. PATCH /api/tasks/:id/thread
router.patch('/api/tasks/:id/thread', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const { discord_thread_id } = req.body;
    
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    db.prepare('UPDATE tasks SET discord_thread_id = ? WHERE id = ?').run(discord_thread_id, taskId);
    
    return res.json({ success: true, discord_thread_id });
  } catch (error) {
    logger.error('Error updating thread ID:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 7. PATCH /api/tasks/:id (Dynamic Save on Close & Detailed Edit Endpoint)
router.patch('/api/tasks/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const { 
      title, 
      description, 
      assignee_discord_id, 
      time_spent, 
      time_spent_delta,
      time_note = '',
      due_date,
      phase, 
      labels, // Array of label IDs
      actor_name = 'System', 
      actor_discord_id = null,
      dynamic_fields // Object with key-value pairs from dynamic forms
    } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const isAdmin = isAdminRequest(req);
    const criticalChangesRequested =
      (title !== undefined && title.trim() !== task.title) ||
      (description !== undefined && description !== task.description) ||
      (due_date !== undefined && due_date !== task.due_date) ||
      labels !== undefined;

    if (!isAdmin && criticalChangesRequested) {
      return res.status(403).json({ error: 'Apenas administradores podem alterar titulo, descricao, prazo ou etiquetas.' });
    }

    // RBAC: Verificações de permissão para usuário comum
    if (!req.isBot && req.user && req.user.role === 'user') {
      const isAssignee = task.assignee_discord_id === req.user.id;
      const isReviewPhase = task.phase === 'revisao' || phase === 'revisao';
      if (!isAssignee && !isReviewPhase) {
        return res.status(403).json({ error: 'Você só pode editar tarefas atribuídas a você, ou tarefas ligadas à Revisão.' });
      }
    }

    const changes = [];
    const updateFields = [];
    const params = [];

    // Title change audit
    if (title !== undefined && title.trim() !== task.title) {
      updateFields.push('title = ?');
      params.push(title.trim());
      changes.push({ type: 'title_changed', prev: task.title, next: title.trim() });
    }

    // Description change audit
    if (description !== undefined && description !== task.description) {
      updateFields.push('description = ?');
      params.push(description);
      changes.push({ type: 'description_changed', prev: null, next: null });
    }

    // Phase change audit
    if (phase !== undefined && phase !== task.phase) {
      // Validate phase
      const phaseCheck = db.prepare('SELECT name FROM phases WHERE id = ?').get(phase);
      if (phaseCheck) {
        updateFields.push('phase = ?');
        params.push(phase);
        
        const oldPhaseRow = db.prepare('SELECT name FROM phases WHERE id = ?').get(task.phase);
        const oldPhaseName = oldPhaseRow ? oldPhaseRow.name : task.phase;
        changes.push({ type: 'phase_changed', prev: oldPhaseName, next: phaseCheck.name });
      }
    }

    if (time_spent !== undefined && parseFloat(time_spent) !== task.time_spent) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem ajustar o tempo total. Use registrar tempo para somar novas horas.' });
      }
      const parsedTime = parseFloat(time_spent) || 0;
      updateFields.push('time_spent = ?');
      params.push(parsedTime);
      changes.push({ type: 'time_adjusted', prev: String(task.time_spent || 0), next: String(parsedTime) });
    }

    if (due_date !== undefined && due_date !== task.due_date) {
      updateFields.push('due_date = ?');
      params.push(due_date || null);
    }

    // Assignee change audit
    if (assignee_discord_id !== undefined && assignee_discord_id !== task.assignee_discord_id) {
      if (!assignee_discord_id) {
        // Clear assignment
        updateFields.push('assignee_discord_id = NULL', 'assignee_name = NULL', 'assignee_email = NULL');
        changes.push({ type: 'unassigned', prev: task.assignee_name || 'Sem atribuição', next: null });
      } else {
        // Fetch matching mapped Discord user from DB
        const discUser = db.prepare('SELECT * FROM discord_users WHERE id = ?').get(assignee_discord_id);
        if (discUser) {
          updateFields.push('assignee_discord_id = ?', 'assignee_name = ?', 'assignee_email = ?');
          params.push(discUser.id, discUser.display_name, `${discUser.username}@discord.com`);
          
          const oldAssignee = task.assignee_name || 'Sem atribuição';
          changes.push({ type: 'assigned', prev: oldAssignee, next: discUser.display_name });
        }
      }
    }

    // Handle tags/labels updates
    let labelsChanged = false;
    if (labels !== undefined && Array.isArray(labels)) {
      // Get existing label IDs linked to this task
      const currentLabels = db.prepare('SELECT label_id FROM task_labels WHERE task_id = ?').all(taskId).map(l => l.label_id);
      
      const newLabelIds = labels.map(id => parseInt(id, 10));
      
      const added = newLabelIds.filter(id => !currentLabels.includes(id));
      const removed = currentLabels.filter(id => !newLabelIds.includes(id));

      if (added.length > 0 || removed.length > 0) {
        labelsChanged = true;
        // Delete removed links
        for (const id of removed) {
          db.prepare('DELETE FROM task_labels WHERE task_id = ? AND label_id = ?').run(taskId, id);
        }
        // Insert new links
        for (const id of added) {
          db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)').run(taskId, id);
        }
        changes.push({ type: 'labels_changed', prev: null, next: null });
      }
    }

    // If anything changed, save the database updates in a single execution block
    if (updateFields.length > 0 || labelsChanged) {
      updateFields.push('last_edited_by_name = ?', 'last_edited_by_discord_id = ?', "updated_at = datetime('now')");
      params.push(actor_name, actor_discord_id);

      if (updateFields.length > 3) { // more than just editor fields
        const query = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(taskId);
        db.prepare(query).run(...params);
      }

      // --- Webhook for Critical Review ---
      if (phase === 'revisao' && task.phase !== 'revisao') {
        try {
          const taskLabels = db.prepare(`
            SELECT l.name FROM labels l
            JOIN task_labels tl ON tl.label_id = l.id
            WHERE tl.task_id = ?
          `).all(taskId);
          
          const isCritical = taskLabels.some(l => 
            l.name.toLowerCase().includes('estratégica') || 
            l.name.toLowerCase().includes('estrategica') || 
            l.name.toLowerCase().includes('urgente') || 
            l.name.toLowerCase().includes('bug') || 
            l.name.toLowerCase().includes('crítica') ||
            l.name.toLowerCase().includes('critica')
          );

          if (isCritical) {
            triggerCriticalReviewWebhook({
                taskId: taskId,
                title: title || task.title,
                actor_name: actor_name,
                assignee_discord_id: assignee_discord_id || task.assignee_discord_id,
                labels: taskLabels
              });
          }
        } catch(e) { console.error('Error in webhook logic:', e); }
      }

      // Record activity logs
      const insertAct = db.prepare(`
        INSERT INTO activity_log (task_id, action, from_phase, to_phase, actor_name, actor_discord_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const change of changes) {
        insertAct.run(
          taskId,
          change.type,
          change.prev ? String(change.prev) : null,
          change.next ? String(change.next) : null,
          actor_name,
          actor_discord_id
        );
      }
      
      // Save dynamic fields as a structured comment
      if (dynamic_fields && typeof dynamic_fields === 'object' && Object.keys(dynamic_fields).length > 0) {
        const fieldsText = Object.entries(dynamic_fields)
          .map(([key, val]) => `**${key}**: ${val}`)
          .join('\n');
        
        const commentText = `📝 **Formulário Preenchido na Mudança de Fase:**\n${fieldsText}`;
        
        db.prepare(`
          INSERT INTO comments (task_id, author_name, author_discord_id, text)
          VALUES (?, ?, ?, ?)
        `).run(taskId, actor_name, actor_discord_id, commentText);
      }

      broadcastBoardUpdate(taskId, 'edited');
    }

    if (time_spent_delta !== undefined && parseFloat(time_spent_delta) > 0) {
      addTimeEntry({
        taskId,
        phase: task.phase,
        minutes: time_spent_delta,
        note: time_note,
        source: 'task_update',
        actorName: actor_name,
        actorDiscordId: actor_discord_id
      });
      broadcastBoardUpdate(taskId, 'time_logged');
    }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    return res.json(formatTask(updatedTask));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 8. POST /api/tasks/:id/comments (Requires Auth or API Key)
router.post('/api/tasks/:id/comments', requireAuthOrApiKey, (req, res) => {
  try {
    const { text, author_name, author_discord_id } = req.body;
    const taskId = req.params.id;
    
    if (!text || !author_name) {
      return res.status(400).json({ error: 'Comment text and author_name are required.' });
    }
    
    const task = db.prepare('SELECT id, phase FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    
    const info = db.prepare(`
      INSERT INTO comments (task_id, author_name, author_discord_id, text)
      VALUES (?, ?, ?, ?)
    `).run(taskId, author_name, author_discord_id || null, text);
    
    // Commenting acts as an update to the task
    db.prepare(`
      UPDATE tasks
      SET last_edited_by_name = ?, last_edited_by_discord_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(author_name, author_discord_id || null, taskId);

    db.prepare(`
      INSERT INTO activity_log (task_id, action, phase, to_phase, actor_name, actor_discord_id)
      VALUES (?, 'commented', ?, ?, ?, ?)
    `).run(taskId, 'commented', task.phase, text, author_name, author_discord_id || null);

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
    
    broadcastBoardUpdate(taskId, 'commented');
    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/api/tasks/:id/time', (req, res) => {
  try {
    const taskId = req.params.id;
    const task = getTaskOrNull(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    return res.json({
      totalMinutes: task.time_spent || 0,
      ...getTimeSummary(taskId)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/api/tasks/:id/time', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const { minutes, note = '' } = req.body;
    const task = getTaskOrNull(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const actor = actorFromRequest(req, req.body);
    const entry = addTimeEntry({
      taskId,
      phase: task.phase,
      minutes,
      note,
      source: 'manual',
      actorName: actor.name,
      actorDiscordId: actor.discordId
    });

    if (!entry) return res.status(400).json({ error: 'Informe um tempo maior que zero.' });

    broadcastBoardUpdate(taskId, 'time_logged');
    const updatedTask = getTaskOrNull(taskId);
    return res.status(201).json({
      entry,
      totalMinutes: updatedTask.time_spent || 0,
      timeSummary: getTimeSummary(taskId)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/api/tasks/:id/observations', (req, res) => {
  try {
    const taskId = req.params.id;
    const task = getTaskOrNull(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const observations = db.prepare(`
      SELECT *
      FROM task_observations
      WHERE task_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `).all(taskId);

    return res.json(observations);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/api/tasks/:id/observations', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const { text, time_spent_minutes = 0 } = req.body;
    const task = getTaskOrNull(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (!text || !text.trim()) return res.status(400).json({ error: 'Observation text is required.' });

    const actor = actorFromRequest(req, req.body);
    const minutes = Math.max(0, parseFloat(time_spent_minutes) || 0);

    const info = db.prepare(`
      INSERT INTO task_observations (task_id, phase, author_name, author_discord_id, text, time_spent_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, task.phase, actor.name, actor.discordId, text.trim(), minutes);

    if (minutes > 0) {
      addTimeEntry({
        taskId,
        phase: task.phase,
        minutes,
        note: text.trim(),
        source: 'observation',
        actorName: actor.name,
        actorDiscordId: actor.discordId
      });
    }

    addTaskActivity(taskId, 'observation_added', task.phase, null, text.trim(), actor.name, actor.discordId);
    broadcastBoardUpdate(taskId, 'observation_added');

    const observation = db.prepare('SELECT * FROM task_observations WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json(observation);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/api/observations/:id', requireAuthOrApiKey, (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: 'Apenas administradores podem remover observacoes.' });
    }

    const observation = db.prepare('SELECT * FROM task_observations WHERE id = ?').get(req.params.id);
    if (!observation) return res.status(404).json({ error: 'Observation not found.' });

    const actor = actorFromRequest(req, req.body || {});
    db.prepare(`
      UPDATE task_observations
      SET deleted_at = datetime('now'), deleted_by_name = ?
      WHERE id = ?
    `).run(actor.name, req.params.id);

    addTaskActivity(observation.task_id, 'observation_deleted', observation.phase, observation.text, null, actor.name, actor.discordId);
    broadcastBoardUpdate(observation.task_id, 'observation_deleted');
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/api/tasks/:id/ownership/start', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const task = getTaskOrNull(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const actor = actorFromRequest(req, req.body);
    const avatarUrl = req.body.avatar_url || (req.user && req.user.avatarUrl) || null;

    if (task.active_owner_discord_id && task.active_owner_discord_id !== actor.discordId && !isAdminRequest(req)) {
      return res.status(409).json({ error: `${task.active_owner_name || 'Outro usuario'} ja esta trabalhando nesta task.` });
    }

    db.prepare(`
      UPDATE tasks
      SET active_owner_discord_id = ?,
          active_owner_name = ?,
          active_owner_avatar_url = ?,
          active_owner_started_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(actor.discordId, actor.name, avatarUrl, taskId);

    addTaskActivity(taskId, 'work_started', task.phase, null, null, actor.name, actor.discordId);
    broadcastBoardUpdate(taskId, 'work_started');
    return res.json(formatTask(getTaskOrNull(taskId)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/api/tasks/:id/ownership', requireAuthOrApiKey, (req, res) => {
  try {
    const taskId = req.params.id;
    const task = getTaskOrNull(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const actor = actorFromRequest(req, req.body || {});
    if (task.active_owner_discord_id && task.active_owner_discord_id !== actor.discordId && !isAdminRequest(req)) {
      return res.status(403).json({ error: 'Apenas quem iniciou o trabalho ou um admin pode liberar a task.' });
    }

    db.prepare(`
      UPDATE tasks
      SET active_owner_discord_id = NULL,
          active_owner_name = NULL,
          active_owner_avatar_url = NULL,
          active_owner_started_at = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(taskId);

    addTaskActivity(taskId, 'work_stopped', task.phase, task.active_owner_name, null, actor.name, actor.discordId);
    broadcastBoardUpdate(taskId, 'work_stopped');
    return res.json(formatTask(getTaskOrNull(taskId)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 9. GET /api/tasks/:id/comments (Public)
router.get('/api/tasks/:id/comments', (req, res) => {
  try {
    const taskId = req.params.id;
    const comments = db.prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
    
    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 11.5. GET /api/tasks/:id/activity
router.get('/api/tasks/:id/activity', (req, res) => {
  try {
    const taskId = req.params.id;
    const activities = db.prepare('SELECT * FROM activity_log WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 11. DELETE /api/tasks/:id (Requires Auth or API Key)
router.delete('/api/tasks/:id', requireAuthOrApiKey, (req, res) => {
  try {
    if (!req.isBot && req.user && req.user.role === 'user') {
      return res.status(403).json({ error: 'Apenas administradores ou PMs podem excluir tarefas.' });
    }

    const taskId = req.params.id;

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // CASCADE delete handles: comments, audit_trail, task_labels
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    broadcastBoardUpdate(taskId, 'deleted');
    return res.json({ success: true, message: `Task ${taskId} deleted.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 12. PATCH /api/comments/:id (Edit or Pin)
router.patch('/api/comments/:id', requireAuthOrApiKey, (req, res) => {
  try {
    if (!req.isBot && req.user && req.user.role === 'user') {
      return res.status(403).json({ error: 'Apenas administradores podem editar/fixar comentários.' });
    }

    const commentId = req.params.id;
    const { text, is_pinned, actor_name = 'Admin', actor_discord_id = null } = req.body;

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });

    let query = "UPDATE comments SET edited_at = datetime('now')";
    const params = [];

    if (text !== undefined) {
      query += ', text = ?';
      params.push(text);
    }
    if (is_pinned !== undefined) {
      query += ', is_pinned = ?';
      params.push(is_pinned ? 1 : 0);
    }

    query += ' WHERE id = ?';
    params.push(commentId);

    db.prepare(query).run(...params);
    broadcastBoardUpdate(comment.task_id, 'comment_edited');

    const updated = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    return res.json(updated);
  } catch (error) {
    console.error('Error updating comment:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 13. DELETE /api/comments/:id (Soft Delete)
router.delete('/api/comments/:id', requireAuthOrApiKey, (req, res) => {
  try {
    if (!req.isBot && req.user && req.user.role === 'user') {
      return res.status(403).json({ error: 'Apenas administradores podem excluir comentários.' });
    }

    const commentId = req.params.id;
    const { actor_name = 'Admin', actor_discord_id = null } = req.body || {};

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });

    db.prepare(`
      UPDATE comments 
      SET deleted_at = datetime('now'), deleted_by_name = ?
      WHERE id = ?
    `).run(actor_name, commentId);

    broadcastBoardUpdate(comment.task_id, 'comment_deleted');

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🚀 ENDPOINTS DE CHECKLISTS
// ==========================================

router.post('/api/tasks/:id/checklists', requireAuthOrApiKey, (req, res) => {
  try {
    const { title, description = '', status = 'todo', assignee_name = null, assignee_discord_id = null, time_spent = 0 } = req.body;
    const taskId = req.params.id;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required.' });
    
    const actor_name = req.body.actor_name || (req.user ? req.user.name : 'System');
    const actor_discord_id = req.body.actor_discord_id || (req.user ? req.user.id : null);

    const info = db.prepare(`
      INSERT INTO task_checklists (task_id, title, description, status, assignee_name, assignee_discord_id, time_spent, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM task_checklists WHERE task_id = ?))
    `).run(taskId, title.trim(), description, status, assignee_name, assignee_discord_id, time_spent, taskId);
    
    const clId = info.lastInsertRowid;

    // Log checklist creation
    db.prepare(`
      INSERT INTO checklist_activity (checklist_id, task_id, action, to_value, actor_name, actor_discord_id)
      VALUES (?, ?, 'created', ?, ?, ?)
    `).run(clId, taskId, title.trim(), actor_name, actor_discord_id);

    broadcastBoardUpdate(taskId, 'checklist_added');
    return res.status(201).json({ id: clId, task_id: taskId, title: title.trim(), description, status, assignee_name, assignee_discord_id, time_spent, is_completed: 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/api/checklists/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const { title, description, status, assignee_name, assignee_discord_id, time_spent, time_spent_delta, is_completed } = req.body;
    const clId = req.params.id;
    
    const actor_name = req.body.actor_name || (req.user ? req.user.name : 'System');
    const actor_discord_id = req.body.actor_discord_id || (req.user ? req.user.id : null);

    const cl = db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(clId);
    if (!cl) return res.status(404).json({ error: 'Checklist item not found.' });

    const updates = [];
    const params = [];
    const changes = [];

    if (title !== undefined && title.trim() !== cl.title) {
      updates.push('title = ?');
      params.push(title.trim());
      changes.push({ action: 'title_changed', from: cl.title, to: title.trim() });
    }

    if (description !== undefined && description !== cl.description) {
      updates.push('description = ?');
      params.push(description);
      changes.push({ action: 'description_changed', from: cl.description, to: description });
    }

    let targetStatus = status;
    if (is_completed !== undefined) {
      targetStatus = is_completed ? 'done' : 'todo';
    }

    if (targetStatus !== undefined && targetStatus !== cl.status) {
      updates.push('status = ?');
      params.push(targetStatus);
      changes.push({ action: 'status_changed', from: cl.status, to: targetStatus });

      // Set or clear completion details
      if (targetStatus === 'done') {
        updates.push("completed_at = datetime('now')", "completed_by = ?");
        params.push(actor_name);
        changes.push({ action: 'completed', from: null, to: actor_name });
      } else {
        updates.push("completed_at = NULL", "completed_by = NULL");
      }
    }

    if (assignee_name !== undefined && assignee_name !== cl.assignee_name) {
      updates.push('assignee_name = ?, assignee_discord_id = ?');
      params.push(assignee_name || null, assignee_discord_id || null);
      changes.push({ action: 'assignee_changed', from: cl.assignee_name, to: assignee_name });
    }

    if (time_spent_delta !== undefined && parseFloat(time_spent_delta) > 0) {
      const delta = parseFloat(time_spent_delta);
      const newTotal = (cl.time_spent || 0) + delta;
      updates.push('time_spent = ?');
      params.push(newTotal);
      changes.push({ action: 'time_spent_changed', from: String(cl.time_spent || 0), to: String(newTotal) });
    } else if (time_spent !== undefined && parseFloat(time_spent) !== cl.time_spent) {
      const t = parseFloat(time_spent) || 0;
      updates.push('time_spent = ?');
      params.push(t);
      changes.push({ action: 'time_spent_changed', from: String(cl.time_spent), to: String(t) });
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      const query = `UPDATE task_checklists SET ${updates.join(', ')} WHERE id = ?`;
      params.push(clId);
      db.prepare(query).run(...params);

      // --- Propagate time delta up to parent task ---
      const timeDelta = parseFloat(time_spent_delta);
      if (time_spent_delta !== undefined && timeDelta > 0) {
        db.prepare(`
          UPDATE tasks SET time_spent = COALESCE(time_spent, 0) + ?, updated_at = datetime('now') WHERE id = ?
        `).run(timeDelta, cl.task_id);

        // Log in task activity for the timeline
        db.prepare(`
          INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
          VALUES (?, 'time_logged', ?, ?, ?, ?, ?)
        `).run(
          cl.task_id,
          cl.status,
          String(cl.time_spent || 0),
          `Etapa "${cl.title}": +${timeDelta} min`,
          actor_name,
          actor_discord_id
        );
      }

      // Record checklist activities
      const insertClAct = db.prepare(`
        INSERT INTO checklist_activity (checklist_id, task_id, action, from_value, to_value, actor_name, actor_discord_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const change of changes) {
        insertClAct.run(clId, cl.task_id, change.action, change.from, change.to, actor_name, actor_discord_id);
      }

      // Also write a general entry to task activity log so it appears in task timeline!
      const firstChange = changes[0];
      if (firstChange && time_spent_delta === undefined) {
        db.prepare(`
          INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(cl.task_id, 'checklist_updated', cl.status, firstChange.action, `${cl.title}: ${firstChange.to}`, actor_name, actor_discord_id);
      }
    }

    broadcastBoardUpdate(cl.task_id, 'checklist_updated');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/api/checklists/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const clId = req.params.id;
    const cl = db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(clId);
    if (!cl) return res.status(404).json({ error: 'Checklist item not found.' });

    const actor_name = req.body.actor_name || (req.user ? req.user.name : 'System');
    const actor_discord_id = req.body.actor_discord_id || (req.user ? req.user.id : null);

    db.prepare('DELETE FROM task_checklists WHERE id = ?').run(clId);

    // Add general task activity log for checklist deletion
    db.prepare(`
      INSERT INTO activity_log (task_id, action, phase, from_phase, actor_name, actor_discord_id)
      VALUES (?, 'checklist_deleted', ?, ?, ?, ?)
    `).run(cl.task_id, cl.status, cl.title, actor_name, actor_discord_id);

    broadcastBoardUpdate(cl.task_id, 'checklist_deleted');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Checklist item comments
router.post('/api/checklists/:id/comments', requireAuthOrApiKey, (req, res) => {
  try {
    const { text, author_name, author_discord_id } = req.body;
    const clId = req.params.id;
    if (!text || !author_name) {
      return res.status(400).json({ error: 'Text and author_name are required.' });
    }

    const cl = db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(clId);
    if (!cl) return res.status(404).json({ error: 'Checklist item not found.' });

    const info = db.prepare(`
      INSERT INTO checklist_comments (checklist_id, author_name, author_discord_id, text)
      VALUES (?, ?, ?, ?)
    `).run(clId, author_name, author_discord_id || null, text);

    // Also log in checklist activity
    db.prepare(`
      INSERT INTO checklist_activity (checklist_id, task_id, action, to_value, actor_name, actor_discord_id)
      VALUES (?, ?, 'commented', ?, ?, ?)
    `).run(clId, cl.task_id, text, author_name, author_discord_id || null);

    broadcastBoardUpdate(cl.task_id, 'checklist_commented');
    return res.status(201).json({ id: info.lastInsertRowid, checklist_id: clId, author_name, author_discord_id, text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/api/checklists/:id/comments', (req, res) => {
  try {
    const clId = req.params.id;
    const comments = db.prepare('SELECT * FROM checklist_comments WHERE checklist_id = ? ORDER BY created_at DESC').all(clId);
    return res.json(comments);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🚀 ENDPOINT DE LOGS DA FASE
// ==========================================

router.get('/api/tasks/:id/activity/by-phase', (req, res) => {
  try {
    const taskId = req.params.id;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    // Fetch phase transition logs (created, moved)
    const transitions = db.prepare(`
      SELECT * FROM activity_log 
      WHERE task_id = ? AND action IN ('created', 'moved')
      ORDER BY created_at ASC
    `).all(taskId);

    // Build timeline intervals
    const intervals = [];
    const now = new Date();

    if (transitions.length === 0) {
      intervals.push({
        phase: task.phase || 'todo',
        start: new Date(task.created_at + (task.created_at.endsWith('Z') ? '' : 'Z')),
        end: now
      });
    } else {
      for (let i = 0; i < transitions.length; i++) {
        const current = transitions[i];
        const start = new Date(current.created_at + (current.created_at.endsWith('Z') ? '' : 'Z'));
        const next = transitions[i + 1];
        const end = next 
          ? new Date(next.created_at + (next.created_at.endsWith('Z') ? '' : 'Z')) 
          : now;
        
        let phase = current.to_phase || current.phase || 'todo';
        if (current.action === 'created') {
          phase = current.phase || task.phase || 'todo';
        }
        intervals.push({ phase, start, end });
      }
    }

    // Sum time spent in each phase
    const phaseDurations = {};
    for (const interval of intervals) {
      const dur = interval.end - interval.start;
      phaseDurations[interval.phase] = (phaseDurations[interval.phase] || 0) + dur;
    }

    // Fetch all events for the task
    const activities = db.prepare('SELECT * FROM activity_log WHERE task_id = ?').all(taskId);
    const comments = db.prepare("SELECT * FROM comments WHERE task_id = ? AND deleted_at IS NULL").all(taskId);
    const checklistActs = db.prepare(`
      SELECT ca.*, cl.title as checklist_title
      FROM checklist_activity ca
      JOIN task_checklists cl ON ca.checklist_id = cl.id
      WHERE ca.task_id = ?
    `).all(taskId);

    // Helper to assign phase to timestamp
    function getPhase(timestamp) {
      const t = new Date(timestamp + (timestamp.endsWith('Z') ? '' : 'Z'));
      for (const interval of intervals) {
        if (t >= interval.start && t <= interval.end) {
          return interval.phase;
        }
      }
      if (intervals.length > 0) {
        if (t < intervals[0].start) return intervals[0].phase;
        return intervals[intervals.length - 1].phase;
      }
      return task.phase || 'todo';
    }

    // Construct a unified timeline event list
    const events = [];

    // Process activity_log
    for (const act of activities) {
      events.push({
        type: act.action,
        timestamp: act.created_at,
        actor_name: act.actor_name || 'System',
        actor_discord_id: act.actor_discord_id,
        phase: act.phase || getPhase(act.created_at),
        details: {
          from_phase: act.from_phase,
          to_phase: act.to_phase
        }
      });
    }

    // Process comments
    for (const comm of comments) {
      events.push({
        type: 'commented',
        timestamp: comm.created_at,
        actor_name: comm.author_name,
        actor_discord_id: comm.author_discord_id,
        phase: getPhase(comm.created_at),
        details: {
          text: comm.text
        }
      });
    }

    // Process checklist activities
    for (const cl of checklistActs) {
      events.push({
        type: `checklist_${cl.action}`,
        timestamp: cl.created_at,
        actor_name: cl.actor_name || 'System',
        actor_discord_id: cl.actor_discord_id,
        phase: getPhase(cl.created_at),
        details: {
          title: cl.checklist_title,
          from_value: cl.from_value,
          to_value: cl.to_value
        }
      });
    }

    // Sort events chronologically
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Get all column/phase definitions to organize output
    const phases = db.prepare('SELECT * FROM phases ORDER BY position ASC').all();
    const phaseNames = {};
    for (const p of phases) {
      phaseNames[p.id] = p.name;
    }

    // Group events by phase
    const grouped = {};
    for (const p of phases) {
      grouped[p.id] = {
        phaseId: p.id,
        phaseName: p.name,
        totalTimeMs: phaseDurations[p.id] || 0,
        events: []
      };
    }

    // Ensure we also have a group for any unlisted/deleted phases just in case
    for (const ev of events) {
      if (!grouped[ev.phase]) {
        grouped[ev.phase] = {
          phaseId: ev.phase,
          phaseName: phaseNames[ev.phase] || ev.phase,
          totalTimeMs: phaseDurations[ev.phase] || 0,
          events: []
        };
      }
      grouped[ev.phase].events.push(ev);
    }

    // Convert grouped object to array sorted by position of phases
    const result = [];
    for (const p of phases) {
      if (grouped[p.id]) {
        result.push(grouped[p.id]);
      }
    }
    // Append any extra phases
    for (const phaseId in grouped) {
      if (!phases.some(p => p.id === phaseId)) {
        result.push(grouped[phaseId]);
      }
    }

    // Now format each group by users
    for (const group of result) {
      const userMap = {};
      for (const ev of group.events) {
        const u = ev.actor_name;
        if (!userMap[u]) {
          userMap[u] = {
            name: u,
            discordId: ev.actor_discord_id,
            actions: []
          };
        }
        userMap[u].actions.push(ev);
      }
      group.users = Object.values(userMap);
      group.actionCount = group.events.length;
      delete group.events; // clean up raw list
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
