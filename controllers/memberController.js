import { db } from '../database.js';

/**
 * Controller para rotas de membros.
 * @module memberController
 */

export const getMembers = (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM discord_users ORDER BY display_name ASC').all();
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
