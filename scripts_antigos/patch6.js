import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');
let changed = 0;

// 1. Replace the "Tempo Total" header field with a read-only display + admin-only manual edit
const oldTopField = `<div class="meta-label">Tempo Total: <strong id="d-total-time-display" style="color:var(--accent);">0</strong> min</div>
            <div class="meta-val" style="display:flex; gap:4px;">
              <input type="text" id="d-time-delta" class="fc" style="font-size:12px; padding:4px 8px; flex:1;" placeholder="ex: 1h30m, 50min, 2h">
              <button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;" onclick="logMainTaskTime()"><i class="fa-solid fa-plus"></i></button>
            </div>`;

const newTopField = `<div class="meta-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span><i class="fa-regular fa-clock" style="margin-right:4px;"></i> Tempo Total Gasto</span>
            </div>
            <div class="meta-val" id="d-total-time-wrapper" style="display:flex;gap:6px;align-items:center;">
              <span id="d-total-time-display" style="font-size:16px;font-weight:700;color:var(--accent);">0 min</span>
              <!-- Admin only override -->
              <span id="d-admin-time-edit" style="display:none;flex:1;display:none;gap:4px;">
                <input type="text" id="d-time-delta" class="fc" style="font-size:12px;padding:3px 7px;flex:1;" placeholder="Sobrescrever total (ex: 2h)">
                <button type="button" class="btn btn-ghost btn-sm" style="padding:3px 7px;font-size:10px;" onclick="adminOverrideTime()" title="Admin: sobrescrever total">
                  <i class="fa-solid fa-pencil" style="color:var(--warning);"></i>
                </button>
              </span>
            </div>`;

if (html.includes(oldTopField)) {
  html = html.replace(oldTopField, newTopField);
  changed++;
  console.log('✅ Top time field -> read-only with admin override');
} else {
  console.log('⚠️ Top time field not found');
}

// 2. Update the display population on modal open
// Old: const timeDisplay = document.getElementById('d-total-time-display'); if(timeDisplay) timeDisplay.textContent = task.timeSpent || 0;
const oldPopulate = `const timeDisplay = document.getElementById('d-total-time-display'); if(timeDisplay) timeDisplay.textContent = task.timeSpent || 0;
    const timeDelta = document.getElementById('d-time-delta'); if(timeDelta) timeDelta.value = '';`;

const newPopulate = `const timeDisplay = document.getElementById('d-total-time-display');
    if (timeDisplay) timeDisplay.textContent = formatMinutes(task.timeSpent || 0);
    // Show admin override only for admins
    const adminPanel = document.getElementById('d-admin-time-edit');
    if (adminPanel) adminPanel.style.display = currentUser?.role === 'admin' ? 'flex' : 'none';
    const timeDelta = document.getElementById('d-time-delta'); if(timeDelta) timeDelta.value = '';`;

if (html.includes(oldPopulate)) {
  html = html.replace(oldPopulate, newPopulate);
  changed++;
  console.log('✅ Modal open: total time display updated');
} else {
  console.log('⚠️ Modal open populate not found');
}

// 3. Inject adminOverrideTime function and update logMainTaskTime to refresh display after etapa logging
const adminFn = `
  async function adminOverrideTime() {
    const input = document.getElementById('d-time-delta');
    const delta = parseTimeString(input.value);
    if (!delta || delta <= 0) { toast('Formato invalido. Use: 1h30m, 50min, 90', 'error'); return; }
    try {
      const res = await fetch('/api/tasks/' + currentTaskId, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          time_spent: delta,
          actor_name: currentUser?.name || 'Admin',
          actor_discord_id: currentUser?.id || null
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro'); }
      input.value = '';
      await reloadDetailFields(currentTaskId);
      toast('Tempo total ajustado (admin)!', 'success');
    } catch(e) { toast(e.message, 'error'); }
  }

`;

if (!html.includes('async function adminOverrideTime')) {
  html = html.replace('  function parseTimeString(str)', adminFn + '  function parseTimeString(str)');
  changed++;
  console.log('✅ adminOverrideTime injected');
}

// 4. Update logChecklistTime to refresh the total display after logging
const oldLogCl = `    try {
      input.value = '';
      await updateChecklistItem(chkId, { time_spent_delta: delta });
      toast('Tempo registrado na etapa!', 'success');
    } catch(e) { toast(e.message, 'error'); }
  }`;

const newLogCl = `    try {
      input.value = '';
      await updateChecklistItem(chkId, { time_spent_delta: delta });
      // Refresh total on task
      await reloadDetailFields(currentTaskId);
      toast('Tempo registrado na etapa!', 'success');
    } catch(e) { toast(e.message, 'error'); }
  }`;

if (html.includes(oldLogCl)) {
  html = html.replace(oldLogCl, newLogCl);
  changed++;
  console.log('✅ logChecklistTime refreshes task total');
} else {
  console.log('⚠️ logChecklistTime not found');
}

// 5. Remove the logMainTaskTime function (no longer needed — time comes only from etapas)
const oldLogMain = `  async function logMainTaskTime() {
    const input = document.getElementById('d-time-delta');
    const delta = parseTimeString(input.value);
    if (!delta || delta <= 0) { toast('Formato invalido. Use: 1h30m, 50min, 90', 'error'); return; }
    try {
      const payload = { 
        time_spent_delta: delta, 
        actor_name: currentUser?.name || 'Web', 
        actor_discord_id: currentUser?.id || null 
      };
      const res = await fetch('/api/tasks/' + currentTaskId, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao lançar horas');
      input.value = '';
      await reloadDetailFields(currentTaskId);
      toast('Tempo registrado com sucesso!', 'success');
    } catch(e) {
      toast(e.message, 'error');
    }
  }`;
if (html.includes(oldLogMain)) {
  html = html.replace(oldLogMain, '  // logMainTaskTime removed — time flows from etapas to total');
  changed++;
  console.log('✅ logMainTaskTime removed');
}

fs.writeFileSync(filePath, html, 'utf8');
console.log(`\n✅ Done. ${changed} changes applied.`);
