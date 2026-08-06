import { getDb } from './lib/db.js';

async function main() {
  console.log('Starting database seed with pg-promise...');
  
  const db = await getDb();

  // Limpar banco de dados existente (cuidado em producao)
  await db.none('DELETE FROM activity_logs');
  await db.none('DELETE FROM checklist_activities');
  await db.none('DELETE FROM checklist_comments');
  await db.none('DELETE FROM task_checklists');
  await db.none('DELETE FROM task_labels');
  await db.none('DELETE FROM comments');
  await db.none('DELETE FROM task_time_entries');
  await db.none('DELETE FROM task_observations');
  await db.none('DELETE FROM task_field_values');
  await db.none('DELETE FROM tasks');
  
  await db.none('DELETE FROM phase_rules');
  await db.none('DELETE FROM board_fields');
  await db.none('DELETE FROM boards');
  
  await db.none('DELETE FROM discord_users');
  await db.none('DELETE FROM users');
  await db.none('DELETE FROM phases');
  await db.none('DELETE FROM labels');

  console.log('Fallback admin user creation skipped.');
  console.log('Users will be created dynamically upon login or via sync.');

  // Default Phases
  const defaultPhases = [
    { id: 'backlog', name: 'Backlog', position: 0 },
    { id: 'todo', name: 'TO-DO', position: 1 },
    { id: 'andamento', name: 'Em Andamento', position: 2 },
    { id: 'revisao', name: 'Em Revisão', position: 3 },
    { id: 'bloqueado', name: 'Bloqueado', position: 4 },
    { id: 'concluido', name: 'Concluído', position: 5 }
  ];

  for (const phase of defaultPhases) {
    await db.none('INSERT INTO phases (id, name, position) VALUES ($1, $2, $3)', [phase.id, phase.name, phase.position]);
  }
  console.log('Seeded default phases.');

  // Default Labels
  const defaultLabels = [
    { name: 'Bug', color: '#ef4444' },
    { name: 'Feature', color: '#3b82f6' },
    { name: 'Refatoração', color: '#a855f7' },
    { name: 'Urgente', color: '#f97316' },
    { name: 'Documentação', color: '#10b981' }
  ];

  for (const label of defaultLabels) {
    await db.none('INSERT INTO labels (name, color) VALUES ($1, $2)', [label.name, label.color]);
  }
  console.log('Seeded default labels.');

  // Initial Board
  await db.none(`
    INSERT INTO boards (id, name, slug, color, icon) 
    VALUES ($1, $2, $3, $4, $5)
  `, [1, 'Painel Principal', 'main', '#6C63FF', '📋']);
  
  console.log('Initializing empty tasks board.');
  
  console.log('Seeding completed successfully!');
  
  process.exit(0);
}

main().catch((e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});
