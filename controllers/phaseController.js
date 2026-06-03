import { db } from '../database.js';
import { broadcastBoardUpdate } from '../services/sseService.js';

/**
 * Controller para rotas de fases/colunas.
 * @module phaseController
 */

export const getPhases = (req, res) => {
  try {
    const phases = db.prepare('SELECT * FROM phases ORDER BY position ASC').all();
    return res.json(phases);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createPhase = (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Column name is required.' });
    }

    const id = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const existing = db.prepare('SELECT id FROM phases WHERE id = ?').get(id);
    if (existing) {
      return res.status(400).json({ error: 'A column with a similar name already exists.' });
    }

    const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM phases').get();
    const nextPos = (maxPosRow && maxPosRow.maxPos !== null) ? maxPosRow.maxPos + 1 : 0;

    db.prepare('INSERT INTO phases (id, name, position) VALUES (?, ?, ?)')
      .run(id, name.trim(), nextPos);

    broadcastBoardUpdate(0, 'phases_updated');
    return res.status(201).json({ id, name: name.trim(), position: nextPos });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updatePhase = (req, res) => {
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
};

export const deletePhase = (req, res) => {
  try {
    const { id } = req.params;

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
};
