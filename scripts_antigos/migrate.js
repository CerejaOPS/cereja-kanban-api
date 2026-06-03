import Database from 'better-sqlite3';
const db = new Database('./data/kanban.db');
try {
  db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL;');
  console.log('Column due_date added to tasks table successfully.');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('Column due_date already exists.');
  } else {
    console.error('Error adding column:', e);
  }
}
