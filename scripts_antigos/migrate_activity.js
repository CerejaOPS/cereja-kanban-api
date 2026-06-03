import Database from 'better-sqlite3';
const db = new Database('./data/kanban.db');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      from_phase TEXT,
      to_phase TEXT,
      actor_name TEXT,
      actor_discord_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('activity_log table created successfully.');
} catch (e) {
  console.error('Error creating activity_log:', e.message);
}
