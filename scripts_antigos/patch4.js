import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Inject Checklist UI in Create Task Modal
const injectionTarget = `        </div>
      </div>
    </div>
    <div class="modal-foot">`;

const uiInjection = `        </div>
      </div>
      
      <!-- Create Task Checklist -->
      <div class="fg" style="margin-top: 16px;">
        <label><i class="fa-solid fa-list-check"></i> Etapas / Subtarefas (opcional)</label>
        <div id="ct-checklist-container" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;"></div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px; align-self: flex-start;" onclick="addCreateTaskChecklistItem()">
          <i class="fa-solid fa-plus"></i> Adicionar etapa
        </button>
      </div>

    </div>
    <div class="modal-foot">`;

if (html.includes(injectionTarget) && !html.includes('id="ct-checklist-container"')) {
  html = html.replace(injectionTarget, uiInjection);
  console.log('✅ Added Checklist UI to Create Task Modal');
} else {
  console.log('⚠️ Could not add Checklist UI or already exists');
}

// 2. Inject Javascript for Create Task Checklist
const jsInjection = `
  let createChecklistItems = [];

  function addCreateTaskChecklistItem() {
    createChecklistItems.push({ id: Date.now(), title: '' });
    renderCreateTaskChecklist();
  }

  function updateCreateTaskChecklistItem(id, val) {
    const item = createChecklistItems.find(i => i.id === id);
    if (item) item.title = val;
  }

  function removeCreateTaskChecklistItem(id) {
    createChecklistItems = createChecklistItems.filter(i => i.id !== id);
    renderCreateTaskChecklist();
  }

  function renderCreateTaskChecklist() {
    const container = document.getElementById('ct-checklist-container');
    if (!container) return;
    container.innerHTML = createChecklistItems.map(item => \`
      <div style="display:flex; gap:8px;">
        <input type="text" class="fc" placeholder="Título da etapa..." style="flex:1" 
               value="\${item.title.replace(/"/g, '&quot;')}" onchange="updateCreateTaskChecklistItem(\${item.id}, this.value)">
        <button type="button" class="btn btn-ghost btn-sm" onclick="removeCreateTaskChecklistItem(\${item.id})">
          <i class="fa-solid fa-trash" style="color:var(--danger)"></i>
        </button>
      </div>
    \`).join('');
  }

  // Hook into modal open to reset checklist
  const originalOpenCreateModal = window.openModal;
  // We'll reset inside the button click or override openModal if needed.
  // Actually it's easier to just reset it inside submitCreateTask on success, and when opening manually.
`;

if (!html.includes('addCreateTaskChecklistItem')) {
  html = html.replace('</script>', jsInjection + '\n</script>');
  console.log('✅ Added JS functions for Create Task Checklist');
}

// 3. Patch submitCreateTask
// Find:
// const d = await res.json();
// if (!res.ok) throw new Error(d.error || 'Erro ao criar.');
// toast('Task criada!', 'success');
// closeModal('modal-create');

const submitTarget = `const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao criar.');
      toast('Task criada!', 'success');
      closeModal('modal-create');`;

const submitReplacement = `const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao criar.');
      
      // Process Checklists if any
      const validItems = createChecklistItems.filter(i => i.title.trim());
      for (const item of validItems) {
        try {
          await fetch('/api/tasks/' + d.id + '/checklists', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              title: item.title.trim(),
              actor_name: currentUser?.name || 'Web',
              actor_discord_id: currentUser?.id || null
            })
          });
        } catch (e) {
          console.error('Failed to add checklist item', e);
        }
      }

      toast('Task criada com sucesso!', 'success');
      closeModal('modal-create');
      
      // Reset Create Form
      document.getElementById('ct-title').value = '';
      document.getElementById('ct-desc').value = '';
      createTaskLabels = [];
      renderLabelBadges('create');
      createChecklistItems = [];
      renderCreateTaskChecklist();
      `;

if (html.includes(submitTarget)) {
  html = html.replace(submitTarget, submitReplacement);
  console.log('✅ Patched submitCreateTask to process checklists');
} else {
  console.log('⚠️ Could not find submitCreateTask target to patch');
}

// 4. Hook the "Nova Task" button click to clear state
// <button class="btn btn-primary btn-sm" onclick="openModal('modal-create');">
html = html.replace(
  `onclick="openModal('modal-create');"`,
  `onclick="createChecklistItems=[]; renderCreateTaskChecklist(); openModal('modal-create');"`
);

fs.writeFileSync(filePath, html, 'utf8');
console.log('✅ index.html patched for create task checklists.');
