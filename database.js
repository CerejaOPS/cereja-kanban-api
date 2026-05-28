import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const DB_PATH = process.env.DB_PATH || './data/kanban.db';
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(col => col.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureDefaultPhases() {
  const defaultPhases = [
    { id: 'backlog', name: 'Backlog', position: 0 },
    { id: 'todo', name: 'TO-DO', position: 1 },
    { id: 'andamento', name: 'Em Andamento', position: 2 },
    { id: 'revisao', name: 'Em Revisão', position: 3 },
    { id: 'bloqueado', name: 'Bloqueado', position: 4 },
    { id: 'concluido', name: 'Concluído', position: 5 }
  ];

  const getPhase = db.prepare('SELECT id FROM phases WHERE id = ?');
  const getPosition = db.prepare('SELECT id FROM phases WHERE position = ?');
  const getMaxPosition = db.prepare('SELECT COALESCE(MAX(position), -1) AS maxPosition FROM phases');
  const insertPhase = db.prepare('INSERT INTO phases (id, name, position) VALUES (?, ?, ?)');

  for (const phase of defaultPhases) {
    if (getPhase.get(phase.id)) continue;

    let position = phase.position;
    if (getPosition.get(position)) {
      position = getMaxPosition.get().maxPosition + 1;
    }

    insertPhase.run(phase.id, phase.name, position);
  }
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      phase TEXT DEFAULT 'todo',
      assignee_discord_id TEXT DEFAULT NULL,
      assignee_name TEXT DEFAULT NULL,
      assignee_email TEXT DEFAULT NULL,
      last_edited_by_name TEXT DEFAULT NULL,
      last_edited_by_discord_id TEXT DEFAULT NULL,
      time_spent REAL DEFAULT 0,
      due_date TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_labels (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo','doing','review','done','blocked')),
      assignee_name TEXT DEFAULT NULL,
      assignee_discord_id TEXT DEFAULT NULL,
      time_spent REAL DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      completed_at TEXT DEFAULT NULL,
      completed_by TEXT DEFAULT NULL,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      phase TEXT DEFAULT NULL,
      from_phase TEXT,
      to_phase TEXT,
      actor_name TEXT,
      actor_discord_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_discord_id TEXT,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      actor_name TEXT,
      actor_discord_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_discord_id TEXT,
      text TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      edited_at TEXT DEFAULT NULL,
      deleted_at TEXT DEFAULT NULL,
      deleted_by_name TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      phase TEXT DEFAULT NULL,
      minutes REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      actor_name TEXT NOT NULL,
      actor_discord_id TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      phase TEXT DEFAULT NULL,
      author_name TEXT NOT NULL,
      author_discord_id TEXT DEFAULT NULL,
      text TEXT NOT NULL,
      time_spent_minutes REAL DEFAULT 0,
      deleted_at TEXT DEFAULT NULL,
      deleted_by_name TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  ensureColumn('tasks', 'active_owner_discord_id', 'TEXT DEFAULT NULL');
  ensureColumn('tasks', 'active_owner_name', 'TEXT DEFAULT NULL');
  ensureColumn('tasks', 'active_owner_avatar_url', 'TEXT DEFAULT NULL');
  ensureColumn('tasks', 'active_owner_started_at', 'TEXT DEFAULT NULL');
  ensureDefaultPhases();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_task_time_entries_task ON task_time_entries(task_id, created_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_task_observations_task ON task_observations(task_id, created_at)').run();

  console.log('Database initialized successfully.');
}
