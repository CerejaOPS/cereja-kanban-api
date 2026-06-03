import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');
let changed = 0;

// 1. Fix formatMinutes (first instance)
const oldFmt1 = `  function formatMinutes(minutes) {
    if (!minutes || isNaN(minutes)) return '0m';
    const m = parseInt(minutes, 10);
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    if (hrs > 0 && mins > 0) return \`\${hrs}h \${mins}m\`;
    if (hrs > 0) return \`\${hrs}h\`;
    return \`\${mins}m\`;
  }`;
const newFmt1 = `  function formatMinutes(minutes) {
    if (!minutes || isNaN(minutes)) return '0m';
    const m = Math.round(parseFloat(minutes));
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    if (hrs > 0 && mins > 0) return \`\${hrs}h \${mins}m\`;
    if (hrs > 0) return \`\${hrs}h\`;
    return \`\${mins}m\`;
  }`;

if (html.includes(oldFmt1)) { html = html.replace(oldFmt1, newFmt1); changed++; console.log('✅ Fixed formatMinutes (1)'); }

// 2. Fix formatMinutes (second instance)
const oldFmt2 = `  function formatMinutes(mins) {
    if (!mins || mins <= 0) return '0min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? h + 'h' + (m > 0 ? m + 'm' : '') : m + 'min';
  }`;
const newFmt2 = `  function formatMinutes(mins) {
    if (!mins || isNaN(mins) || mins <= 0) return '0min';
    const mRound = Math.round(parseFloat(mins));
    const h = Math.floor(mRound / 60);
    const m = mRound % 60;
    return h > 0 ? h + 'h' + (m > 0 ? m + 'm' : '') : m + 'min';
  }`;

if (html.includes(oldFmt2)) { html = html.replace(oldFmt2, newFmt2); changed++; console.log('✅ Fixed formatMinutes (2)'); }

// 3. Fix the buildCard checklist counter logic
const oldCounter = `const done = task.checklists.filter(c => c.is_completed).length;`;
const newCounter = `const done = task.checklists.filter(c => c.status === 'done' || c.is_completed === 1 || c.is_completed === true).length;`;

if (html.includes(oldCounter)) { html = html.replace(oldCounter, newCounter); changed++; console.log('✅ Fixed checklist counter in buildCard'); }

fs.writeFileSync(filePath, html, 'utf8');
console.log(`\n✅ Done. ${changed} changes applied.`);
