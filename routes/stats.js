import { Router } from 'express';
import { AppError } from '../utils/AppError.js';
import { getDb } from '../lib/db.js';

const router = Router();

router.get('/api/stats', async (req, res, next) => {
  try {
    const db = await getDb();
    
    // Overview counts
    const totalTasksRow = await db.one('SELECT COUNT(*) as count FROM tasks WHERE is_archived = false');
    const completedTasksRow = await db.one("SELECT COUNT(*) as count FROM tasks WHERE phase = 'concluido' AND is_archived = false");
    const blockedTasksRow = await db.one("SELECT COUNT(*) as count FROM tasks WHERE phase = 'bloqueado' AND is_archived = false");

    // Tasks by phase
    const tasksByPhase = await db.any(`
      SELECT p.name as phase, COUNT(t.id) as count 
      FROM phases p 
      LEFT JOIN tasks t ON t.phase = p.id AND t.is_archived = false 
      GROUP BY p.name
    `);

    // Top members by tasks completed
    const topMembers = await db.any(`
      SELECT assignee_name as name, assignee_discord_id as id, COUNT(*) as completed_count 
      FROM tasks 
      WHERE phase = 'concluido' AND assignee_name IS NOT NULL 
      GROUP BY assignee_name, assignee_discord_id 
      ORDER BY completed_count DESC 
      LIMIT 5
    `);

    // Recent activities
    const recentActivity = await db.any(`
      SELECT action, phase, details, actor_name, created_at 
      FROM activity_logs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    // Time Tracking Stats
    const totalTimeRow = await db.one(`
      SELECT COALESCE(SUM(time_spent), 0) as sum FROM tasks WHERE is_archived = false
    `);
    
    const timeByPhase = await db.any(`
      SELECT p.name as phase, COALESCE(SUM(t.time_spent), 0) as time_spent
      FROM phases p
      LEFT JOIN tasks t ON t.phase = p.id AND t.is_archived = false
      GROUP BY p.name
      HAVING COALESCE(SUM(t.time_spent), 0) > 0
    `);

    const timeByMember = await db.any(`
      SELECT assignee_name as name, COALESCE(SUM(time_spent), 0) as time_spent
      FROM tasks
      WHERE assignee_name IS NOT NULL AND is_archived = false
      GROUP BY assignee_name
      HAVING COALESCE(SUM(time_spent), 0) > 0
      ORDER BY time_spent DESC
      LIMIT 10
    `);

    return res.json({
      overview: {
        totalTasks: parseInt(totalTasksRow.count),
        completedTasks: parseInt(completedTasksRow.count),
        blockedTasks: parseInt(blockedTasksRow.count)
      },
      tasksByPhase: tasksByPhase.map(r => ({ phase: r.phase, count: parseInt(r.count) })),
      topMembers: topMembers.map(r => ({ name: r.name, id: r.id, completedCount: parseInt(r.completed_count) })),
      recentActivity,
      timeTracking: {
        totalTimeSpentMinutes: parseFloat(totalTimeRow.sum),
        timeByPhase: timeByPhase.map(r => ({ phase: r.phase, time_spent: parseFloat(r.time_spent) })),
        timeByMember: timeByMember.map(r => ({ name: r.name, time_spent: parseFloat(r.time_spent) }))
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
