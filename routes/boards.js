import express from 'express';
import { db } from '../database.js';
import { authenticateApiKey, authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

function requireAuthOrApiKey(req, res, next) {
  if (req.headers['x-api-key']) {
    return authenticateApiKey(req, res, next);
  }
  return authenticateJWT(req, res, next);
}

// GET /api/boards - Lista todos os boards
router.get('/api/boards', (req, res) => {
  try {
    const boards = db.prepare('SELECT * FROM boards ORDER BY id ASC').all();
    return res.json(boards);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/boards/:id - Retorna um board
router.get('/api/boards/:id', (req, res) => {
  try {
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    return res.json(board);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/boards - Cria um novo board
router.post('/api/boards', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const info = db.prepare(`
      INSERT INTO boards (name, color, icon) VALUES (?, ?, ?)
    `).run(name, color || '#6C63FF', icon || '📋');

    return res.status(201).json({
      id: info.lastInsertRowid,
      name,
      color: color || '#6C63FF',
      icon: icon || '📋'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/boards/:id - Atualiza um board
router.put('/api/boards/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, color, icon } = req.body;
    const boardId = req.params.id;
    
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const info = db.prepare(`
      UPDATE boards SET name = ?, color = ?, icon = ?, updated_at = datetime('now') WHERE id = ?
    `).run(name, color, icon, boardId);

    if (info.changes === 0) return res.status(404).json({ error: 'Board not found' });

    const updated = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/boards/:id - Deleta um board
router.delete('/api/boards/:id', requireAuthOrApiKey, (req, res) => {
  try {
    const boardId = req.params.id;
    
    // Check if it has tasks
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE board_id = ?').get(boardId).count;
    if (taskCount > 0) {
      return res.status(400).json({ error: 'Cannot delete board with existing tasks. Move or delete tasks first.' });
    }

    const info = db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);
    if (info.changes === 0) return res.status(404).json({ error: 'Board not found' });
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BOARD FIELDS (Custom Fields por Quadro)
// ==========================================

// GET /api/boards/:id/fields - Lista campos customizados do quadro
router.get('/api/boards/:id/fields', (req, res) => {
  try {
    const fields = db.prepare('SELECT * FROM board_fields WHERE board_id = ? ORDER BY position ASC').all(req.params.id);
    return res.json(fields);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/boards/:id/fields - Cria campo customizado
router.post('/api/boards/:id/fields', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, type, options, is_required_on_start, position } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do campo é obrigatório.' });

    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM board_fields WHERE board_id = ?').get(req.params.id).next;

    const info = db.prepare(`
      INSERT INTO board_fields (board_id, name, type, options, is_required_on_start, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, name, type || 'text', options || null, is_required_on_start ? 1 : 0, position ?? maxPos);

    const field = db.prepare('SELECT * FROM board_fields WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json(field);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/boards/:boardId/fields/:fieldId - Atualiza campo
router.put('/api/boards/:boardId/fields/:fieldId', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, type, options, is_required_on_start, position } = req.body;
    const info = db.prepare(`
      UPDATE board_fields SET name = ?, type = ?, options = ?, is_required_on_start = ?, position = ?
      WHERE id = ? AND board_id = ?
    `).run(name, type || 'text', options || null, is_required_on_start ? 1 : 0, position ?? 0, req.params.fieldId, req.params.boardId);

    if (info.changes === 0) return res.status(404).json({ error: 'Campo não encontrado.' });

    const field = db.prepare('SELECT * FROM board_fields WHERE id = ?').get(req.params.fieldId);
    return res.json(field);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/boards/:boardId/fields/:fieldId - Remove campo
router.delete('/api/boards/:boardId/fields/:fieldId', requireAuthOrApiKey, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM board_fields WHERE id = ? AND board_id = ?').run(req.params.fieldId, req.params.boardId);
    if (info.changes === 0) return res.status(404).json({ error: 'Campo não encontrado.' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PHASE RULES (Políticas de Fase)
// ==========================================

// GET /api/boards/:id/phase-rules - Lista regras de fase do quadro
router.get('/api/boards/:id/phase-rules', (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM phase_rules WHERE board_id = ?').all(req.params.id);
    return res.json(rules);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/boards/:id/phase-rules/:phaseId - Cria ou atualiza regra de fase
router.put('/api/boards/:id/phase-rules/:phaseId', requireAuthOrApiKey, (req, res) => {
  try {
    const { require_checklist_done, require_assignee, required_field_ids } = req.body;
    const boardId = req.params.id;
    const phaseId = req.params.phaseId;

    const fieldIdsJson = JSON.stringify(required_field_ids || []);

    db.prepare(`
      INSERT INTO phase_rules (board_id, phase_id, require_checklist_done, require_assignee, required_field_ids)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(board_id, phase_id) DO UPDATE SET
        require_checklist_done = excluded.require_checklist_done,
        require_assignee = excluded.require_assignee,
        required_field_ids = excluded.required_field_ids
    `).run(boardId, phaseId, require_checklist_done ? 1 : 0, require_assignee ? 1 : 0, fieldIdsJson);

    const rule = db.prepare('SELECT * FROM phase_rules WHERE board_id = ? AND phase_id = ?').get(boardId, phaseId);
    return res.json(rule);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/boards/:id/phase-rules/:phaseId - Remove regra de fase
router.delete('/api/boards/:id/phase-rules/:phaseId', requireAuthOrApiKey, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM phase_rules WHERE board_id = ? AND phase_id = ?').run(req.params.id, req.params.phaseId);
    if (info.changes === 0) return res.status(404).json({ error: 'Regra não encontrada.' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TASK FIELD VALUES
// ==========================================

// GET /api/tasks/:taskId/fields - Lista valores dos campos de uma task
router.get('/api/tasks/:taskId/fields', (req, res) => {
  try {
    const values = db.prepare(`
      SELECT tfv.*, bf.name AS field_name, bf.type AS field_type, bf.options AS field_options
      FROM task_field_values tfv
      JOIN board_fields bf ON bf.id = tfv.field_id
      WHERE tfv.task_id = ?
      ORDER BY bf.position ASC
    `).all(req.params.taskId);
    return res.json(values);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:taskId/fields - Salva/atualiza valores dos campos da task
router.put('/api/tasks/:taskId/fields', requireAuthOrApiKey, (req, res) => {
  try {
    const { fields } = req.body; // Array de { field_id, value }
    if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields deve ser um array.' });

    const upsert = db.prepare(`
      INSERT INTO task_field_values (task_id, field_id, value)
      VALUES (?, ?, ?)
      ON CONFLICT(task_id, field_id) DO UPDATE SET value = excluded.value
    `);

    const runAll = db.transaction(() => {
      for (const f of fields) {
        upsert.run(req.params.taskId, f.field_id, f.value || '');
      }
    });
    runAll();

    const values = db.prepare(`
      SELECT tfv.*, bf.name AS field_name, bf.type AS field_type
      FROM task_field_values tfv
      JOIN board_fields bf ON bf.id = tfv.field_id
      WHERE tfv.task_id = ?
      ORDER BY bf.position ASC
    `).all(req.params.taskId);
    return res.json(values);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BOARD FIELDS (Campos Customizados por Quadro)
// ==========================================

// GET /api/boards/:id/fields
router.get('/api/boards/:id/fields', (req, res) => {
  try {
    const fields = db.prepare('SELECT * FROM board_fields WHERE board_id = ? ORDER BY position ASC').all(req.params.id);
    return res.json(fields);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/boards/:id/fields
router.post('/api/boards/:id/fields', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, type, options, is_required_on_start, position } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do campo é obrigatório.' });

    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM board_fields WHERE board_id = ?').get(req.params.id).next;

    const info = db.prepare(`
      INSERT INTO board_fields (board_id, name, type, options, is_required_on_start, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, name, type || 'text', options || null, is_required_on_start ? 1 : 0, position ?? maxPos);

    const field = db.prepare('SELECT * FROM board_fields WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json(field);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/boards/:boardId/fields/:fieldId
router.put('/api/boards/:boardId/fields/:fieldId', requireAuthOrApiKey, (req, res) => {
  try {
    const { name, type, options, is_required_on_start, position } = req.body;
    const info = db.prepare(`
      UPDATE board_fields SET name = ?, type = ?, options = ?, is_required_on_start = ?, position = ?
      WHERE id = ? AND board_id = ?
    `).run(name, type || 'text', options || null, is_required_on_start ? 1 : 0, position ?? 0, req.params.fieldId, req.params.boardId);

    if (info.changes === 0) return res.status(404).json({ error: 'Campo não encontrado.' });

    const field = db.prepare('SELECT * FROM board_fields WHERE id = ?').get(req.params.fieldId);
    return res.json(field);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/boards/:boardId/fields/:fieldId
router.delete('/api/boards/:boardId/fields/:fieldId', requireAuthOrApiKey, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM board_fields WHERE id = ? AND board_id = ?').run(req.params.fieldId, req.params.boardId);
    if (info.changes === 0) return res.status(404).json({ error: 'Campo não encontrado.' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PHASE RULES (Políticas de Fase)
// ==========================================

// GET /api/boards/:id/phase-rules
router.get('/api/boards/:id/phase-rules', (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM phase_rules WHERE board_id = ?').all(req.params.id);
    return res.json(rules);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/boards/:id/phase-rules/:phaseId - Cria ou atualiza regra
router.put('/api/boards/:id/phase-rules/:phaseId', requireAuthOrApiKey, (req, res) => {
  try {
    const { require_checklist_done, require_assignee, required_field_ids } = req.body;
    const boardId = req.params.id;
    const phaseId = req.params.phaseId;

    const fieldIdsJson = JSON.stringify(required_field_ids || []);

    db.prepare(`
      INSERT INTO phase_rules (board_id, phase_id, require_checklist_done, require_assignee, required_field_ids)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(board_id, phase_id) DO UPDATE SET
        require_checklist_done = excluded.require_checklist_done,
        require_assignee = excluded.require_assignee,
        required_field_ids = excluded.required_field_ids
    `).run(boardId, phaseId, require_checklist_done ? 1 : 0, require_assignee ? 1 : 0, fieldIdsJson);

    const rule = db.prepare('SELECT * FROM phase_rules WHERE board_id = ? AND phase_id = ?').get(boardId, phaseId);
    return res.json(rule);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/boards/:id/phase-rules/:phaseId
router.delete('/api/boards/:id/phase-rules/:phaseId', requireAuthOrApiKey, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM phase_rules WHERE board_id = ? AND phase_id = ?').run(req.params.id, req.params.phaseId);
    if (info.changes === 0) return res.status(404).json({ error: 'Regra não encontrada.' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TASK FIELD VALUES
// ==========================================

// GET /api/tasks/:taskId/fields
router.get('/api/tasks/:taskId/fields', (req, res) => {
  try {
    const values = db.prepare(`
      SELECT tfv.*, bf.name AS field_name, bf.type AS field_type, bf.options AS field_options
      FROM task_field_values tfv
      JOIN board_fields bf ON bf.id = tfv.field_id
      WHERE tfv.task_id = ?
      ORDER BY bf.position ASC
    `).all(req.params.taskId);
    return res.json(values);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:taskId/fields - Salva/atualiza valores dos campos
router.put('/api/tasks/:taskId/fields', requireAuthOrApiKey, (req, res) => {
  try {
    const { fields } = req.body; // Array de { field_id, value }
    if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields deve ser um array.' });

    const upsert = db.prepare(`
      INSERT INTO task_field_values (task_id, field_id, value)
      VALUES (?, ?, ?)
      ON CONFLICT(task_id, field_id) DO UPDATE SET value = excluded.value
    `);

    const runAll = db.transaction(() => {
      for (const f of fields) {
        upsert.run(req.params.taskId, f.field_id, f.value || '');
      }
    });
    runAll();

    const values = db.prepare(`
      SELECT tfv.*, bf.name AS field_name, bf.type AS field_type
      FROM task_field_values tfv
      JOIN board_fields bf ON bf.id = tfv.field_id
      WHERE tfv.task_id = ?
      ORDER BY bf.position ASC
    `).all(req.params.taskId);
    return res.json(values);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
