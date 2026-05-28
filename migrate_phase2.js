import Database from 'better-sqlite3';
const db = new Database('./data/kanban.db');

console.log('🚀 Iniciando migração Phase 2...');

// 1. Adicionar coluna phase em activity_log
try {
  db.exec("ALTER TABLE activity_log ADD COLUMN phase TEXT DEFAULT NULL;");
  console.log('✅ activity_log.phase adicionada');
} catch(e) { console.log('ℹ️  activity_log.phase:', e.message); }

// 2. Novas colunas em task_checklists
const checklistCols = [
  ["description", "TEXT DEFAULT ''"],
  ["status", "TEXT DEFAULT 'todo'"],
  ["assignee_name", "TEXT DEFAULT NULL"],
  ["assignee_discord_id", "TEXT DEFAULT NULL"],
  ["time_spent", "REAL DEFAULT 0"],
  ["completed_at", "TEXT DEFAULT NULL"],
  ["completed_by", "TEXT DEFAULT NULL"],
  ["updated_at", "TEXT DEFAULT (datetime('now'))"],
];
for (const [col, def] of checklistCols) {
  try {
    db.exec(`ALTER TABLE task_checklists ADD COLUMN ${col} ${def};`);
    console.log(`✅ task_checklists.${col} adicionada`);
  } catch(e) { console.log(`ℹ️  task_checklists.${col}:`, e.message); }
}

// 3. Migrar is_completed -> status
try {
  db.exec("UPDATE task_checklists SET status = 'done' WHERE is_completed = 1 AND (status IS NULL OR status = 'todo');");
  console.log('✅ Migração is_completed → status concluída');
} catch(e) { console.log('ℹ️  Migração is_completed:', e.message); }

// 4. Criar tabela checklist_comments
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_discord_id TEXT,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('✅ checklist_comments criada');
} catch(e) { console.log('ℹ️  checklist_comments:', e.message); }

// 5. Criar tabela checklist_activity
try {
  db.exec(`
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
  `);
  console.log('✅ checklist_activity criada');
} catch(e) { console.log('ℹ️  checklist_activity:', e.message); }

console.log('\n✅ Migração Phase 2 concluída!');
db.close();
