import Database from 'better-sqlite3';
const db = new Database('./data/kanban.db');
try {
  db.exec('ALTER TABLE comments ADD COLUMN is_pinned INTEGER DEFAULT 0;');
  console.log('Column is_pinned added successfully.');
} catch (e) {
  console.log('is_pinned already exists or error:', e.message);
}

try {
  db.exec('ALTER TABLE comments ADD COLUMN edited_at TEXT DEFAULT NULL;');
  console.log('Column edited_at added successfully.');
} catch (e) {
  console.log('edited_at already exists or error:', e.message);
}

try {
  db.exec('ALTER TABLE comments ADD COLUMN deleted_at TEXT DEFAULT NULL;');
  console.log('Column deleted_at added successfully.');
} catch (e) {
  console.log('deleted_at already exists or error:', e.message);
}

try {
  db.exec('ALTER TABLE comments ADD COLUMN deleted_by_name TEXT DEFAULT NULL;');
  console.log('Column deleted_by_name added successfully.');
} catch (e) {
  console.log('deleted_by_name already exists or error:', e.message);
}
