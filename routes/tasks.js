import { Router } from 'express';
import { AppError } from '../utils/AppError.js';
import { getDb } from '../lib/db.js';
import { 
  broadcastBoardUpdate, 
  triggerWebhook, 
  triggerCriticalReviewWebhook,
  isAdminRequest,
  actorFromRequest,
  getTaskOrNull,
  addTimeEntry,
  formatTask
} from '../controllers/helpers.js';

const router = Router();

// ==========================================
// 1. FASES (PHASES)
// ==========================================

router.get('/api/phases', async (req, res, next) => {
  try {
    const db = await getDb();
    const phases = await db.any('SELECT * FROM phases ORDER BY position ASC');
    return res.json(phases);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/phases', async (req, res, next) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) throw new AppError('id and name are required', 400);

    const db = await getDb();
    const row = await db.one('SELECT COALESCE(MAX(position), 0) as max_pos FROM phases');
    const position = parseInt(row.max_pos) + 1;

    const newPhase = await db.one(`
      INSERT INTO phases (id, name, position)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, name, position]);
    
    return res.status(201).json(newPhase);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/phases/reorder', async (req, res, next) => {
  try {
    const { phases } = req.body;
    if (!Array.isArray(phases)) throw new AppError('phases array is required', 400);

    const db = await getDb();
    await db.tx(async t => {
      for (const p of phases) {
        await t.none('UPDATE phases SET position = $1 WHERE id = $2', [p.position, p.id]);
      }
    });
    
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/phases/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // reassign tasks to backlog
    await db.none('UPDATE tasks SET phase = $1 WHERE phase = $2', ['backlog', id]);
    await db.none('DELETE FROM phases WHERE id = $1', [id]);
    
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 2. LABELS
// ==========================================

router.get('/api/labels', async (req, res, next) => {
  try {
    const db = await getDb();
    const labels = await db.any('SELECT * FROM labels ORDER BY name ASC');
    return res.json(labels);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/labels', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) throw new AppError('name and color are required', 400);

    const db = await getDb();
    const newLabel = await db.one(`
      INSERT INTO labels (name, color)
      VALUES ($1, $2)
      RETURNING *
    `, [name, color]);
    return res.status(201).json(newLabel);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/labels/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const db = await getDb();
    
    const updated = await db.one(`
      UPDATE labels SET name = $1, color = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [name, color, parseInt(id)]);
    
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/labels/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    await db.none('DELETE FROM labels WHERE id = $1', [parseInt(req.params.id)]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 3. MEMBERS (DISCORD USERS)
// ==========================================

router.get('/api/members', async (req, res, next) => {
  try {
    const db = await getDb();
    const users = await db.any('SELECT * FROM discord_users ORDER BY display_name ASC');
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 4. TASKS (GET)
// ==========================================

router.get('/api/tasks', async (req, res, next) => {
  try {
    const db = await getDb();
    let rawTasks;
    if (req.query.board_id) {
      rawTasks = await db.any('SELECT * FROM tasks WHERE board_id = $1 ORDER BY updated_at DESC', [parseInt(req.query.board_id)]);
    } else {
      rawTasks = await db.any('SELECT * FROM tasks ORDER BY updated_at DESC');
    }
    
    const formatted = await Promise.all(rawTasks.map(t => formatTask(t)));
    return res.json(formatted);
  } catch (error) {
    return next(error);
  }
});

router.get('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);
    const formatted = await formatTask(task);
    return res.json(formatted);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 5. TASKS (POST, PATCH phase, assign, thread)
// ==========================================

router.post('/api/tasks', async (req, res, next) => {
  try {
    const { title, phase, assignee_discord_id, labels, board_id } = req.body;
    if (!title) throw new AppError('title is required', 400);

    let assignee_name = null;
    let assignee_email = null;

    const db = await getDb();

    if (assignee_discord_id) {
      const u = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [assignee_discord_id]);
      if (u) {
        assignee_name = u.display_name;
      } else {
        const adminUsers = process.env.ADMIN_USERS ? process.env.ADMIN_USERS.split(',').map(s=>s.trim().toLowerCase()) : [];
        if (adminUsers.includes(assignee_discord_id.toLowerCase())) {
          assignee_name = 'Admin';
        }
      }
    }

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);

    const targetPhase = phase || 'todo';
    const targetBoardId = board_id ? parseInt(board_id) : 1;

    const newTask = await db.tx(async t => {
      const task = await t.one(`
        INSERT INTO tasks (title, phase, board_id, assignee_discord_id, assignee_name, assignee_email, last_edited_by_name, last_edited_by_discord_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [title, targetPhase, targetBoardId, assignee_discord_id || null, assignee_name, assignee_email, actorName, actorDiscordId]);

      if (labels && Array.isArray(labels)) {
        for (const labelId of labels) {
          await t.none('INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [task.id, parseInt(labelId)]);
        }
      }

      await t.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'created', targetPhase, actorName, actorDiscordId]);

      return task;
    });

    const formatted = await formatTask(newTask);
    broadcastBoardUpdate(newTask.id, 'created');
    triggerWebhook('task_created', formatted, { name: actorName, discord_id: actorDiscordId });

    return res.status(201).json(formatted);
  } catch (error) {
    return next(error);
  }
});

router.patch('/api/tasks/:id/phase', async (req, res, next) => {
  try {
    const { phase } = req.body;
    if (!phase) throw new AppError('phase is required', 400);

    const db = await getDb();
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const oldPhase = task.phase;
    if (oldPhase === phase) return res.json({ success: true, task: await formatTask(task) });

    // Validate phase rules
    const rule = await db.oneOrNone('SELECT * FROM phase_rules WHERE board_id = $1 AND phase_id = $2', [task.board_id, phase]);

    if (rule) {
      if (rule.require_assignee && !task.assignee_discord_id) {
        throw new AppError(`Phase ${phase} requires an assignee.`, 400);
      }
      if (rule.require_checklist_done) {
        const row = await db.one('SELECT COUNT(*) FROM task_checklists WHERE task_id = $1 AND is_completed = false', [task.id]);
        if (parseInt(row.count) > 0) {
          throw new AppError(`Phase ${phase} requires all checklists to be completed.`, 400);
        }
      }
    }

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);

    const updated = await db.tx(async t => {
      const u = await t.one(`
        UPDATE tasks SET phase = $1, last_edited_by_name = $2, last_edited_by_discord_id = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [phase, actorName, actorDiscordId, task.id]);

      await t.none(`
        INSERT INTO activity_logs (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [task.id, 'moved', oldPhase, oldPhase, phase, actorName, actorDiscordId]);
      
      return u;
    });

    const formatted = await formatTask(updated);
    broadcastBoardUpdate(task.id, 'moved');
    triggerWebhook('task_phase_changed', formatted, { name: actorName, discord_id: actorDiscordId });

    if (phase === 'revisao') {
      triggerCriticalReviewWebhook({
        taskId: task.id,
        title: task.title,
        from_phase: oldPhase,
        to_phase: phase,
        actor_name: actorName,
        actor_discord_id: actorDiscordId,
        labels: formatted.labels.map(l => l.name)
      });
    }

    return res.json({ success: true, task: formatted });
  } catch (error) {
    return next(error);
  }
});
router.patch('/api/tasks/:id/assign', async (req, res, next) => {
  try {
    const { assignee_discord_id } = req.body;
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const db = await getDb();
    let assigneeName = null;
    let assigneeEmail = null;
    if (assignee_discord_id) {
      const u = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [assignee_discord_id]);
      if (u) assigneeName = u.display_name;
    }

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);

    const updated = await db.tx(async t => {
      const u = await t.one(`
        UPDATE tasks SET assignee_discord_id = $1, assignee_name = $2, assignee_email = $3, last_edited_by_name = $4, last_edited_by_discord_id = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `, [assignee_discord_id || null, assigneeName, assigneeEmail, actorName, actorDiscordId, task.id]);

      await t.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'assigned', task.phase, actorName, actorDiscordId]);
      
      return u;
    });

    const formatted = await formatTask(updated);
    broadcastBoardUpdate(task.id, 'edited');
    triggerWebhook('task_assigned', formatted, { name: actorName, discord_id: actorDiscordId });

    return res.json({ success: true, task: formatted });
  } catch (error) {
    return next(error);
  }
});

router.patch('/api/tasks/:id/thread', async (req, res, next) => {
  try {
    const { discord_thread_id } = req.body;
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const db = await getDb();
    const updated = await db.one(`
      UPDATE tasks SET discord_thread_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *
    `, [discord_thread_id || null, task.id]);

    const formatted = await formatTask(updated);
    broadcastBoardUpdate(task.id, 'edited');

    return res.json({ success: true, task: formatted });
  } catch (error) {
    return next(error);
  }
});

router.put('/api/tasks/:id/labels', async (req, res, next) => {
  try {
    const { labels } = req.body;
    if (!Array.isArray(labels)) throw new AppError('labels must be an array', 400);

    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();

    await db.tx(async tx => {
      await tx.none('DELETE FROM task_labels WHERE task_id = $1', [task.id]);
      if (labels.length > 0) {
        for (const l of labels) {
          await tx.none('INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)', [task.id, parseInt(l)]);
        }
      }
      await tx.none(`
        UPDATE tasks SET last_edited_by_name = $1, last_edited_by_discord_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [actorName, actorDiscordId, task.id]);
      
      await tx.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'labels_updated', task.phase, actorName, actorDiscordId]);
    });

    const formatted = await formatTask(await getTaskOrNull(task.id));
    broadcastBoardUpdate(task.id, 'edited');

    return res.json({ success: true, task: formatted });
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const db = await getDb();
    await db.none('DELETE FROM tasks WHERE id = $1', [task.id]);
    broadcastBoardUpdate(task.id, 'deleted');

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 6. TASKS (Dynamic Save)
// ==========================================

router.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const { title, description, phase, assignee_discord_id, labels, due_date, fields } = req.body;
    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();

    let assigneeName = task.assignee_name;
    let actualAssigneeId = task.assignee_discord_id;
    if (assignee_discord_id !== undefined) {
      actualAssigneeId = assignee_discord_id || null;
      if (assignee_discord_id) {
        const u = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [assignee_discord_id]);
        assigneeName = u ? u.display_name : null;
      } else {
        assigneeName = null;
      }
    }

    let actualPhase = task.phase;
    if (phase !== undefined && phase !== task.phase) {
      const rule = await db.oneOrNone('SELECT * FROM phase_rules WHERE board_id = $1 AND phase_id = $2', [task.board_id, phase]);
      if (rule) {
        if (rule.require_assignee && !actualAssigneeId) {
          throw new AppError(`Phase ${phase} requires an assignee.`, 400);
        }
        if (rule.require_checklist_done) {
          const row = await db.one('SELECT COUNT(*) FROM task_checklists WHERE task_id = $1 AND is_completed = false', [task.id]);
          if (parseInt(row.count) > 0) {
            throw new AppError(`Phase ${phase} requires checklists to be completed.`, 400);
          }
        }
      }
      actualPhase = phase;
    }

    await db.tx(async tx => {
      // Dynamic update mapping
      const updates = [];
      const values = [];
      let i = 1;
      
      updates.push(`last_edited_by_name = $${i++}`);
      values.push(actorName);
      updates.push(`last_edited_by_discord_id = $${i++}`);
      values.push(actorDiscordId);
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
      if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
      if (due_date !== undefined) { updates.push(`due_date = $${i++}`); values.push(due_date); }
      if (assignee_discord_id !== undefined) { 
        updates.push(`assignee_discord_id = $${i++}`); values.push(actualAssigneeId); 
        updates.push(`assignee_name = $${i++}`); values.push(assigneeName);
      }
      if (phase !== undefined) { updates.push(`phase = $${i++}`); values.push(actualPhase); }

      values.push(task.id);
      await tx.none(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${i}`, values);

      if (labels && Array.isArray(labels)) {
        await tx.none('DELETE FROM task_labels WHERE task_id = $1', [task.id]);
        for (const l of labels) {
          await tx.none('INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)', [task.id, parseInt(l)]);
        }
      }

      if (fields && Array.isArray(fields)) {
        for (const f of fields) {
          if (f.id && f.value !== undefined) {
            await tx.none(`
              INSERT INTO task_field_values (task_id, field_id, value)
              VALUES ($1, $2, $3)
              ON CONFLICT (task_id, field_id) DO UPDATE SET value = EXCLUDED.value
            `, [task.id, parseInt(f.id), String(f.value)]);
          }
        }
      }

      await tx.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'edited', actualPhase, actorName, actorDiscordId]);
    });

    const formatted = await formatTask(await getTaskOrNull(task.id));
    broadcastBoardUpdate(task.id, 'edited');
    
    if (actualPhase !== task.phase) {
       triggerWebhook('task_phase_changed', formatted, { name: actorName, discord_id: actorDiscordId });
    }

    return res.json({ success: true, task: formatted });
  } catch (error) {
    return next(error);
  }
});
// ==========================================
// 8. COMMENTS
// ==========================================

router.post('/api/tasks/:id/comments', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) throw new AppError('text is required', 400);

    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();

    const comment = await db.one(`
      INSERT INTO comments (task_id, text, author_name, author_discord_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [task.id, text, actorName, actorDiscordId]);

    await db.none(`
      INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [task.id, 'commented', task.phase, actorName, actorDiscordId]);

    broadcastBoardUpdate(task.id, 'commented');
    return res.status(201).json(comment);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/tasks/:id/comments/:commentId', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) throw new AppError('text is required', 400);

    const db = await getDb();
    const updated = await db.one(`
      UPDATE comments SET text = $1, edited_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [text, parseInt(req.params.commentId)]);

    broadcastBoardUpdate(req.params.id, 'comment_edited');
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/tasks/:id/comments/:commentId', async (req, res, next) => {
  try {
    const { name: actorName } = actorFromRequest(req, req.body);
    const db = await getDb();

    await db.none(`
      UPDATE comments SET deleted_at = CURRENT_TIMESTAMP, deleted_by_name = $1
      WHERE id = $2
    `, [actorName, parseInt(req.params.commentId)]);

    broadcastBoardUpdate(req.params.id, 'comment_deleted');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch('/api/tasks/:id/comments/:commentId/pin', async (req, res, next) => {
  try {
    const { isPinned } = req.body;
    const db = await getDb();
    const updated = await db.one(`
      UPDATE comments SET is_pinned = $1 WHERE id = $2 RETURNING *
    `, [!!isPinned, parseInt(req.params.commentId)]);

    broadcastBoardUpdate(req.params.id, 'comment_pinned');
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 10. TIME
// ==========================================

router.post('/api/tasks/:id/time', async (req, res, next) => {
  try {
    const { minutes, note, phase, source } = req.body;
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);

    const entry = await addTimeEntry({
      taskId: task.id,
      phase: phase || task.phase,
      minutes,
      note,
      source,
      actorName,
      actorDiscordId
    });

    broadcastBoardUpdate(task.id, 'time_logged');
    return res.status(201).json(entry || { success: true, ignored: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 11. OBSERVATIONS
// ==========================================

router.post('/api/tasks/:id/observations', async (req, res, next) => {
  try {
    const { text, time_spent_minutes, phase } = req.body;
    if (!text) throw new AppError('text is required', 400);

    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();
    
    await db.tx(async tx => {
      const timeMins = parseFloat(time_spent_minutes) || 0;
      const obsPhase = phase || task.phase;

      const obs = await tx.one(`
        INSERT INTO task_observations (task_id, text, phase, time_spent_minutes, author_name, author_discord_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [task.id, text, obsPhase, timeMins, actorName, actorDiscordId]);

      if (timeMins > 0) {
        await tx.none(`
          INSERT INTO task_time_entries (task_id, phase, minutes, note, source, actor_name, actor_discord_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [task.id, obsPhase, timeMins, `Auto-logged from observation #${obs.id}`, 'observation', actorName, actorDiscordId]);

        await tx.none('UPDATE tasks SET time_spent = time_spent + $1, last_edited_by_name = $2, last_edited_by_discord_id = $3 WHERE id = $4', 
          [timeMins, actorName, actorDiscordId, task.id]);
      }

      await tx.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'observation_added', task.phase, actorName, actorDiscordId]);
    });

    broadcastBoardUpdate(task.id, 'observation_added');
    return res.status(201).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/tasks/:id/observations/:obsId', async (req, res, next) => {
  try {
    const { name: actorName } = actorFromRequest(req, req.body);
    const db = await getDb();
    await db.none(`
      UPDATE task_observations SET deleted_at = CURRENT_TIMESTAMP, deleted_by_name = $1
      WHERE id = $2
    `, [actorName, parseInt(req.params.obsId)]);

    broadcastBoardUpdate(req.params.id, 'observation_deleted');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 12. OWNERSHIP (Active Owner)
// ==========================================

router.post('/api/tasks/:id/take', async (req, res, next) => {
  try {
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);
    if (task.active_owner_discord_id) throw new AppError('Task already taken', 400);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();
    
    const u = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [actorDiscordId || '']);
    
    await db.tx(async tx => {
      await tx.none(`
        UPDATE tasks SET active_owner_discord_id = $1, active_owner_name = $2, active_owner_avatar_url = $3, active_owner_started_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [actorDiscordId, actorName, u ? u.avatar_url : null, task.id]);

      await tx.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'taken', task.phase, actorName, actorDiscordId]);
    });

    broadcastBoardUpdate(task.id, 'taken');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/tasks/:id/release', async (req, res, next) => {
  try {
    const { minutes, note, phase } = req.body;
    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);
    if (!task.active_owner_discord_id) return res.json({ success: true });

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const isSelf = task.active_owner_discord_id === actorDiscordId;

    if (!isSelf && !isAdminRequest(req)) {
      throw new AppError('Not authorized to release', 403);
    }

    const m = Math.max(0, parseFloat(minutes) || 0);
    const db = await getDb();

    await db.tx(async tx => {
      await tx.none(`
        UPDATE tasks SET active_owner_discord_id = NULL, active_owner_name = NULL, active_owner_avatar_url = NULL, active_owner_started_at = NULL, time_spent = time_spent + $1
        WHERE id = $2
      `, [m, task.id]);

      if (m > 0) {
        await tx.none(`
          INSERT INTO task_time_entries (task_id, phase, minutes, note, source, actor_name, actor_discord_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [task.id, phase || task.phase, m, note || '', 'session_release', actorName, actorDiscordId]);
      }

      await tx.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, isSelf ? 'released' : 'force_released', task.phase, actorName, actorDiscordId]);
    });

    broadcastBoardUpdate(task.id, 'released');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 13. CHECKLISTS
// ==========================================

router.post('/api/tasks/:id/checklists', async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) throw new AppError('title is required', 400);

    const task = await getTaskOrNull(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();
    
    const row = await db.one('SELECT COALESCE(MAX(position), 0) as max_pos FROM task_checklists WHERE task_id = $1', [task.id]);
    const position = parseInt(row.max_pos) + 1;

    const checklist = await db.tx(async tx => {
      const cl = await tx.one(`
        INSERT INTO task_checklists (task_id, title, description, position)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [task.id, title, description || '', position]);

      await tx.none(`
        INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'checklist_created', task.phase, actorName, actorDiscordId]);
      
      return cl;
    });

    broadcastBoardUpdate(task.id, 'checklist_created');
    return res.status(201).json(checklist);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/tasks/:id/checklists/:checklistId', async (req, res, next) => {
  try {
    const { title, description, status, assignee_discord_id, is_completed } = req.body;
    const clId = parseInt(req.params.checklistId);
    
    const db = await getDb();
    const oldCl = await db.oneOrNone('SELECT * FROM task_checklists WHERE id = $1', [clId]);
    if (!oldCl || String(oldCl.task_id) !== String(req.params.id)) throw new AppError('Checklist not found', 404);

    const task = await getTaskOrNull(req.params.id);
    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    
    let assigneeName = oldCl.assignee_name;
    let actualAssigneeId = oldCl.assignee_discord_id;
    if (assignee_discord_id !== undefined) {
      actualAssigneeId = assignee_discord_id || null;
      if (assignee_discord_id) {
        const u = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [assignee_discord_id]);
        assigneeName = u ? u.display_name : null;
      } else {
        assigneeName = null;
      }
    }

    let actualIsCompleted = oldCl.is_completed;
    let completedAt = oldCl.completed_at;
    let completedBy = oldCl.completed_by;
    let actualStatus = status !== undefined ? status : oldCl.status;

    if (is_completed !== undefined && is_completed !== oldCl.is_completed) {
      actualIsCompleted = !!is_completed;
      if (actualIsCompleted) {
        completedAt = new Date().toISOString();
        completedBy = actorName;
        actualStatus = 'done';
      } else {
        completedAt = null;
        completedBy = null;
        if (actualStatus === 'done') actualStatus = 'todo';
      }
    }

    const updated = await db.tx(async tx => {
      // Dynamic update
      const updates = [];
      const values = [];
      let i = 1;
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      updates.push(`assignee_discord_id = $${i++}`); values.push(actualAssigneeId);
      updates.push(`assignee_name = $${i++}`); values.push(assigneeName);
      updates.push(`is_completed = $${i++}`); values.push(actualIsCompleted);
      updates.push(`completed_at = $${i++}`); values.push(completedAt);
      updates.push(`completed_by = $${i++}`); values.push(completedBy);
      updates.push(`status = $${i++}`); values.push(actualStatus);
      
      if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
      if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
      
      values.push(clId);
      
      const u = await tx.one(`
        UPDATE task_checklists SET ${updates.join(', ')}
        WHERE id = $${i}
        RETURNING *
      `, values);

      if (actualIsCompleted && !oldCl.is_completed) {
        await tx.none(`
          INSERT INTO checklist_activities (checklist_id, task_id, action, actor_name, actor_discord_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [clId, task.id, 'completed', actorName, actorDiscordId]);
        
        await tx.none(`
          INSERT INTO activity_logs (task_id, action, phase, actor_name, actor_discord_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [task.id, 'checklist_completed', task.phase, actorName, actorDiscordId]);
      }
      return u;
    });

    broadcastBoardUpdate(task.id, 'checklist_updated');
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/tasks/:id/checklists/:checklistId/comments', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) throw new AppError('text is required', 400);

    const { name: actorName, discordId: actorDiscordId } = actorFromRequest(req, req.body);
    const db = await getDb();
    
    const comment = await db.one(`
      INSERT INTO checklist_comments (checklist_id, author_name, author_discord_id, text)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [parseInt(req.params.checklistId), actorName, actorDiscordId, text]);

    broadcastBoardUpdate(req.params.id, 'checklist_commented');
    return res.status(201).json(comment);
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/tasks/:id/checklists/:checklistId', async (req, res, next) => {
  try {
    const db = await getDb();
    await db.none('DELETE FROM task_checklists WHERE id = $1', [parseInt(req.params.checklistId)]);
    broadcastBoardUpdate(req.params.id, 'checklist_deleted');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 14. ACTIVITY LOG & EXPORT
// ==========================================

router.get('/api/activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const db = await getDb();

    // The activity feed usually queries logs with tasks
    const logs = await db.any(`
      SELECT a.*, t.title as task_title, t.phase as task_phase 
      FROM activity_logs a
      LEFT JOIN tasks t ON t.id = a.task_id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Shape response like Prisma's to avoid breaking frontend blindly
    const shaped = logs.map(l => ({
      ...l,
      task: { title: l.task_title, phase: l.task_phase }
    }));

    return res.json(shaped);
  } catch (error) {
    return next(error);
  }
});

export default router;
