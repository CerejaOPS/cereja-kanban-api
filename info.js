import fs from 'fs';

const html = fs.readFileSync('public/index.html', 'utf8');

// Helper to find index of a string and show its surrounding context
function findContext(str, label) {
  const index = html.indexOf(str);
  if (index === -1) {
    console.log(`❌ Label [${label}] NOT found.`);
    return;
  }
  console.log(`\n=== Context for [${label}] (index: ${index}) ===`);
  const start = Math.max(0, index - 200);
  const end = Math.min(html.length, index + str.length + 300);
  console.log(html.slice(start, end));
}

findContext('DETAILS MODAL', 'DETAILS MODAL');
findContext('Subtarefas', 'Subtarefas');
findContext('task-timeline-right', 'task-timeline-right');
findContext('function openDetailsModal', 'openDetailsModal');
findContext('let currentTaskChecklists = [];', 'currentTaskChecklists');
