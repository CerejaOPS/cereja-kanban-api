import { db } from '../database.js';

/**
 * Controller para rotas de etiquetas (labels).
 * @module labelController
 */

export const getLabels = (req, res) => {
  try {
    const labels = db.prepare('SELECT * FROM labels ORDER BY name ASC').all();
    return res.json(labels);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createLabel = (req, res) => {
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
};

export const deleteLabel = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM task_labels WHERE label_id = ?').run(id);
    db.prepare('DELETE FROM labels WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Label deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
