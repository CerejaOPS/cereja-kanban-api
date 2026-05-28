import { db, initDatabase } from './database.js';

async function seed() {
  console.log('Starting database seed with customized settings...');

  initDatabase();

  db.prepare('DELETE FROM users').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM comments').run();
  db.prepare('DELETE FROM activity_log').run();
  db.prepare('DELETE FROM phases').run();
  db.prepare('DELETE FROM labels').run();
  db.prepare('DELETE FROM task_labels').run();
  db.prepare('DELETE FROM discord_users').run();

  console.log('Fallback admin user creation skipped.');
  console.log('Users will be created dynamically upon login or via sync.');

  const defaultPhases = [
    { id: 'backlog', name: 'Backlog', position: 0 },
    { id: 'todo', name: 'TO-DO', position: 1 },
    { id: 'andamento', name: 'Em Andamento', position: 2 },
    { id: 'revisao', name: 'Em Revisão', position: 3 },
    { id: 'bloqueado', name: 'Bloqueado', position: 4 },
    { id: 'concluido', name: 'Concluído', position: 5 }
  ];

  for (const phase of defaultPhases) {
    db.prepare('INSERT INTO phases (id, name, position) VALUES (?, ?, ?)')
      .run(phase.id, phase.name, phase.position);
    console.log(`Seeding column phase: ${phase.name}`);
  }

  const defaultLabels = [
    { name: 'Bug', color: '#ef4444' },
    { name: 'Feature', color: '#3b82f6' },
    { name: 'Refatoração', color: '#a855f7' },
    { name: 'Urgente', color: '#f97316' },
    { name: 'Documentação', color: '#10b981' }
  ];

  for (const label of defaultLabels) {
    db.prepare('INSERT INTO labels (name, color) VALUES (?, ?)')
      .run(label.name, label.color);
    console.log(`Seeding label: ${label.name}`);
  }

  console.log('Initializing empty tasks board.');
  console.log('Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
});
