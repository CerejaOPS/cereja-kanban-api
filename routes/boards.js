import { Router } from 'express';
import { AppError } from '../utils/AppError.js';
import { getDb } from '../lib/db.js';

const router = Router();

// ==========================================
// BOARDS
// ==========================================

router.get('/api/boards', async (req, res, next) => {
  try {
    const db = await getDb();
    const boards = await db.any('SELECT * FROM boards ORDER BY id ASC');
    return res.json(boards);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/boards', async (req, res, next) => {
  try {
    const { name, slug, description, color, icon } = req.body;
    if (!name || !slug) throw new AppError('name and slug are required', 400);

    const db = await getDb();
    const newBoard = await db.one(`
      INSERT INTO boards (name, slug, description, color, icon)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, slug, description, color, icon]);
    
    return res.status(201).json(newBoard);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/boards/:id', async (req, res, next) => {
  try {
    const { name, slug, description, color, icon, is_active } = req.body;
    const db = await getDb();
    
    const updated = await db.one(`
      UPDATE boards 
      SET name = $1, slug = $2, description = $3, color = $4, icon = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, slug, description, color, icon, is_active, req.params.id]);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/boards/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    await db.none('DELETE FROM boards WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// PHASE RULES
// ==========================================

router.get('/api/boards/:boardId/rules', async (req, res, next) => {
  try {
    const db = await getDb();
    const rules = await db.any('SELECT * FROM phase_rules WHERE board_id = $1', [req.params.boardId]);
    return res.json(rules);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/boards/:boardId/rules', async (req, res, next) => {
  try {
    const { phase_id, require_assignee, require_checklist_done, require_custom_fields } = req.body;
    if (!phase_id) throw new AppError('phase_id is required', 400);

    const db = await getDb();
    const upserted = await db.one(`
      INSERT INTO phase_rules (board_id, phase_id, require_assignee, require_checklist_done, require_custom_fields)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (board_id, phase_id) DO UPDATE SET
        require_assignee = EXCLUDED.require_assignee,
        require_checklist_done = EXCLUDED.require_checklist_done,
        require_custom_fields = EXCLUDED.require_custom_fields
      RETURNING *
    `, [req.params.boardId, phase_id, !!require_assignee, !!require_checklist_done, require_custom_fields]);

    return res.json(upserted);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// CUSTOM FIELDS
// ==========================================

router.get('/api/boards/:boardId/fields', async (req, res, next) => {
  try {
    const db = await getDb();
    const fields = await db.any('SELECT * FROM board_fields WHERE board_id = $1 ORDER BY position ASC', [req.params.boardId]);
    return res.json(fields);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/boards/:boardId/fields', async (req, res, next) => {
  try {
    const { name, type, options, required } = req.body;
    if (!name || !type) throw new AppError('name and type are required', 400);

    const db = await getDb();
    
    // Get max position
    const row = await db.one('SELECT COALESCE(MAX(position), 0) as max_pos FROM board_fields WHERE board_id = $1', [req.params.boardId]);
    const position = parseInt(row.max_pos) + 1;

    const newField = await db.one(`
      INSERT INTO board_fields (board_id, name, type, options, required, position)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.params.boardId, name, type, options, !!required, position]);

    return res.status(201).json(newField);
  } catch (error) {
    return next(error);
  }
});

router.put('/api/boards/:boardId/fields/:fieldId', async (req, res, next) => {
  try {
    const { name, options, required } = req.body;
    const db = await getDb();
    
    const updated = await db.one(`
      UPDATE board_fields 
      SET name = $1, options = $2, required = $3 
      WHERE id = $4 AND board_id = $5
      RETURNING *
    `, [name, options, !!required, req.params.fieldId, req.params.boardId]);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete('/api/boards/:boardId/fields/:fieldId', async (req, res, next) => {
  try {
    const db = await getDb();
    await db.none('DELETE FROM board_fields WHERE id = $1 AND board_id = $2', [req.params.fieldId, req.params.boardId]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
