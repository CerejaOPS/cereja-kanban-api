import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Replace the "Tempo (min)" field for tasks
const oldTimeField = `<div class="meta-label">Tempo (min)</div>
            <div class="meta-val">
              <input type="number" id="d-time" class="fc" min="0" step="1" style="font-size:12px; padding:4px 8px;" placeholder="ex: 90">
            </div>`;
const newTimeField = `<div class="meta-label">Tempo Total: <strong id="d-total-time-display" style="color:var(--accent);">0</strong> min</div>
            <div class="meta-val" style="display:flex; gap:4px;">
              <input type="number" id="d-time-delta" class="fc" min="1" step="1" style="font-size:12px; padding:4px 8px; flex:1;" placeholder="+ min">
              <button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;" onclick="logMainTaskTime()"><i class="fa-solid fa-plus"></i></button>
            </div>`;

if (html.includes(oldTimeField)) {
  html = html.replace(oldTimeField, newTimeField);
  console.log('✅ Main task time field updated.');
} else {
  console.log('⚠️ Main task time field not found.');
}

// 2. Fix saveDetailsOnClose removing newTime
html = html.replace(
  "const newTime = parseInt(document.getElementById('d-time').value, 10) || 0;",
  "const newTime = currentTaskSnapshot.time_spent; // time is now logged separately"
);

// 3. Fix modal open to populate d-total-time-display
html = html.replace(
  "document.getElementById('d-time').value = task.timeSpent || 0;",
  "const timeDisplay = document.getElementById('d-total-time-display'); if(timeDisplay) timeDisplay.textContent = task.timeSpent || 0;\n    const timeDelta = document.getElementById('d-time-delta'); if(timeDelta) timeDelta.value = '';"
);

// 4. Update Checklist time field
// It looks like:
// '<label class="checklist-sub-label">Tempo gasto (min)</label>' +
// '<input type="number" class="fc" style="font-size:12px;padding:5px 8px;" min="0" value="' + (chk.time_spent||0) + '"' +
// ' onchange="updateChecklistItem(' + chk.id + ',{time_spent:parseInt(this.value,10)||0})">'

const oldChecklistTime = `'<label class="checklist-sub-label">Tempo gasto (min)</label>' +
              '<input type="number" class="fc" style="font-size:12px;padding:5px 8px;" min="0" value="' + (chk.time_spent||0) + '"' +
              ' onchange="updateChecklistItem(' + chk.id + ',{time_spent:parseInt(this.value,10)||0})">'`;

const newChecklistTime = `'<label class="checklist-sub-label" style="display:flex;justify-content:space-between;"><span>Tempo total</span><strong style="color:var(--accent)">' + (chk.time_spent||0) + ' min</strong></label>' +
              '<div style="display:flex;gap:4px;">' +
                '<input type="number" class="fc" style="font-size:12px;padding:5px 8px;flex:1;" min="1" placeholder="+ min" id="cl-time-' + chk.id + '">' +
                '<button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;" onclick="logChecklistTime(' + chk.id + ')"><i class="fa-solid fa-plus"></i></button>' +
              '</div>'`;

if (html.includes(oldChecklistTime)) {
  html = html.replace(oldChecklistTime, newChecklistTime);
  console.log('✅ Checklist time field updated.');
} else {
  console.log('⚠️ Checklist time field not found.');
}

// 5. Inject logMainTaskTime and logChecklistTime functions before </script>
if (!html.includes('async function logMainTaskTime()')) {
  const injection = `
  async function logMainTaskTime() {
    const input = document.getElementById('d-time-delta');
    const delta = parseFloat(input.value);
    if (!delta || delta <= 0) return;
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
  }

  async function logChecklistTime(chkId) {
    const input = document.getElementById('cl-time-' + chkId);
    const delta = parseFloat(input.value);
    if (!delta || delta <= 0) return;
    try {
      input.value = '';
      await updateChecklistItem(chkId, { time_spent_delta: delta });
      toast('Tempo registrado na etapa!', 'success');
    } catch(e) {
      toast(e.message, 'error');
    }
  }
</script>`;
  html = html.replace('</script>', injection);
  console.log('✅ Time logging functions injected.');
}

fs.writeFileSync(filePath, html, 'utf8');
console.log('✅ index.html patched successfully.');
