import { db } from './database.js';

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(r => r.name).join(', '));

const r = db.prepare('SELECT COUNT(*) as c FROM task_time_entries').get();
console.log('Time entries:', r.c);

const t = db.prepare('SELECT COUNT(*) as c FROM tasks').get();
console.log('Tasks:', t.c);

const a = db.prepare('SELECT COUNT(*) as c FROM activity_log').get();
console.log('Activity logs:', a.c);
