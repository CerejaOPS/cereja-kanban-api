  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
    };
  }
  
  function getAuthHeadersDelete() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
    };
  }

  // ============================================================
  // STATE
  // ============================================================
  let currentUser = null;
  let allPhases = [];
  let allMembers = [];
  let allLabels = [];
  let currentTaskId = null;
  let currentTaskSnapshot = null; // snapshot when modal opens
  let editingColumnId = null;
  let sseSource = null;
  let drawerOpen = false;
  
  const presetColors = [
    '#ef4444', '#f97316', '#eab308', '#10b981', 
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'
  ];
  let currentTaskLabels = [];
  let selectedCreateLabels = [];
  let activeCreateColor = '#ef4444';
  let activeDetailsColor = '#ef4444';
  
  // Pending drop info for dynamic forms
  let pendingDrop = null; 

  // Phase requirements config
  const phaseRequirements = {
    'revisao': [
      { id: 'review_notes', label: 'Notas para o Revisor', type: 'textarea', placeholder: 'Ex: Testar funcionalidade de login no mobile...' }
    ]
  };

  // ============================================================
  // UTILS
  // ============================================================
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g,
      c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    // Fix SQLite UTC dates
    const utcDateStr = dt.endsWith('Z') ? dt : dt.replace(' ', 'T') + 'Z';
    return new Date(utcDateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatMinutes(minutes) {
    if (!minutes || isNaN(minutes)) return '0m';
    const m = Math.round(parseFloat(minutes));
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  }

  function fmtRelativeTime(dt) {
    if (!dt) return '—';
    const utcDateStr = dt.endsWith('Z') ? dt : dt.replace(' ', 'T') + 'Z';
    const date = new Date(utcDateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return `ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays < 7) return `há ${diffDays} dias`;
    
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function phaseColor(id) {
    const map = { backlog:'#64748b', todo:'#3b82f6', andamento:'#eab308', revisao:'#a855f7', concluido:'#10b981', bloqueado:'#ef4444' };
    return map[id] || '#6366f1';
  }

  function colorText(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000 >= 128 ? '#000' : '#fff';
  }

  // ============================================================
  // TOAST
  // ============================================================
  function toast(msg, type = 'success') {
    const area = document.getElementById('toast-area');
    const el = document.createElement('div');
    const icons = { success:'fa-circle-check', error:'fa-circle-xmark', warn:'fa-triangle-exclamation' };
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type]||'fa-circle-check'}"></i><span>${esc(msg)}</span>`;
    area.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3500);
  }

  // ============================================================
  // AUTH
  // ============================================================
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-err');
    errEl.style.opacity = 0;
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciais inválidas.');
      localStorage.setItem('jwt_token', data.token);
      await bootDashboard(data.token);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.opacity = 1;
    }
  });

  async function checkAuth() {
    // Check if Discord returned a token via URL hash or query
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      localStorage.removeItem('jwt_token');
      window.history.replaceState({}, '', '/');
      showLoginPage();
      const errEl = document.getElementById('login-err');
      errEl.textContent = authError;
      errEl.style.opacity = 1;
      return;
    }

    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('jwt_token', urlToken);
      window.history.replaceState({}, '', '/');
    }

    const token = localStorage.getItem('jwt_token');
    if (!token) { showLoginPage(); return; }
    await bootDashboard(token);
  }

  async function bootDashboard(token) {
    try {
      const res = await fetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('expired');
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('user-name').textContent = currentUser.name || currentUser.username || 'Usuário';
      const avatar = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'U')}&background=6366f1&color=fff`;
      document.getElementById('user-avatar').src = avatar;

      document.getElementById('login-page').style.display = 'none';
      document.getElementById('dashboard-page').style.display = 'flex';

      // RBAC UI: Hide Create Task if user
      if (currentUser.role === 'user') {
        document.getElementById('new-task-btn').style.display = 'none';
      } else {
        document.getElementById('new-task-btn').style.display = 'inline-flex';
      }

      // Load data in parallel
      try {
        await Promise.all([loadPhases(), loadMembers(), loadLabels()]);
        await renderBoard();
        connectSSE();
      } catch (err) {
        console.error('Erro ao carregar dados do Kanban:', err);
        toast('Login feito, mas houve erro ao carregar o Kanban.', 'error');
      }
    } catch (err) {
      console.warn('Sessao invalida ou expirada:', err);
      localStorage.removeItem('jwt_token');
      showLoginPage();
    }
  }

  function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('dashboard-page').style.display = 'none';
    closeSSE();
  }

  function logout() {
    localStorage.removeItem('jwt_token');
    currentUser = null;
    showLoginPage();
    toast('Sessão encerrada.', 'success');
  }

  // ============================================================
  // SSE
  // ============================================================
  function connectSSE() {
    if (sseSource) return;
    sseSource = new EventSource('/api/events');
    sseSource.addEventListener('message', async e => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'board_update') {
          if (ev.action === 'phases_updated') {
            await loadPhases();
          }
          if (ev.taskId && String(ev.taskId) !== String(currentTaskId)) {
            window.unreadTasks = window.unreadTasks || new Set();
            window.unreadTasks.add(String(ev.taskId));
          }
          await renderBoard();
          if (currentTaskId && String(ev.taskId) === String(currentTaskId) && ev.action !== 'edited') {
            // Silently reload detail fields only if externally modified
            await reloadDetailFields(currentTaskId);
          }
        }
      } catch {}
    });
    sseSource.onerror = () => {};
  }

  function closeSSE() {
    if (sseSource) { sseSource.close(); sseSource = null; }
  }

  // ============================================================
  // DATA FETCH
  // ============================================================
  async function loadPhases() {
    const res = await fetch('/api/phases');
    allPhases = res.ok ? await res.json() : [];
  }

  async function loadMembers() {
    const res = await fetch('/api/members');
    allMembers = res.ok ? await res.json() : [];
    renderMembersDrawer();
  }

  async function loadLabels() {
    const res = await fetch('/api/labels');
    allLabels = res.ok ? await res.json() : [];
  }

  // ============================================================
  // MEMBERS DRAWER
  // ============================================================
  function toggleMembers() {
    drawerOpen = !drawerOpen;
    document.getElementById('members-drawer').classList.toggle('open', drawerOpen);
  }

  function renderMembersDrawer() {
    const container = document.getElementById('members-list');
    if (!allMembers.length) {
      container.innerHTML = '<div class="no-items">Nenhum membro mapeado.<br>Os membros são adicionados automaticamente ao fazer login com Discord.</div>';
      return;
    }
    container.innerHTML = '';
    allMembers.forEach(m => {
      const avatarUrl = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name||m.username||'?')}&background=6366f1&color=fff`;
      const el = document.createElement('div');
      el.className = 'member-card';
      el.innerHTML = `
        <img src="${esc(avatarUrl)}" class="member-avatar" alt="${esc(m.display_name)}"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name||'?')}&background=6366f1&color=fff'">
        <div class="member-info">
          <div class="member-name">${esc(m.display_name || m.username)}</div>
          <div class="member-sub">${esc(m.username || m.id)}</div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  // ============================================================
  // BOARD RENDER
  // ============================================================
  let allTasks = []; // master task list for filtering

  async function renderBoard() {
    let tasks = [];
    try {
      const res = await fetch('/api/tasks');
      tasks = res.ok ? await res.json() : [];
    } catch { return; }

    allTasks = tasks;
    populateFilterSelects();
    renderBoardWithTasks(applyFilterLogic(tasks));
  }

  function applyFilterLogic(tasks) {
    const search = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
    const userId = document.getElementById('filter-user')?.value || '';
    const labelId = document.getElementById('filter-label')?.value || '';

    return tasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search)) return false;
      if (userId && t.assignee_discord_id !== userId) return false;
      if (labelId && !(t.labels || []).some(l => String(l.id) === labelId)) return false;
      return true;
    });
  }

  function applyFilters() {
    const search = (document.getElementById('filter-search')?.value || '').trim();
    const userId = document.getElementById('filter-user')?.value || '';
    const labelId = document.getElementById('filter-label')?.value || '';
    const hasFilters = search || userId || labelId;
    const clearBtn = document.getElementById('filter-clear-btn');
    if (clearBtn) clearBtn.style.display = hasFilters ? 'block' : 'none';
    renderBoardWithTasks(applyFilterLogic(allTasks));
  }

  function clearFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-user').value = '';
    document.getElementById('filter-label').value = '';
    document.getElementById('filter-clear-btn').style.display = 'none';
    renderBoardWithTasks(allTasks);
  }

  function populateFilterSelects() {
    // Users from current task list
    const userSel = document.getElementById('filter-user');
    const currentUserVal = userSel?.value || '';
    const seen = new Set();
    const userOpts = ['<option value="">Todos usuários</option>'];
    allTasks.forEach(t => {
      if (t.assignee_discord_id && !seen.has(t.assignee_discord_id)) {
        seen.add(t.assignee_discord_id);
        userOpts.push(`<option value="${esc(t.assignee_discord_id)}">${esc(t.assignee_name || t.assignee_discord_id)}</option>`);
      }
    });
    if (userSel) { userSel.innerHTML = userOpts.join(''); userSel.value = currentUserVal; }

    // Labels from allLabels state
    const labelSel = document.getElementById('filter-label');
    const currentLabelVal = labelSel?.value || '';
    const labelOpts = ['<option value="">Todas etiquetas</option>'];
    (allLabels || []).forEach(l => {
      labelOpts.push(`<option value="${esc(String(l.id))}">${esc(l.name)}</option>`);
    });
    if (labelSel) { labelSel.innerHTML = labelOpts.join(''); labelSel.value = currentLabelVal; }
  }

  function renderBoardWithTasks(tasks) {
    const area = document.getElementById('board-area');
    const addBtn = area.querySelector('.add-col-btn');
    area.innerHTML = '';

    // Group tasks by phase
    const byPhase = {};
    allPhases.forEach(p => byPhase[p.id] = []);
    tasks.forEach(t => {
      const pid = t.phase || 'todo';
      if (!byPhase[pid]) byPhase[pid] = [];
      byPhase[pid].push(t);
    });

    allPhases.forEach(phase => {
      const col = buildColumn(phase, byPhase[phase.id] || []);
      area.appendChild(col);
    });

    // Re-add the add column button
    if (addBtn) area.appendChild(addBtn);
    else {
      const btn = document.createElement('button');
      btn.className = 'add-col-btn';
      btn.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar Fase';
      btn.onclick = openAddColumnModal;
      area.appendChild(btn);
    }

    setupDragDrop();
  }

  function buildColumn(phase, tasks) {
    const color = phaseColor(phase.id);
    const col = document.createElement('div');
    col.className = 'board-col';
    col.dataset.phase = phase.id;

    const isBuiltin = ['backlog','todo','andamento','revisao','concluido','bloqueado'].includes(phase.id);

    col.innerHTML = `
      <div class="col-header">
        <div class="col-title-group">
          <div class="col-dot" style="background:${color}"></div>
          <div class="col-name">${esc(phase.name)}</div>
          <div class="col-count">${tasks.length}</div>
        </div>
        <div class="col-actions">
          <button class="col-action-btn" onclick="openRenameColumn('${esc(phase.id)}', '${esc(phase.name)}')" title="Renomear">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${!isBuiltin ? `
          <button class="col-action-btn delete" onclick="deleteColumn('${esc(phase.id)}')" title="Excluir (somente se vazia)">
            <i class="fa-solid fa-trash"></i>
          </button>` : ''}
        </div>
      </div>
      <div class="cards-list" id="cards-${phase.id}"></div>
    `;

    const list = col.querySelector('.cards-list');
    tasks.forEach(task => list.appendChild(buildCard(task, phase)));

    return col;
  }

  function buildCard(task, phase) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = task.id;
    card.dataset.phase = phase.id;
    
    // RBAC: Can this user drag this card?
    let canDrag = true;
    if (currentUser?.role === 'user') {
      const isAssignee = task.assignee_discord_id === currentUser.id;
      const isReviewPhase = task.phase === 'revisao';
      if (!isAssignee && !isReviewPhase) canDrag = false;
    }
    card.draggable = canDrag;

    const phasesArr = allPhases.map(p => p.id);
    const idx = phasesArr.indexOf(phase.id);

    const assigneeName = task.assignee_name || 'Livre';
    const lastEditor = task.lastEditedByName || '—';
    const updatedStr = fmtRelativeTime(task.updated_at);
    
    // Check for unread indicator
    const isUnread = window.unreadTasks && window.unreadTasks.has(String(task.id));

    let labelsHtml = '';
    if (task.labels && task.labels.length) {
      labelsHtml = `<div class="card-labels">${task.labels.map(l =>
        `<span class="label-chip" style="background:${esc(l.color)};color:${colorText(l.color)}">${esc(l.name)}</span>`
      ).join('')}</div>`;
    }

    let dueHtml = '';
    if (task.due_date) {
      const due = new Date(task.due_date + 'T00:00:00');
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffMs = due - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      let dueStyle = '';
      let dueText = due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      
      if (diffDays < 0) {
        dueStyle = 'background:#ef4444;color:#fff;';
        dueText += ' (Atrasado)';
      } else if (diffDays <= 2) {
        dueStyle = 'background:#f59e0b;color:#fff;';
        dueText += ' (Próximo)';
      } else {
        dueStyle = 'background:rgba(255,255,255,0.1);color:#cbd5e1;border:1px solid rgba(255,255,255,0.2);';
      }
      
      dueHtml = `<div style="margin-top:6px;"><span class="label-chip" style="${dueStyle} font-size:10px;"><i class="fa-regular fa-calendar"></i> ${dueText}</span></div>`;
    }

    let checklistHtml = '';
    if (task.checklists && task.checklists.length > 0) {
      const total = task.checklists.length;
      const done = task.checklists.filter(c => c.status === 'done' || c.is_completed === 1 || c.is_completed === true).length;
      const pct = Math.round((done / total) * 100);
      checklistHtml = `
        <div style="margin-top:8px; font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-list-check"></i> ${done}/${total}
          <div style="flex:1; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:${pct === 100 ? '#10b981' : 'var(--accent)'};"></div>
          </div>
        </div>
      `;
    }

    const color = phaseColor(phase.id);
    const avatarUrl = task.assignee_discord_id
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(assigneeName)}&background=6366f1&color=fff`
      : null;

    card.innerHTML = `
      <div class="card-top">
        <span class="card-id">
          #${task.id}
          ${isUnread ? '<span style="display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%; margin-left:4px; box-shadow: 0 0 8px #ef4444;"></span>' : ''}
        </span>
      </div>
      <div class="card-title">${esc(task.title)}</div>
      ${labelsHtml}
      ${dueHtml}
      ${checklistHtml}
      <div class="card-divider"></div>
      <div class="card-meta">
        <i class="fa-solid fa-user" style="color:${color}"></i>
        <span>Dono: <strong>${esc(assigneeName)}</strong></span>
      </div>
      <div class="card-meta">
        <i class="fa-regular fa-pen-to-square"></i>
        <span>Editor: <strong>${esc(lastEditor)}</strong></span>
      </div>
      <div class="card-meta">
        <i class="fa-regular fa-clock"></i>
        <span>Tempo: <strong>${formatMinutes(task.timeSpent || 0)}</strong></span>
      </div>
      <div class="card-footer">
        <span class="card-date">Atualizado: ${updatedStr}</span>
        <div class="quick-btns">
          <button class="quick-btn ${idx === 0 ? 'disabled' : ''}" onclick="event.stopPropagation(); moveStep('${task.id}', -1)" title="Mover para esquerda">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button class="quick-btn ${idx >= phasesArr.length - 1 ? 'disabled' : ''}" onclick="event.stopPropagation(); moveStep('${task.id}', 1)" title="Mover para direita">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      if (window.unreadTasks) window.unreadTasks.delete(String(task.id));
      openDetailsModal(task.id);
    });

    return card;
  }

  // ============================================================
  // DRAG & DROP
  // ============================================================
  function setupDragDrop() {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('dragstart', e => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    document.querySelectorAll('.board-col').forEach(col => {
      col.addEventListener('dragover', e => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', e => {
        if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
      });
      col.addEventListener('drop', async e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const cardId = e.dataTransfer.getData('text/plain');
        const newPhase = col.dataset.phase;
        
        if (!cardId || !newPhase) return;
        
        // Check if phase requires a form
        if (phaseRequirements[newPhase]) {
          openDynamicForm(cardId, newPhase);
        } else {
          await moveCardPhase(cardId, newPhase);
        }
      });
    });
  }

  function openDynamicForm(cardId, newPhase) {
    pendingDrop = { cardId, newPhase };
    const reqs = phaseRequirements[newPhase];
    const body = document.getElementById('dyn-modal-body');
    body.innerHTML = '';
    
    reqs.forEach(req => {
      const fg = document.createElement('div');
      fg.className = 'fg';
      fg.innerHTML = `<label for="dyn-${req.id}">${esc(req.label)}</label>`;
      
      if (req.type === 'textarea') {
        fg.innerHTML += `<textarea id="dyn-${req.id}" class="fc dyn-input" placeholder="${esc(req.placeholder || '')}" required></textarea>`;
      } else {
        fg.innerHTML += `<input type="text" id="dyn-${req.id}" class="fc dyn-input" placeholder="${esc(req.placeholder || '')}" required>`;
      }
      body.appendChild(fg);
    });
    
    openModal('modal-dynamic');
  }

  async function submitDynamicForm() {
    if (!pendingDrop) return;
    
    const inputs = document.querySelectorAll('.dyn-input');
    const dynamicFields = {};
    for (const input of inputs) {
      if (!input.value.trim()) { toast('Preencha os campos obrigatórios.', 'error'); return; }
      const keyId = input.id.replace('dyn-', '');
      const reqConfig = phaseRequirements[pendingDrop.newPhase].find(r => r.id === keyId);
      dynamicFields[reqConfig ? reqConfig.label : keyId] = input.value.trim();
    }
    
    const { cardId, newPhase } = pendingDrop;
    pendingDrop = null;
    closeModal('modal-dynamic');
    await moveCardPhase(cardId, newPhase, dynamicFields);
  }

  async function moveStep(cardId, step) {
    const phasesArr = allPhases.map(p => p.id);
    const res = await fetch(`/api/tasks/${cardId}`);
    if (!res.ok) return;
    const task = await res.json();
    const idx = phasesArr.indexOf(task.phase);
    const next = idx + step;
    if (next >= 0 && next < phasesArr.length) {
      await moveCardPhase(cardId, phasesArr[next]);
    }
  }

  async function moveCardPhase(cardId, newPhase, dynamicFields = null) {
    try {
      const payload = {
        phase: newPhase,
        actor_name: currentUser?.name || 'Web',
        actor_discord_id: currentUser?.id || null
      };
      if (dynamicFields) payload.dynamic_fields = dynamicFields;

      const res = await fetch(`/api/tasks/${cardId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao mover');
      }
      toast('Task movida!', 'success');
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ============================================================
  // CREATE TASK MODAL
  // ============================================================
  function openCreateModal() {
    const sel = document.getElementById('ct-phase');
    sel.innerHTML = allPhases.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    document.getElementById('ct-title').value = '';
    document.getElementById('ct-desc').value = '';
    document.getElementById('ct-due-date').value = '';
    
    // Clear selections and hide dropdowns
    selectedCreateLabels = [];
    document.getElementById('create-label-dropdown').style.display = 'none';
    renderSelectedLabels('create');
    
    openModal('modal-create');
    setTimeout(() => document.getElementById('ct-title').focus(), 100);
  }

  async function submitCreateTask() {
    const title = document.getElementById('ct-title').value.trim();
    const desc = document.getElementById('ct-desc').value;
    const phase = document.getElementById('ct-phase').value;
    const dueDate = document.getElementById('ct-due-date').value || null;
    const labels = selectedCreateLabels.map(l => l.id);

    if (!title) { toast('Título obrigatório.', 'error'); return; }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title, description: desc, phase, time_spent: 0,
          due_date: dueDate,
          labels,
          actor_name: currentUser?.name || 'Web',
          actor_discord_id: currentUser?.id || null
        })
      });
      const d = await res.json();
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
              description: item.description ? item.description.trim() : '',
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
      
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ============================================================
  // ============================================================
  // DETAILS MODAL
  // ============================================================
  async function openDetailsModal(taskId) {
    currentTaskId = taskId;

    // Load fresh data
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) { toast('Task não encontrada.', 'error'); return; }
    const task = await res.json();

    // Store snapshot of original values for change detection
    currentTaskSnapshot = {
      title: task.title,
      description: task.description || '',
      assignee_discord_id: task.assignee_discord_id || '',
      time_spent: task.timeSpent || 0,
      due_date: task.due_date || '',
      phase: task.phase,
      labels: (task.labels || []).map(l => l.id)
    };

    // Populate fields
    document.getElementById('edit-title-input').value = task.title;
    document.getElementById('d-id').textContent = `#${task.id}`;
    document.getElementById('d-desc').value = task.description || '';
    const timeDisplay = document.getElementById('d-total-time-display');
    if (timeDisplay) timeDisplay.textContent = formatMinutes(task.timeSpent || 0);
    // Show admin override only for admins
    const adminPanel = document.getElementById('d-admin-time-edit');
    if (adminPanel) adminPanel.style.display = currentUser?.role === 'admin' ? 'flex' : 'none';
    const timeDelta = document.getElementById('d-time-delta'); if(timeDelta) timeDelta.value = '';
    document.getElementById('d-due-date').value = task.due_date ? task.due_date.split('T')[0] : '';
    document.getElementById('d-created').textContent = fmtDate(task.created_at);
    document.getElementById('d-editor').textContent = task.lastEditedByName || '—';

    // Phase badge + select
    const phaseObj = allPhases.find(p => p.id === task.phase) || { name: task.phase, id: task.phase };
    const badge = document.getElementById('d-phase-badge');
    badge.textContent = phaseObj.name;
    badge.className = `phase-badge`;
    badge.style.background = phaseColor(phaseObj.id) + '22';
    badge.style.color = phaseColor(phaseObj.id);
    badge.style.border = `1px solid ${phaseColor(phaseObj.id)}44`;

    const phaseSelect = document.getElementById('d-phase-select');
    phaseSelect.innerHTML = allPhases.map(p =>
      `<option value="${esc(p.id)}" ${p.id === task.phase ? 'selected' : ''}>${esc(p.name)}</option>`
    ).join('');

    // Assignee select
    const assigneeSelect = document.getElementById('d-assignee-select');
    assigneeSelect.innerHTML = `<option value="">Sem atribuição</option>` +
      allMembers.map(m =>
        `<option value="${esc(m.id)}" ${m.id === task.assignee_discord_id ? 'selected' : ''}>${esc(m.display_name || m.username)}</option>`
      ).join('');

    // Labels
    currentTaskLabels = task.labels || [];
    renderSelectedLabels('details');
    document.getElementById('details-label-dropdown').style.display = 'none';

    // Checklists
    currentTaskChecklists = task.checklists || [];
    expandedChecklists = new Set();
    renderChecklists();

    // Reset right tab to Timeline
    {
      const tbtn = document.getElementById('btn-tab-timeline');
      const pbtn = document.getElementById('btn-tab-phase-logs');
      const tcnt = document.getElementById('tab-content-timeline');
      const pcnt = document.getElementById('tab-content-phase-logs');
      if (tbtn) { tbtn.classList.add('active');    tbtn.style.color = '#fff'; }
      if (pbtn) { pbtn.classList.remove('active'); pbtn.style.color = 'var(--text-muted)'; }
      if (tcnt) tcnt.style.display = 'flex';
      if (pcnt) pcnt.style.display = 'none';
    }

    // Reset right tab to Timeline
    const timelineBtn = document.getElementById('btn-tab-timeline');
    const phaseBtn = document.getElementById('btn-tab-phase-logs');
    const timelineContent = document.getElementById('tab-content-timeline');
    const phaseContent = document.getElementById('tab-content-phase-logs');
    timelineBtn.classList.add('active');
    timelineBtn.style.color = '#fff';
    phaseBtn.classList.remove('active');
    phaseBtn.style.color = 'var(--text-muted)';
    timelineContent.style.display = 'flex';
    phaseContent.style.display = 'none';

    // Timeline
    await loadTimeline(taskId);

    openModal('modal-details');
  }

  // Auto-detect changes and save when modal closes
  async function saveDetailsOnClose() {
    if (!currentTaskId || !currentTaskSnapshot) return;

    const newTitle = document.getElementById('edit-title-input').value.trim();
    const newDesc = document.getElementById('d-desc').value;
    const newPhase = document.getElementById('d-phase-select').value;
    const newAssignee = document.getElementById('d-assignee-select').value;
    const newTime = currentTaskSnapshot.time_spent; // time is now logged separately
    const newDueDate = document.getElementById('d-due-date').value || null;
    const newLabels = currentTaskLabels.map(l => l.id);

    const snap = currentTaskSnapshot;
    const hasChanges =
      newTitle !== snap.title ||
      newDesc !== snap.description ||
      newPhase !== snap.phase ||
      newAssignee !== snap.assignee_discord_id ||
      newTime !== snap.time_spent ||
      newDueDate !== (snap.due_date ? snap.due_date.split('T')[0] : null) ||
      JSON.stringify(newLabels.sort()) !== JSON.stringify(snap.labels.sort());

    if (!hasChanges) return;

    try {
      const res = await fetch(`/api/tasks/${currentTaskId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          phase: newPhase,
          assignee_discord_id: newAssignee || null,
          time_spent: newTime,
          due_date: newDueDate,
          labels: newLabels,
          actor_name: currentUser?.name || 'Web',
          actor_discord_id: currentUser?.id || null
        })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao salvar.');
      }
      toast('Alterações salvas.', 'success');
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function reloadDetailFields(taskId) {
    if (!taskId) return;
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) return;
    await loadTimeline(taskId);
  }

  // ============================================================
  // SIDEBAR RIGHT TABS: TIMELINE & PHASE LOGS
  // ============================================================
  function switchRightTab(tab) {
    const timelineBtn = document.getElementById('btn-tab-timeline');
    const phaseBtn    = document.getElementById('btn-tab-phase-logs');
    const timelineContent = document.getElementById('tab-content-timeline');
    const phaseContent    = document.getElementById('tab-content-phase-logs');

    if (tab === 'timeline') {
      timelineBtn.classList.add('active');    timelineBtn.style.color = '#fff';
      phaseBtn.classList.remove('active');   phaseBtn.style.color = 'var(--text-muted)';
      timelineContent.style.display = 'flex';
      phaseContent.style.display    = 'none';
    } else {
      phaseBtn.classList.add('active');       phaseBtn.style.color = '#fff';
      timelineBtn.classList.remove('active'); timelineBtn.style.color = 'var(--text-muted)';
      timelineContent.style.display = 'none';
      phaseContent.style.display    = 'flex';
      loadPhaseLogs(currentTaskId);
    }
  }

  let currentPhaseLogs = [];

  async function loadPhaseLogs(taskId) {
    const container = document.getElementById('phase-logs-container');
    container.innerHTML = '<div class="no-items">Carregando...</div>';
    try {
      const res = await fetch('/api/tasks/' + taskId + '/activity/by-phase');
      if (!res.ok) throw new Error('Erro ao carregar logs da fase');
      currentPhaseLogs = await res.json();

      // Populate user filter
      const userSel = document.getElementById('log-filter-user');
      const seen    = new Set();
      let opts = '<option value="">Todos usuários</option>';
      currentPhaseLogs.forEach(g => {
        g.users.forEach(u => {
          if (!seen.has(u.name)) {
            seen.add(u.name);
            opts += '<option value="' + esc(u.name) + '">' + esc(u.name) + '</option>';
          }
        });
      });
      userSel.innerHTML = opts;

      renderPhaseLogs();
    } catch (e) {
      console.error(e);
      container.innerHTML = '<div class="no-items" style="color:var(--danger)">Erro ao carregar logs.</div>';
    }
  }

  function applyLogFilters() { renderPhaseLogs(); }

  function phaseColor(phaseId) {
    const map = { backlog:'#6366f1', todo:'#3b82f6', andamento:'#f59e0b', revisao:'#a855f7', concluido:'#10b981', bloqueado:'#ef4444' };
    return map[phaseId] || '#94a3b8';
  }

  function formatMinutes(mins) {
    if (!mins || isNaN(mins) || mins <= 0) return '0min';
    const mRound = Math.round(parseFloat(mins));
    const h = Math.floor(mRound / 60);
    const m = mRound % 60;
    return h > 0 ? h + 'h' + (m > 0 ? m + 'm' : '') : m + 'min';
  }

  function renderPhaseLogs() {
    const container   = document.getElementById('phase-logs-container');
    container.innerHTML = '';

    const filterUser   = (document.getElementById('log-filter-user')  || {}).value || '';
    const filterAction = (document.getElementById('log-filter-action') || {}).value || '';
    const filterStart  = (document.getElementById('log-filter-start')  || {}).value || '';
    const filterEnd    = (document.getElementById('log-filter-end')    || {}).value || '';

    let rendered = 0;

    currentPhaseLogs.forEach((group, gIndex) => {
      const filteredUsers = [];
      let phaseActionCount = 0;

      group.users.forEach(user => {
        if (filterUser && user.name !== filterUser) return;

        const filteredActions = user.actions.filter(act => {
          if (filterAction) {
            if (filterAction === 'checklist' && !act.type.startsWith('checklist_')) return false;
            if (filterAction !== 'checklist' && !act.type.startsWith('checklist_') && act.type !== filterAction) return false;
          }
          if (act.timestamp) {
            const d = (act.timestamp || '').split('T')[0];
            if (filterStart && d < filterStart) return false;
            if (filterEnd   && d > filterEnd)   return false;
          }
          return true;
        });

        if (filteredActions.length > 0) {
          phaseActionCount += filteredActions.length;
          filteredUsers.push({ ...user, actions: filteredActions });
        }
      });

      if (filteredUsers.length === 0) return;
      rendered++;

      const acc = document.createElement('div');
      acc.className = 'phase-log-accordion' + (gIndex === 0 ? ' open' : '');

      const totalTimeStr = formatMinutes(Math.round((group.totalTimeMs || 0) / 60000));

      const header = document.createElement('div');
      header.className = 'phase-log-header';
      header.onclick   = () => acc.classList.toggle('open');
      header.innerHTML =
        '<div class="phase-log-title">' +
          '<span class="col-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:' + phaseColor(group.phaseId) + '"></span>' +
          '<span>' + esc(group.phaseName) + '</span>' +
        '</div>' +
        '<div class="phase-log-meta-right">' +
          '<span>' + phaseActionCount + ' ações · ' + totalTimeStr + '</span>' +
          '<i class="fa-solid fa-chevron-down"></i>' +
        '</div>';

      const body = document.createElement('div');
      body.className = 'phase-log-body';

      filteredUsers.forEach(user => {
        const uAcc = document.createElement('div');
        uAcc.className = 'user-log-accordion open';

        const uHeader = document.createElement('div');
        uHeader.className = 'user-log-header';
        uHeader.onclick   = e => { e.stopPropagation(); uAcc.classList.toggle('open'); };

        const avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=6366f1&color=fff&size=24';
        uHeader.innerHTML =
          '<div class="user-log-title">' +
            '<i class="fa-solid fa-chevron-right" style="margin-right:4px;font-size:9px;transition:transform .2s;"></i>' +
            '<img src="' + esc(avatar) + '" class="user-log-avatar" alt="Avatar">' +
            '<span>' + esc(user.name) + '</span>' +
            '<span style="margin-left:auto;font-size:10px;color:var(--text-dim);">' + user.actions.length + ' ações</span>' +
          '</div>';

        const uBody = document.createElement('div');
        uBody.className = 'user-log-body';

        user.actions.forEach(act => {
          const actEl = document.createElement('div');
          actEl.className = 'action-entry';

          let text = '';
          const t = act.type || act.action || '';
          const det = act.details || {};
          if (t === 'created')             text = 'Criou a task';
          else if (t === 'moved')          text = 'Moveu da fase <strong>' + esc(det.from_phase || '') + '</strong> para a fase <strong>' + esc(det.to_phase || '') + '</strong>';
          else if (t === 'assigned')       text = 'Atribuiu a task para <strong>' + esc(det.to_phase || det.to_value || '') + '</strong>';
          else if (t === 'unassigned')     text = 'Removeu a atribuição de <strong>' + esc(det.from_phase || det.from_value || '') + '</strong>';
          else if (t === 'commented')      text = 'Comentou: <em>"' + esc(det.text || det.to_value || '') + '"</em>';
          else if (t.startsWith('checklist_')) {
            const ca    = t.replace('checklist_', '');
            const title = esc(det.title || '');
            if (ca === 'created')              text = 'Criou subtarefa <strong>"' + title + '"</strong>';
            else if (ca === 'status_changed')  text = 'Status de "' + title + '" → <strong>' + esc(det.to_value || '') + '</strong>';
            else if (ca === 'assignee_changed') text = 'Atribuiu "' + title + '" para <strong>' + esc(det.to_value || '') + '</strong>';
            else if (ca === 'completed')       text = 'Concluiu <strong>"' + title + '"</strong>';
            else if (ca === 'commented')       text = 'Comentou em "' + title + '": <em>"' + esc(det.to_value || '') + '"</em>';
            else                               text = 'Subtarefa "' + title + '": ' + ca;
          } else text = 'Alterou <strong>' + esc(t) + '</strong>';

          const ts  = act.timestamp || act.created_at || '';
          const d   = new Date(ts + (ts && !ts.endsWith('Z') ? 'Z' : ''));
          const timeFmt = isNaN(d) ? '' : d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
          actEl.innerHTML = '<span class="action-dot">•</span>' + text + '<span class="action-entry-time">' + timeFmt + '</span>';
          uBody.appendChild(actEl);
        });

        uAcc.appendChild(uHeader);
        uAcc.appendChild(uBody);
        body.appendChild(uAcc);
      });

      acc.appendChild(header);
      acc.appendChild(body);
      container.appendChild(acc);
    });

    if (!rendered) {
      container.innerHTML = '<div class="no-items">Nenhum log corresponde aos filtros.</div>';
    }
  }

  // ============================================================
  // ADVANCED CHECKLISTS (ETAPAS DE EXECUÇÃO)
  // ============================================================
  let currentTaskChecklists = [];
  let expandedChecklists    = new Set();

  function statusIcon(status) {
    if (status === 'doing')   return '<i class="fa-solid fa-circle-play"   style="color:#3b82f6;font-size:12px;"></i>';
    if (status === 'review')  return '<i class="fa-solid fa-spinner fa-spin" style="color:#eab308;font-size:12px;"></i>';
    if (status === 'done')    return '<i class="fa-solid fa-circle-check"   style="color:#10b981;font-size:12px;"></i>';
    if (status === 'blocked') return '<i class="fa-solid fa-circle-xmark"   style="color:#ef4444;font-size:12px;"></i>';
    return '<i class="fa-regular fa-circle" style="color:#64748b;font-size:12px;"></i>';
  }

  function renderChecklists() {
    const container = document.getElementById('d-checklists-container');
    if (!container) return;
    container.innerHTML = '';

    const total = currentTaskChecklists.length;
    const done  = currentTaskChecklists.filter(c => c.status === 'done' || c.is_completed === 1).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    const ptEl  = document.getElementById('cl-progress-text');
    const pPctEl = document.getElementById('cl-progress-pct');
    const pBarEl = document.getElementById('cl-progress-bar');
    if (ptEl)   ptEl.textContent  = done + ' de ' + total + ' etapas concluídas';
    if (pPctEl) pPctEl.textContent = pct + '%';
    if (pBarEl) pBarEl.style.width = pct + '%';

    if (total === 0) {
      container.innerHTML = '<div class="no-items">Nenhuma etapa. Use o campo abaixo para adicionar.</div>';
      return;
    }

    currentTaskChecklists.forEach(chk => {
      const isOpen = expandedChecklists.has(chk.id);
      const isDone = chk.status === 'done' || chk.is_completed === 1;

      let assigneeBadge = '';
      if (chk.assignee_name) assigneeBadge = '<span class="adv-checklist-badge" style="background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.3);border-radius:20px;padding:1px 7px;font-size:10px;"><i class="fa-solid fa-user" style="margin-right:3px;font-size:9px;"></i>' + esc(chk.assignee_name) + '</span>';

      let timeBadge = '';
      if (chk.time_spent > 0) timeBadge = '<span class="adv-checklist-badge" style="background:rgba(245,158,11,.1);color:#fbbf24;border:1px solid rgba(245,158,11,.3);border-radius:20px;padding:1px 7px;font-size:10px;"><i class="fa-regular fa-clock" style="margin-right:3px;font-size:9px;"></i>' + formatMinutes(chk.time_spent) + '</span>';

      const allMembersRef = typeof allMembers !== 'undefined' ? allMembers : [];
      const assigneeOpts  = '<option value="">Sem responsável</option>' +
        allMembersRef.map(m =>
          '<option value="' + esc(m.id || m.discord_id || '') + '|' + esc(m.display_name || m.username || m.name || '') + '"' +
          ((m.id || m.discord_id) === chk.assignee_discord_id ? ' selected' : '') + '>' +
          esc(m.display_name || m.username || m.name || '') + '</option>'
        ).join('');

      // Comments
      let commentsHtml = '<div class="no-items" style="font-size:10px;">Sem comentários.</div>';
      if (chk.comments && chk.comments.length > 0) {
        commentsHtml = chk.comments.map(c =>
          '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:4px;padding:5px 8px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
              '<span style="font-weight:700;color:var(--accent);font-size:10px;">' + esc(c.author_name) + '</span>' +
              '<span style="color:var(--text-dim);font-size:9px;">' + fmtRelativeTime(c.created_at) + '</span>' +
            '</div>' +
            '<div style="color:#e2e8f0;font-size:11px;word-break:break-word;line-height:1.3;">' + esc(c.text) + '</div>' +
          '</div>'
        ).join('');
      }

      // Activity
      let activityHtml = '<div class="no-items" style="font-size:10px;">Sem histórico.</div>';
      if (chk.activity && chk.activity.length > 0) {
        activityHtml = chk.activity.map(a => {
          let at = '';
          if (a.action === 'created')              at = 'Criou a etapa';
          else if (a.action === 'status_changed')  at = 'Status → <strong>' + esc(a.to_value) + '</strong>';
          else if (a.action === 'assignee_changed') at = 'Atribuiu para <strong>' + esc(a.to_value || 'Ninguém') + '</strong>';
          else if (a.action === 'time_spent_changed') at = 'Tempo: <strong>' + formatMinutes(parseFloat(a.to_value)) + '</strong>';
          else if (a.action === 'completed')        at = 'Concluiu a etapa';
          else if (a.action === 'commented')        at = 'Comentou: <em>"' + esc(a.to_value) + '"</em>';
          else at = 'Alterou ' + esc(a.action);
          const ts = a.created_at || '';
          const d2 = new Date(ts + (!ts.endsWith('Z') ? 'Z' : ''));
          const t2 = isNaN(d2) ? '' : d2.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
          return '<div style="padding:2px 0;border-bottom:1px dashed rgba(255,255,255,0.03);font-size:10.5px;color:var(--text-muted);">• ' + at + (t2 ? ' <span style="font-size:8px;color:var(--text-dim);">' + t2 + '</span>' : '') + '</div>';
        }).join('');
      }

      const el = document.createElement('div');
      el.className = 'adv-checklist-item' + (isOpen ? ' open' : '');
      el.id = 'adv-cl-' + chk.id;
      el.innerHTML =
        '<div class="adv-checklist-header" onclick="toggleChecklistExpand(' + chk.id + ')">' +
          '<i class="fa-solid fa-chevron-right" style="font-size:9px;margin-right:4px;transition:transform .2s;"></i>' +
          '<span style="margin-right:6px;">' + statusIcon(chk.status) + '</span>' +
          '<span class="adv-checklist-title-text' + (isDone ? ' completed' : '') + '" style="flex:1;font-size:13px;font-weight:500;">' + esc(chk.title) + '</span>' +
          '<div style="display:flex;gap:4px;align-items:center;">' + assigneeBadge + timeBadge + '</div>' +
          '<button class="col-action-btn delete" onclick="event.stopPropagation();deleteChecklist(' + chk.id + ')" title="Excluir" style="margin-left:6px;"><i class="fa-solid fa-trash"></i></button>' +
        '</div>' +
        '<div class="adv-checklist-body">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Título</label>' +
              '<input type="text" class="fc" style="font-size:12px;padding:5px 8px;" value="' + esc(chk.title) + '"' +
              ' onchange="updateChecklistItem(' + chk.id + ',{title:this.value})">' +
            '</div>' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Status</label>' +
              '<select class="fc" style="font-size:12px;padding:5px 8px;" onchange="updateChecklistItem(' + chk.id + ',{status:this.value})">' +
                '<option value="todo"'    + (chk.status==='todo'    ?' selected':'') + '>Não iniciado</option>' +
                '<option value="doing"'   + (chk.status==='doing'   ?' selected':'') + '>Em andamento</option>' +
                '<option value="review"'  + (chk.status==='review'  ?' selected':'') + '>Em revisão</option>' +
                '<option value="done"'    + (chk.status==='done'    ?' selected':'') + '>Concluído</option>' +
                '<option value="blocked"' + (chk.status==='blocked' ?' selected':'') + '>Bloqueado</option>' +
              '</select>' +
            '</div>' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Responsável</label>' +
              '<select class="fc" style="font-size:12px;padding:5px 8px;" onchange="handleClAssignee(' + chk.id + ',this.value)">' + assigneeOpts + '</select>' +
            '</div>' +
            '<div class="fg">' +
              '<label class="checklist-sub-label" style="display:flex;justify-content:space-between;"><span>Tempo total</span><strong style="color:var(--accent)">' + (chk.time_spent||0) + ' min</strong></label>' +
              '<div style="display:flex;gap:4px;">' +
                '<input type="text" class="fc" style="font-size:12px;padding:5px 8px;flex:1;" placeholder="ex: 30min, 1h" id="cl-time-' + chk.id + '">' +
                '<button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;" onclick="logChecklistTime(' + chk.id + ')"><i class="fa-solid fa-plus"></i></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="fg" style="margin-bottom:8px;">' +
            '<label class="checklist-sub-label">Descrição</label>' +
            '<textarea class="fc" style="font-size:12px;padding:5px 8px;min-height:44px;" placeholder="Detalhes desta etapa..."' +
            ' onchange="updateChecklistItem(' + chk.id + ',{description:this.value})">' + esc(chk.description||'') + '</textarea>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">' +
            '<div>' +
              '<div class="checklist-sub-label" style="margin-bottom:5px;"><i class="fa-solid fa-comments"></i> Comentários</div>' +
              '<div id="cl-cmt-' + chk.id + '" style="max-height:110px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:6px;">' + commentsHtml + '</div>' +
              '<div style="display:flex;gap:4px;">' +
                '<input type="text" id="cl-ci-' + chk.id + '" class="fc" style="font-size:11px;padding:3px 6px;flex:1;" placeholder="Comentar..." onkeydown="if(event.key===&quot;Enter&quot;) submitClComment(' + chk.id + ')">' +
                '<button type="button" class="btn btn-primary btn-sm" style="padding:3px 8px;" onclick="submitClComment(' + chk.id + ')"><i class="fa-solid fa-paper-plane"></i></button>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<div class="checklist-sub-label" style="margin-bottom:5px;"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</div>' +
              '<div id="cl-act-' + chk.id + '" style="max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;">' + activityHtml + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      container.appendChild(el);
    });
  }

  function toggleChecklistExpand(id) {
    const el = document.getElementById('adv-cl-' + id);
    if (!el) return;
    if (el.classList.contains('open')) { el.classList.remove('open'); expandedChecklists.delete(id); }
    else                               { el.classList.add('open');    expandedChecklists.add(id);    }
  }

  function handleClAssignee(chkId, val) {
    if (!val) { updateChecklistItem(chkId, { assignee_name: null, assignee_discord_id: null }); return; }
    const parts = val.split('|');
    updateChecklistItem(chkId, { assignee_discord_id: parts[0], assignee_name: parts.slice(1).join('|') });
  }

  async function updateChecklistItem(id, fields) {
    try {
      const payload = {
        ...fields,
        actor_name: (currentUser && currentUser.name) ? currentUser.name : 'Web',
        actor_discord_id: (currentUser && currentUser.id) ? currentUser.id : null
      };
      const res = await fetch('/api/checklists/' + id, {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao atualizar subtarefa');
      // Reload task to get fresh checklists
      const tRes = await fetch('/api/tasks/' + currentTaskId);
      if (tRes.ok) { const t = await tRes.json(); currentTaskChecklists = t.checklists || []; }
      renderChecklists();
      renderBoard();
    } catch (e) { toast(e.message, 'error'); renderChecklists(); }
  }

  async function submitClComment(chkId) {
    const input = document.getElementById('cl-ci-' + chkId);
    const text  = input ? input.value.trim() : '';
    if (!text) return;
    input.value = '';
    try {
      const res = await fetch('/api/checklists/' + chkId + '/comments', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          text,
          author_name: (currentUser && currentUser.name) ? currentUser.name : 'Web',
          author_discord_id: (currentUser && currentUser.id) ? currentUser.id : null
        })
      });
      if (!res.ok) throw new Error('Erro ao comentar');
      const tRes = await fetch('/api/tasks/' + currentTaskId);
      if (tRes.ok) { const t = await tRes.json(); currentTaskChecklists = t.checklists || []; }
      renderChecklists();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addChecklistItem() {
    if (!currentTaskId) return;
    const input = document.getElementById('d-new-checklist');
    const title = input ? input.value.trim() : '';
    if (!title) return;
    input.value = '';
    try {
      const res = await fetch('/api/tasks/' + currentTaskId + '/checklists', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          actor_name: (currentUser && currentUser.name) ? currentUser.name : 'Web',
          actor_discord_id: (currentUser && currentUser.id) ? currentUser.id : null
        })
      });
      if (!res.ok) throw new Error('Erro ao adicionar');
      const newItem = await res.json();
      newItem.comments = []; newItem.activity = [];
      currentTaskChecklists.push(newItem);
      renderChecklists();
      renderBoard();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteChecklist(id) {
    if (!confirm('Deseja excluir esta subtarefa?')) return;
    try {
      const res = await fetch('/api/checklists/' + id, {
        method: 'DELETE', headers: getAuthHeadersDelete(),
        body: JSON.stringify({
          actor_name: (currentUser && currentUser.name) ? currentUser.name : 'Web',
          actor_discord_id: (currentUser && currentUser.id) ? currentUser.id : null
        })
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      currentTaskChecklists = currentTaskChecklists.filter(c => c.id !== id);
      expandedChecklists.delete(id);
      renderChecklists();
      renderBoard();
    } catch (e) { toast(e.message, 'error'); }
  }


    // Close buttons trigger auto-save
  ['details-close-btn', 'details-close-btn2'].forEach(id => {
    document.getElementById(id).addEventListener('click', async () => {
      await saveDetailsOnClose();
      closeModal('modal-details');
      currentTaskId = null;
      currentTaskSnapshot = null;
    });
  });

  // Close on overlay click
  document.getElementById('modal-details').addEventListener('click', async e => {
    if (e.target === document.getElementById('modal-details')) {
      await saveDetailsOnClose();
      closeModal('modal-details');
      currentTaskId = null;
      currentTaskSnapshot = null;
    }
  });

  // ============================================================
  // LABELS SELECTOR
  // ============================================================
  function toggleCreateLabelDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('create-label-dropdown');
    const isShowing = dropdown.style.display === 'flex';
    document.getElementById('details-label-dropdown').style.display = 'none';
    
    if (isShowing) {
      dropdown.style.display = 'none';
    } else {
      dropdown.style.display = 'flex';
      document.getElementById('create-label-search').value = '';
      hideCreateLabelForm('create');
      renderLabelDropdownList('create');
      setTimeout(() => document.getElementById('create-label-search').focus(), 50);
    }
  }

  function toggleDetailsLabelDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('details-label-dropdown');
    const isShowing = dropdown.style.display === 'flex';
    document.getElementById('create-label-dropdown').style.display = 'none';
    
    if (isShowing) {
      dropdown.style.display = 'none';
    } else {
      dropdown.style.display = 'flex';
      document.getElementById('details-label-search').value = '';
      hideCreateLabelForm('details');
      renderLabelDropdownList('details');
      setTimeout(() => document.getElementById('details-label-search').focus(), 50);
    }
  }

  function renderSelectedLabels(type) {
    if (type === 'create') {
      const container = document.getElementById('ct-labels-container');
      container.innerHTML = '';
      selectedCreateLabels.forEach(lbl => {
        const pill = document.createElement('span');
        pill.className = 'applied-label-pill';
        pill.style.background = lbl.color;
        pill.style.color = colorText(lbl.color);
        pill.innerHTML = `<i class="fa-solid fa-tag"></i> ${esc(lbl.name)}`;
        pill.onclick = (e) => toggleCreateLabelDropdown(e);
        container.appendChild(pill);
      });
    } else {
      const container = document.getElementById('d-labels-container');
      container.innerHTML = '';
      currentTaskLabels.forEach(lbl => {
        const pill = document.createElement('span');
        pill.className = 'applied-label-pill';
        pill.style.background = lbl.color;
        pill.style.color = colorText(lbl.color);
        pill.innerHTML = `<i class="fa-solid fa-tag"></i> ${esc(lbl.name)}`;
        pill.onclick = (e) => toggleDetailsLabelDropdown(e);
        container.appendChild(pill);
      });
    }
  }

  function renderLabelDropdownList(type, filterQuery = '') {
    const listContainer = document.getElementById(type === 'create' ? 'create-label-list' : 'details-label-list');
    listContainer.innerHTML = '';
    
    const selectedIds = type === 'create' 
      ? selectedCreateLabels.map(l => l.id) 
      : currentTaskLabels.map(l => l.id);
      
    const filtered = allLabels.filter(l => l.name.toLowerCase().includes(filterQuery.toLowerCase()));
    
    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="no-items" style="padding: 8px; text-align: center;">Nenhuma etiqueta encontrada</div>';
      return;
    }
    
    filtered.forEach(lbl => {
      const isSelected = selectedIds.includes(lbl.id);
      const row = document.createElement('div');
      row.className = 'label-item-row' + (isSelected ? ' selected' : '');
      
      row.innerHTML = `
        <div class="label-item-left">
          <div class="label-item-check"><i class="fa-solid fa-check"></i></div>
          <span class="label-item-pill" style="background:${lbl.color}; color:${colorText(lbl.color)};">${esc(lbl.name)}</span>
        </div>
        <div class="label-item-actions">
          <button type="button" class="label-item-action-btn delete" onclick="event.stopPropagation(); deleteLabelGlobal(${lbl.id}, '${type}')" title="Excluir do sistema">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      
      row.onclick = (e) => {
        e.stopPropagation();
        toggleLabelSelection(lbl, type);
      };
      
      listContainer.appendChild(row);
    });
  }

  function toggleLabelSelection(label, type) {
    if (type === 'create') {
      const idx = selectedCreateLabels.findIndex(l => l.id === label.id);
      if (idx > -1) {
        selectedCreateLabels.splice(idx, 1);
      } else {
        selectedCreateLabels.push(label);
      }
      renderSelectedLabels('create');
      renderLabelDropdownList('create', document.getElementById('create-label-search').value);
    } else {
      const idx = currentTaskLabels.findIndex(l => l.id === label.id);
      if (idx > -1) {
        currentTaskLabels.splice(idx, 1);
      } else {
        currentTaskLabels.push(label);
      }
      renderSelectedLabels('details');
      renderLabelDropdownList('details', document.getElementById('details-label-search').value);
    }
  }

  function filterLabels(type) {
    const input = document.getElementById(type === 'create' ? 'create-label-search' : 'details-label-search');
    renderLabelDropdownList(type, input.value.trim());
  }

  function showCreateLabelForm(type) {
    document.getElementById(type === 'create' ? 'create-label-list' : 'details-label-list').style.display = 'none';
    document.getElementById(type === 'create' ? 'create-label-dropdown' : 'details-label-dropdown').querySelector('.label-dropdown-footer').style.display = 'none';
    
    const form = document.getElementById(type === 'create' ? 'create-label-create-form' : 'details-label-create-form');
    form.style.display = 'flex';
    document.getElementById(type === 'create' ? 'create-new-label-name' : 'details-new-label-name').value = '';
    
    if (type === 'create') activeCreateColor = presetColors[0];
    else activeDetailsColor = presetColors[0];
    
    renderColorPalette(type);
    setTimeout(() => document.getElementById(type === 'create' ? 'create-new-label-name' : 'details-new-label-name').focus(), 50);
  }

  function hideCreateLabelForm(type) {
    document.getElementById(type === 'create' ? 'create-label-list' : 'details-label-list').style.display = 'flex';
    document.getElementById(type === 'create' ? 'create-label-dropdown' : 'details-label-dropdown').querySelector('.label-dropdown-footer').style.display = 'block';
    document.getElementById(type === 'create' ? 'create-label-create-form' : 'details-label-create-form').style.display = 'none';
  }

  function renderColorPalette(type) {
    const palette = document.getElementById(type === 'create' ? 'create-label-colors' : 'details-label-colors');
    palette.innerHTML = '';
    const activeColor = type === 'create' ? activeCreateColor : activeDetailsColor;
    
    presetColors.forEach(color => {
      const circle = document.createElement('div');
      circle.className = 'color-circle' + (color === activeColor ? ' active' : '');
      circle.style.background = color;
      circle.onclick = (e) => {
        e.stopPropagation();
        if (type === 'create') activeCreateColor = color;
        else activeDetailsColor = color;
        renderColorPalette(type);
      };
      palette.appendChild(circle);
    });
  }

  async function submitCreateLabel(type) {
    const nameInput = document.getElementById(type === 'create' ? 'create-new-label-name' : 'details-new-label-name');
    const name = nameInput.value.trim();
    const color = type === 'create' ? activeCreateColor : activeDetailsColor;
    
    if (!name) { toast('Nome da etiqueta obrigatório.', 'error'); return; }

    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, color })
      });
      const lbl = await res.json();
      if (!res.ok) throw new Error(lbl.error || 'Erro ao criar etiqueta.');
      
      allLabels.push(lbl);
      
      if (type === 'create') {
        selectedCreateLabels.push(lbl);
        renderSelectedLabels('create');
      } else {
        currentTaskLabels.push(lbl);
        renderSelectedLabels('details');
      }
      
      hideCreateLabelForm(type);
      renderLabelDropdownList(type);
      toast(`Etiqueta "${name}" criada!`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteLabelGlobal(id, type) {
    if (!confirm('Excluir esta etiqueta globalmente? Ela será removida de todas as tasks.')) return;
    try {
      const res = await fetch(`/api/labels/${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersDelete()
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao excluir etiqueta.');
      
      toast('Etiqueta excluída.', 'success');
      allLabels = allLabels.filter(l => l.id !== id);
      selectedCreateLabels = selectedCreateLabels.filter(l => l.id !== id);
      currentTaskLabels = currentTaskLabels.filter(l => l.id !== id);
      
      renderSelectedLabels('create');
      renderSelectedLabels('details');
      renderLabelDropdownList(type);
      
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ============================================================
  // UNIFIED TIMELINE (COMMENTS & ACTIVITY)
  // ============================================================
  async function loadTimeline(taskId) {
    const list = document.getElementById('timeline-feed');
    try {
      const [comRes, actRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}/comments`),
        fetch(`/api/tasks/${taskId}/activity`)
      ]);
      
      let comments = comRes.ok ? await comRes.json() : [];
      let activities = actRes.ok ? await actRes.json() : [];
      
      const feed = [
        ...comments.map(c => ({...c, type: 'comment', timeMs: new Date(c.created_at).getTime()})),
        ...activities.map(a => ({...a, type: 'activity', timeMs: new Date(a.created_at).getTime()}))
      ];
      feed.sort((a, b) => b.timeMs - a.timeMs);
      
      list.innerHTML = '';
      if (!feed.length) {
        list.innerHTML = '<div class="no-items">Nenhuma atividade registrada.</div>';
        return;
      }
      
      // Render vertical line for timeline
      const line = document.createElement('div');
      line.className = 'timeline-line';
      list.appendChild(line);

      feed.forEach(item => {
        const el = document.createElement('div');
        el.className = 'timeline-item';
        
        if (item.type === 'activity') {
          let text = '';
          let icon = '<i class="fa-solid fa-bolt"></i>';
          let color = '#6c757d';

          if (item.action === 'created') {
            text = `Task criada por <strong>${esc(item.actor_name)}</strong>`;
            icon = '<i class="fa-solid fa-plus"></i>'; color = '#28a745';
          } else if (item.action === 'moved') {
            text = `Movida de <strong>${esc(item.from_phase)}</strong> para <strong>${esc(item.to_phase)}</strong> por <strong>${esc(item.actor_name)}</strong>`;
            icon = '<i class="fa-solid fa-arrow-right-arrow-left"></i>'; color = '#17a2b8';
          } else if (item.action === 'assigned') {
            text = `Atribuída para <strong>${esc(item.actor_name)}</strong>`;
            icon = '<i class="fa-solid fa-user-check"></i>'; color = '#6f42c1';
          } else if (item.action === 'unassigned') {
            text = `Atribuição removida por <strong>${esc(item.actor_name)}</strong>`;
            icon = '<i class="fa-solid fa-user-minus"></i>'; color = '#dc3545';
          } else if (item.action === 'phase_changed') {
             text = `Fase alterada de <strong>${esc(item.from_phase)}</strong> para <strong>${esc(item.to_phase)}</strong>`;
             icon = '<i class="fa-solid fa-arrow-right-arrow-left"></i>'; color = '#17a2b8';
          } else if (item.action === 'assigned' || item.action === 'unassigned') {
            // Already handled above, just fallback
            text = `Alteração de responsabilidade.`;
          } else {
            text = `Atividade: <strong>${esc(item.action)}</strong> por <strong>${esc(item.actor_name)}</strong>`;
          }

          el.innerHTML = `
            <div class="timeline-badge-circle" style="background:${color}; border:1px solid rgba(255,255,255,0.2);">
              ${icon}
            </div>
            <div class="timeline-activity-card">
              <span class="timeline-activity-text">${text}</span>
              <span class="timeline-time">${fmtRelativeTime(item.created_at)}</span>
            </div>
          `;
        } else {
          // Comment Render Logic
          // Comment Deleted State
          if (item.deleted_at) {
            el.innerHTML = `
              <div class="timeline-badge-circle" style="background:#ef4444; border:1px solid rgba(255,255,255,0.2);">
                <i class="fa-solid fa-ban"></i>
              </div>
              <div class="timeline-comment-card" style="opacity:0.6; background:rgba(239,68,68,0.02); border-color:rgba(239,68,68,0.1);">
                <div style="font-size:11px; color:var(--text-muted);">
                  Comentário removido por <strong>${esc(item.deleted_by_name)}</strong> ${fmtRelativeTime(item.deleted_at)}
                </div>
              </div>
            `;
            list.appendChild(el);
            return;
          }

          const isForm = item.text.includes('📝 **Formulário Preenchido');
          let displayHtml = esc(item.text).replace(/\n/g, '<br>');
          if (isForm) {
            displayHtml = item.text
              .replace(/📝 \*\*Formulário Preenchido na Mudança de Fase:\*\*/, '<div style="font-weight:700;color:var(--accent);margin-bottom:6px;"><i class="fa-solid fa-clipboard-check"></i> Formulário Preenchido</div>')
              .replace(/\*\*(.*?)\*\*:/g, '<strong style="color:#cbd5e1;">$1:</strong>')
              .replace(/\n/g, '<br>');
          }

          const isAdmin = currentUser && currentUser.role === 'admin';
          const isPinned = item.is_pinned === 1;
          
          let controlsHtml = '';
          if (isAdmin) {
            controlsHtml = `
              <div class="comment-card-controls">
                <button type="button" class="comment-control-btn" onclick="togglePinComment(${item.id}, ${isPinned})">
                  <i class="fa-solid fa-thumbtack" style="${isPinned ? 'color:#f59e0b;' : ''}"></i> ${isPinned ? 'Desfixar' : 'Fixar'}
                </button>
                <button type="button" class="comment-control-btn delete" onclick="deleteComment(${item.id})">
                  <i class="fa-solid fa-trash"></i> Excluir
                </button>
              </div>
            `;
          }

          el.innerHTML = `
            <div class="timeline-badge-circle comment-badge">
              <i class="fa-solid fa-comment"></i>
            </div>
            <div class="timeline-comment-card${isPinned ? ' pinned' : ''}" style="${isForm ? 'background:rgba(99,102,241,0.06); border-color:rgba(99,102,241,0.15);' : ''}">
              <div class="comment-card-header">
                <span class="comment-card-author">${esc(item.author_name)}</span>
                <span class="comment-card-time">${fmtRelativeTime(item.created_at)}${item.edited_at ? ' (editado)' : ''}</span>
              </div>
              <div class="comment-card-body">${displayHtml}</div>
              ${controlsHtml}
            </div>
          `;
          list.appendChild(el);
        } // CLOSES else (item.type === 'comment')
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = '<div class="no-items" style="color:var(--danger)">Erro ao carregar timeline.</div>';
    }
  }


  // --- Comment Admin Functions ---
  async function togglePinComment(id, isPinned) {
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_pinned: !isPinned })
      });
      if (!res.ok) throw new Error('Falha ao atualizar.');
      await loadTimeline(currentTaskId);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteComment(id) {
    if (!confirm('Deseja realmente excluir este comentário?')) return;
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersDelete(),
        body: JSON.stringify({ actor_name: currentUser?.name })
      });
      if (!res.ok) throw new Error('Falha ao excluir.');
      toast('Comentário removido.', 'success');
      await loadTimeline(currentTaskId);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function submitComment() {
    const input = document.getElementById('new-comment');
    const text = input.value.trim();
    if (!text) { toast('Escreva algo.', 'error'); return; }

    try {
      const res = await fetch(`/api/tasks/${currentTaskId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text,
          author_name: currentUser?.name || 'Web',
          author_discord_id: currentUser?.id || null
        })
      });
      if (!res.ok) throw new Error('Falha ao adicionar comentário.');
      input.value = '';
      toast('Comentário adicionado!', 'success');
      await loadTimeline(currentTaskId);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ============================================================
  // DELETE TASK
  // ============================================================
  async function confirmDeleteTask() {
    if (!currentTaskId) return;
    if (!confirm('Tem certeza que deseja excluir esta task? Esta ação não pode ser desfeita.')) return;
    try {
      const res = await fetch(`/api/tasks/${currentTaskId}`, {
        method: 'DELETE',
        headers: getAuthHeadersDelete()
      });
      if (!res.ok && res.status !== 404) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erro ao excluir.');
      }
      toast('Task excluída.', 'success');
      closeModal('modal-details');
      currentTaskId = null;
      currentTaskSnapshot = null;
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ============================================================
  // COLUMN MANAGEMENT
  // ============================================================
  function openAddColumnModal() {
    editingColumnId = null;
    document.getElementById('col-modal-title').innerHTML = '<i class="fa-solid fa-columns"></i> Nova Fase';
    document.getElementById('col-name-input').value = '';
    document.getElementById('col-submit-btn').textContent = 'Criar';
    openModal('modal-column');
    setTimeout(() => document.getElementById('col-name-input').focus(), 100);
  }

  function openRenameColumn(id, name) {
    editingColumnId = id;
    document.getElementById('col-modal-title').innerHTML = '<i class="fa-solid fa-pen"></i> Renomear Fase';
    document.getElementById('col-name-input').value = name;
    document.getElementById('col-submit-btn').textContent = 'Salvar';
    openModal('modal-column');
    setTimeout(() => document.getElementById('col-name-input').focus(), 100);
  }

  async function submitColumn() {
    const name = document.getElementById('col-name-input').value.trim();
    if (!name) { toast('Nome obrigatório.', 'error'); return; }

    try {
      let res;
      if (editingColumnId) {
        res = await fetch(`/api/phases/${editingColumnId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name })
        });
      } else {
        res = await fetch('/api/phases', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name })
        });
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro.');
      toast(editingColumnId ? 'Fase renomeada!' : 'Fase criada!', 'success');
      closeModal('modal-column');
      await loadPhases();
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteColumn(id) {
    if (!confirm('Excluir esta fase? Só é possível se estiver vazia.')) return;
    try {
      const res = await fetch(`/api/phases/${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersDelete()
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao excluir fase.');
      toast('Fase excluída.', 'success');
      await loadPhases();
      await renderBoard();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ============================================================
  // MODAL HELPERS
  // ============================================================
  function openModal(id) {
    document.getElementById(id).classList.add('active');
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }



  // Close modals on overlay click (except details — it has custom handler)
  ['modal-create', 'modal-column', 'modal-dynamic'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === document.getElementById(id)) closeModal(id);
    });
  });

  // Global click listener to close label dropdowns when clicking outside
  document.addEventListener('click', e => {
    const detailsDropdown = document.getElementById('details-label-dropdown');
    const createDropdown = document.getElementById('create-label-dropdown');
    
    if (detailsDropdown && detailsDropdown.style.display === 'flex') {
      const isClickInside = detailsDropdown.contains(e.target) || 
                            e.target.closest('#btn-details-add-label') || 
                            e.target.closest('#d-labels-container');
      if (!isClickInside) {
        detailsDropdown.style.display = 'none';
      }
    }
    
    if (createDropdown && createDropdown.style.display === 'flex') {
      const isClickInside = createDropdown.contains(e.target) || 
                            e.target.closest('#btn-create-add-label') || 
                            e.target.closest('#ct-labels-container');
      if (!isClickInside) {
        createDropdown.style.display = 'none';
      }
    }
  });

  // Enter key to submit column name
  document.getElementById('col-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitColumn();
  });

  // Enter on comment input
  document.getElementById('new-comment').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitComment();
  });

  // ============================================================
  // BOOT
  // ============================================================
  document.addEventListener('DOMContentLoaded', checkAuth);



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

  function parseTimeString(str) {
    if (!str) return 0;
    str = str.trim().toLowerCase();
    let total = 0;
    const hoursMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
    const minsMatch  = str.match(/(\d+(?:\.\d+)?)\s*m/);
    const colonMatch = str.match(/^(\d+):(\d+)$/);
    const pureNum    = str.match(/^(\d+(?:\.\d+)?)$/);
    if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
    if (minsMatch)  total += parseFloat(minsMatch[1]);
    if (colonMatch) total += parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
    if (pureNum && !hoursMatch && !minsMatch) total += parseFloat(pureNum[1]);
    return Math.round(total);
  }

  // logMainTaskTime removed — time flows from etapas to total

  async function logChecklistTime(chkId) {
    const input = document.getElementById('cl-time-' + chkId);
    const delta = parseTimeString(input.value);
    if (!delta || delta <= 0) { toast('Formato invalido. Use: 1h30m, 50min, 90', 'error'); return; }
    try {
      input.value = '';
      await updateChecklistItem(chkId, { time_spent_delta: delta });
      // Refresh total time on the task header
      await reloadDetailFields(currentTaskId);
      toast('Tempo registrado na etapa!', 'success');
    } catch(e) {
      toast(e.message, 'error');
    }
  }

  // ===== CREATE TASK CHECKLIST =====
  let createChecklistItems = [];

  function addCreateTaskChecklistItem() {
    createChecklistItems.push({ id: Date.now(), title: '' });
    renderCreateTaskChecklist();
    // Focus last input
    setTimeout(() => {
      const inputs = document.querySelectorAll('#ct-checklist-container input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
  }

  function updateCreateTaskChecklistItem(id, val) {
    const item = createChecklistItems.find(i => i.id === id);
    if (item) item.title = val;
  }

  function updateCreateTaskChecklistDesc(id, val) {
    const item = createChecklistItems.find(i => i.id === id);
    if (item) item.description = val;
  }

  function removeCreateTaskChecklistItem(id) {
    createChecklistItems = createChecklistItems.filter(i => i.id !== id);
    renderCreateTaskChecklist();
  }

  function renderCreateTaskChecklist() {
    const container = document.getElementById('ct-checklist-container');
    if (!container) return;
    if (createChecklistItems.length === 0) {
      container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;">Nenhuma etapa adicionada ainda.</div>';
      return;
    }
    container.innerHTML = createChecklistItems.map((item, idx) => `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="color:rgba(255,255,255,0.3);font-size:11px;min-width:16px;">${idx + 1}.</span>
          <input type="text" class="fc" placeholder="Título da etapa..." style="flex:1;font-size:13px;padding:6px 10px;"
                 oninput="updateCreateTaskChecklistItem(${item.id}, this.value)"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();addCreateTaskChecklistItem();}"
                 value="${(item.title||'').replace(/"/g, '&quot;')}">
          <button type="button" class="btn btn-ghost btn-sm" onclick="removeCreateTaskChecklistItem(${item.id})" style="padding:4px 8px;">
            <i class="fa-solid fa-times" style="color:var(--danger)"></i>
          </button>
        </div>
        <textarea class="fc" placeholder="Descrição da etapa (opcional) — o que deve ser feito?" style="font-size:12px;padding:6px 10px;resize:vertical;min-height:52px;" oninput="updateCreateTaskChecklistDesc(${item.id}, this.value)">${(item.description||'').replace(/</g,'&lt;')}</textarea>
      </div>
    `).join('');
  }
