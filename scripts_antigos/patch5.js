import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');
let changed = 0;

// 1. Main task time field: type="number" -> type="text"
const oldMain = `<input type="number" id="d-time-delta" class="fc" min="1" step="1" style="font-size:12px; padding:4px 8px; flex:1;" placeholder="+ min">`;
const newMain = `<input type="text" id="d-time-delta" class="fc" style="font-size:12px; padding:4px 8px; flex:1;" placeholder="ex: 1h30m, 50min, 2h">`;
if (html.includes(oldMain)) { html = html.replace(oldMain, newMain); changed++; console.log('✅ Main task time field -> text'); }
else console.log('⚠️ Main task field not found');

// 2. Checklist time field: type="number" -> type="text"
const oldCl = `'<input type="number" class="fc" style="font-size:12px;padding:5px 8px;flex:1;" min="1" placeholder="+ min" id="cl-time-' + chk.id + '">'`;
const newCl = `'<input type="text" class="fc" style="font-size:12px;padding:5px 8px;flex:1;" placeholder="ex: 30min, 1h" id="cl-time-' + chk.id + '">'`;
if (html.includes(oldCl)) { html = html.replace(oldCl, newCl); changed++; console.log('✅ Checklist time field -> text'); }
else console.log('⚠️ Checklist field not found. Trying alternate...');

// Alternate search
const oldCl2 = `'<input type="number" class="fc" style="font-size:12px;padding:5px 8px;flex:1;" min="1" placeholder="+ min" id="cl-time-" + chk.id + "">'`;
if (!html.includes(oldCl) && html.includes(oldCl2)) { html = html.replace(oldCl2, newCl.replace("'", '"')); changed++; console.log('✅ Checklist (alt) -> text'); }

// 3. Inject parseTimeString helper before logMainTaskTime
const parseTimeFn = `
  function parseTimeString(str) {
    if (!str) return 0;
    str = str.trim().toLowerCase();
    let total = 0;
    const hoursMatch = str.match(/(\\d+(?:\\.\\d+)?)\\s*h/);
    const minsMatch  = str.match(/(\\d+(?:\\.\\d+)?)\\s*m/);
    const colonMatch = str.match(/^(\\d+):(\\d+)$/);
    const pureNum    = str.match(/^(\\d+(?:\\.\\d+)?)$/);
    if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
    if (minsMatch)  total += parseFloat(minsMatch[1]);
    if (colonMatch) total += parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
    if (pureNum && !hoursMatch && !minsMatch) total += parseFloat(pureNum[1]);
    return Math.round(total);
  }

  async function logMainTaskTime()`;

const oldLogMain = `  async function logMainTaskTime()`;
if (html.includes(oldLogMain) && !html.includes('function parseTimeString')) {
  html = html.replace(oldLogMain, parseTimeFn);
  changed++;
  console.log('✅ parseTimeString injected');
}

// 4. Replace parseFloat in logMainTaskTime
const oldParseMain = `    const delta = parseFloat(input.value);
    if (!delta || delta <= 0) return;
    try {
      const payload = {`;
const newParseMain = `    const delta = parseTimeString(input.value);
    if (!delta || delta <= 0) { toast('Formato invalido. Use: 1h30m, 50min, 90', 'error'); return; }
    try {
      const payload = {`;
if (html.includes(oldParseMain)) { html = html.replace(oldParseMain, newParseMain); changed++; console.log('✅ logMainTaskTime uses parseTimeString'); }
else console.log('⚠️ logMainTaskTime parseFloat not found');

// 5. Replace parseFloat in logChecklistTime
const oldParseCl = `    const delta = parseFloat(input.value);
    if (!delta || delta <= 0) return;
    try {
      input.value = '';
      await updateChecklistItem`;
const newParseCl = `    const delta = parseTimeString(input.value);
    if (!delta || delta <= 0) { toast('Formato invalido. Use: 1h30m, 50min, 90', 'error'); return; }
    try {
      input.value = '';
      await updateChecklistItem`;
if (html.includes(oldParseCl)) { html = html.replace(oldParseCl, newParseCl); changed++; console.log('✅ logChecklistTime uses parseTimeString'); }
else console.log('⚠️ logChecklistTime parseFloat not found');

fs.writeFileSync(filePath, html, 'utf8');
console.log(`\n✅ Done. ${changed} changes applied.`);
