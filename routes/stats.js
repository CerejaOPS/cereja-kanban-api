import { Router } from 'express';
import { db } from '../database.js';

const router = Router();

function parseDays(value, fallback = 30) {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days) || days < 1) return fallback;
  return Math.min(days, 365);
}

function toHours(minutes) {
  return Number((Number(minutes || 0) / 60).toFixed(1));
}

function getLastNDays(days) {
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    result.push(date.toISOString().slice(0, 10));
  }

  return result;
}

function isDoneTransitionWhereClause() {
  return `
    (
      (action = 'moved' AND to_phase = 'concluido')
      OR (
        action = 'phase_changed'
        AND LOWER(COALESCE(to_phase, '')) IN ('concluido', 'concluído')
      )
    )
  `;
}

function getCompletionCountForActor(actorDiscordId, actorName, sinceModifier) {
  const row = db.prepare(`
    SELECT COUNT(DISTINCT task_id) as total
    FROM activity_log
    WHERE ${isDoneTransitionWhereClause()}
      AND created_at >= datetime('now', ?)
      AND (
        (actor_discord_id IS NOT NULL AND actor_discord_id != '' AND actor_discord_id = ?)
        OR (actor_name IS NOT NULL AND actor_name != '' AND actor_name = ?)
      )
  `).get(sinceModifier, actorDiscordId || '', actorName || '');

  return row?.total || 0;
}

function getCurrentWorkForActor(actorDiscordId, actorName) {
  return db.prepare(`
    SELECT t.id, t.title, t.phase, p.name as phase_name
    FROM tasks t
    LEFT JOIN phases p ON p.id = t.phase
    WHERE t.phase != 'concluido'
      AND (
        (t.assignee_discord_id IS NOT NULL AND t.assignee_discord_id != '' AND t.assignee_discord_id = ?)
        OR (t.assignee_name IS NOT NULL AND t.assignee_name != '' AND t.assignee_name = ?)
      )
    ORDER BY
      CASE t.phase
        WHEN 'andamento' THEN 0
        WHEN 'bloqueado' THEN 1
        WHEN 'revisao' THEN 2
        ELSE 3
      END,
      datetime(t.updated_at) DESC
    LIMIT 1
  `).get(actorDiscordId || '', actorName || '');
}

// GET /api/stats/overview?days=30
router.get('/api/stats/overview', (req, res) => {
  try {
    const days = parseDays(req.query.days, 30);
    const sinceModifier = `-${days} days`;

    const totalMinutesRow = db.prepare('SELECT COALESCE(SUM(minutes), 0) as total FROM task_time_entries').get();
    const rangeMinutesRow = db.prepare(`
      SELECT COALESCE(SUM(minutes), 0) as total
      FROM task_time_entries
      WHERE created_at >= datetime('now', ?)
    `).get(sinceModifier);
    const last7MinutesRow = db.prepare(`
      SELECT COALESCE(SUM(minutes), 0) as total
      FROM task_time_entries
      WHERE created_at >= datetime('now', '-7 days')
    `).get();

    const taskCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN phase = 'concluido' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN phase = 'bloqueado' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN phase = 'revisao' THEN 1 ELSE 0 END) as review
      FROM tasks
    `).get();

    const deliveredInRange = db.prepare(`
      SELECT COUNT(DISTINCT task_id) as total
      FROM activity_log
      WHERE ${isDoneTransitionWhereClause()}
        AND created_at >= datetime('now', ?)
    `).get(sinceModifier);

    const activeMembers = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(NULLIF(actor_discord_id, ''), actor_name)) as total
      FROM task_time_entries
      WHERE created_at >= datetime('now', '-7 days')
        AND COALESCE(NULLIF(actor_discord_id, ''), actor_name) IS NOT NULL
    `).get();

    const timeByPhase = db.prepare(`
      SELECT
        COALESCE(e.phase, 'indefinida') as phase,
        COALESCE(p.name, e.phase, 'Indefinida') as phase_name,
        SUM(e.minutes) as minutes
      FROM task_time_entries e
      LEFT JOIN phases p ON p.id = e.phase
      WHERE e.created_at >= datetime('now', ?)
      GROUP BY COALESCE(e.phase, 'indefinida'), COALESCE(p.name, e.phase, 'Indefinida')
      ORDER BY minutes DESC
    `).all(sinceModifier);

    const historyRows = db.prepare(`
      SELECT date(created_at) as date, SUM(minutes) as minutes
      FROM task_time_entries
      WHERE created_at >= date('now', '-6 days')
      GROUP BY date(created_at)
    `).all();
    const historyMap = new Map(historyRows.map(row => [row.date, row.minutes || 0]));
    const history7Days = getLastNDays(7).map(date => ({
      date,
      hours: toHours(historyMap.get(date) || 0)
    }));

    return res.json({
      range: { days },
      overview: {
        totalHours: toHours(totalMinutesRow.total),
        hoursInRange: toHours(rangeMinutesRow.total),
        hoursLast7Days: toHours(last7MinutesRow.total),
        tasksDelivered: deliveredInRange.total || 0,
        totalDeliveredTasks: taskCounts.delivered || 0,
        tasksBlocked: taskCounts.blocked || 0,
        tasksInReview: taskCounts.review || 0,
        bottlenecks: (taskCounts.blocked || 0) + (taskCounts.review || 0),
        activeMembers: activeMembers.total || 0,
        totalTasks: taskCounts.total || 0
      },
      charts: {
        timeByPhase: timeByPhase.map(row => ({
          phase: row.phase,
          phaseName: row.phase_name,
          hours: toHours(row.minutes)
        })),
        history7Days
      }
    });
  } catch (error) {
    console.error('Erro ao buscar stats/overview:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/stats/team?days=30
router.get('/api/stats/team', (req, res) => {
  try {
    const days = parseDays(req.query.days, 30);
    const sinceModifier = `-${days} days`;

    const teamStats = db.prepare(`
      SELECT
        actor_name,
        actor_discord_id,
        SUM(minutes) as total_minutes,
        COUNT(DISTINCT task_id) as tasks_touched,
        MAX(created_at) as last_activity
      FROM task_time_entries
      WHERE created_at >= datetime('now', ?)
      GROUP BY actor_name, actor_discord_id
      ORDER BY total_minutes DESC
    `).all(sinceModifier);

    const formattedTeam = teamStats.map(member => {
      const currentWork = getCurrentWorkForActor(member.actor_discord_id, member.actor_name);

      return {
        name: member.actor_name || 'Desconhecido',
        discordId: member.actor_discord_id || null,
        totalHours: toHours(member.total_minutes),
        tasksTouched: member.tasks_touched || 0,
        tasksCompleted: getCompletionCountForActor(member.actor_discord_id, member.actor_name, sinceModifier),
        currentStatus: currentWork?.phase_name || 'Livre',
        currentTaskId: currentWork?.id ? String(currentWork.id) : null,
        currentTaskTitle: currentWork?.title || null,
        lastActivity: member.last_activity || null
      };
    });

    return res.json(formattedTeam);
  } catch (error) {
    console.error('Erro ao buscar stats/team:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/stats/impediments
router.get('/api/stats/impediments', (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 10, 50);
    const rows = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.phase,
        COALESCE(p.name, t.phase) as phase_name,
        t.assignee_name,
        t.assignee_discord_id,
        t.created_at,
        t.updated_at,
        COALESCE(SUM(e.minutes), 0) as total_minutes
      FROM tasks t
      LEFT JOIN phases p ON p.id = t.phase
      LEFT JOIN task_time_entries e ON e.task_id = t.id
      WHERE t.phase IN ('bloqueado', 'revisao')
        OR (
          t.phase != 'concluido'
          AND datetime(t.updated_at) <= datetime('now', '-3 days')
        )
      GROUP BY t.id
      ORDER BY
        CASE t.phase
          WHEN 'bloqueado' THEN 0
          WHEN 'revisao' THEN 1
          ELSE 2
        END,
        total_minutes DESC,
        datetime(t.updated_at) ASC
      LIMIT ?
    `).all(limit);

    return res.json(rows.map(row => ({
      id: String(row.id),
      title: row.title,
      phase: row.phase,
      phaseName: row.phase_name,
      assigneeName: row.assignee_name || 'Sem responsavel',
      assigneeDiscordId: row.assignee_discord_id || null,
      totalHours: toHours(row.total_minutes),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })));
  } catch (error) {
    console.error('Erro ao buscar stats/impediments:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Drilldown de metricas para listar tasks especificas
router.get('/api/stats/drilldown/:type', (req, res) => {
  try {
    const { type } = req.params;
    let query = '';
    
    if (type === 'blocked') {
      query = "SELECT * FROM tasks WHERE phase = 'bloqueado'";
    } else if (type === 'bottlenecks') {
      query = "SELECT * FROM tasks WHERE phase IN ('bloqueado', 'revisao')";
    } else if (type === 'delivered') {
      // Just an example, fetching recently delivered
      query = "SELECT * FROM tasks WHERE phase = 'concluido' ORDER BY updated_at DESC LIMIT 50";
    } else {
      return res.status(400).json({ error: 'Tipo desconhecido' });
    }

    const tasks = db.prepare(query).all();
    
    // Attach boards and phases
    const formatted = tasks.map(t => {
      const b = t.board_id ? db.prepare('SELECT * FROM boards WHERE id = ?').get(t.board_id) : null;
      return {
        id: t.id,
        title: t.title,
        phase: t.phase,
        board: b ? b.name : 'Geral',
        assignee_name: t.assignee_name || 'Livre'
      };
    });

    return res.json(formatted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
