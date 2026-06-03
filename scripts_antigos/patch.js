import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Replace renderChecklists / addChecklistItem / toggleChecklist / deleteChecklist
//    with the advanced version (accordion + progress bar).
// ─────────────────────────────────────────────────────────────────────────────
const CHECKLIST_SECTION_MARKER = '  // ============================================================\n  // CHECKLISTS\n  // ============================================================\n  let currentTaskChecklists = [];';
const CHECKLIST_SECTION_END_MARKER = '  // Close buttons trigger auto-save';

const clStart = html.indexOf(CHECKLIST_SECTION_MARKER);
const clEnd   = html.indexOf(CHECKLIST_SECTION_END_MARKER);

if (clStart === -1 || clEnd === -1) {
  console.error('Could not locate CHECKLISTS section. Indices:', clStart, clEnd);
  process.exit(1);
}

const newChecklistSection = `
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
    try {
      const res = await fetch('/api/tasks/' + taskId + '/activity/by-phase');
      if (!res.ok) throw new Error('Erro ao carregar logs da fase');
      currentPhaseLogs = await res.json();

      // Populate user filter
      const userSel   = document.getElementById('log-filter-user');
      const savedVal  = userSel.value;
      const seen      = new Set();
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
      userSel.value = savedVal;

      renderPhaseLogs();
    } catch (e) {
      console.error(e);
      document.getElementById('phase-logs-container').innerHTML =
        '<div class="no-items" style="color:var(--danger)">Erro ao carregar logs.</div>';
    }
  }

  function applyLogFilters() { renderPhaseLogs(); }

  function renderPhaseLogs() {
    const container   = document.getElementById('phase-logs-container');
    container.innerHTML = '';

    const filterUser   = document.getElementById('log-filter-user').value;
    const filterAction = document.getElementById('log-filter-action').value;
    const filterStart  = document.getElementById('log-filter-start').value;
    const filterEnd    = document.getElementById('log-filter-end').value;

    currentPhaseLogs.forEach((group, gIndex) => {
      const filteredUsers = [];
      let phaseActionCount = 0;

      group.users.forEach(user => {
        if (filterUser && user.name !== filterUser) return;

        const filteredActions = user.actions.filter(act => {
          if (filterAction) {
            if (filterAction === 'checklist' && !act.type.startsWith('checklist_')) return false;
            if (filterAction !== 'checklist' && act.type !== filterAction) return false;
          }
          if (act.timestamp) {
            const d = act.timestamp.split('T')[0];
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

      if (filteredUsers.length === 0 && (filterUser || filterAction || filterStart || filterEnd)) return;

      const acc = document.createElement('div');
      acc.className = 'phase-log-accordion';
      if (gIndex === 0) acc.classList.add('open');

      const totalTimeStr = formatMinutes(Math.round(group.totalTimeMs / 60000));

      const header = document.createElement('div');
      header.className = 'phase-log-header';
      header.onclick   = () => acc.classList.toggle('open');
      header.innerHTML =
        '<div class="phase-log-title">' +
          '<span class="col-dot" style="background:' + phaseColor(group.phaseId) + '"></span>' +
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

        const avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) +
                       '&background=6366f1&color=fff';
        uHeader.innerHTML =
          '<div class="user-log-title">' +
            '<i class="fa-solid fa-chevron-right" style="margin-right:2px;"></i>' +
            '<img src="' + esc(avatar) + '" class="user-log-avatar" alt="Avatar">' +
            '<span>' + esc(user.name) + '</span>' +
          '</div>';

        const uBody = document.createElement('div');
        uBody.className = 'user-log-body';

        user.actions.forEach(act => {
          const actEl = document.createElement('div');
          actEl.className = 'action-entry';

          let text = '';
          const t = act.type;
          if (t === 'created')   text = 'Criou a task';
          else if (t === 'moved')      text = 'Moveu de <strong>' + esc(act.details.from_phase) + '</strong> para <strong>' + esc(act.details.to_phase) + '</strong>';
          else if (t === 'assigned')   text = 'Atribuiu para <strong>' + esc(act.details.to_phase) + '</strong>';
          else if (t === 'unassigned') text = 'Removeu atribuição de <strong>' + esc(act.details.from_phase) + '</strong>';
          else if (t === 'commented')  text = 'Comentou: <em>"' + esc(act.details.text) + '"</em>';
          else if (t.startsWith('checklist_')) {
            const ca = t.replace('checklist_', '');
            const title = esc(act.details ? act.details.title || '' : '');
            if (ca === 'created')          text = 'Criou subtarefa <strong>"' + title + '"</strong>';
            else if (ca === 'status_changed')  text = 'Status de "' + title + '" → <strong>' + esc(act.details.to_value) + '</strong>';
            else if (ca === 'assignee_changed') text = 'Atribuiu "' + title + '" para <strong>' + esc(act.details.to_value) + '</strong>';
            else if (ca === 'completed')    text = 'Concluiu <strong>"' + title + '"</strong>';
            else if (ca === 'commented')   text = 'Comentou em "' + title + '": <em>"' + esc(act.details.to_value) + '"</em>';
            else                           text = 'Subtarefa "' + title + '": ' + ca;
          } else text = 'Alterou <strong>' + esc(t) + '</strong>';

          const d    = new Date(act.timestamp + (act.timestamp.endsWith('Z') ? '' : 'Z'));
          const time = d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
          actEl.innerHTML = '• ' + text + '<span class="action-entry-time">' + time + '</span>';
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

    if (!container.children.length) {
      container.innerHTML = '<div class="no-items">Nenhum log corresponde aos filtros.</div>';
    }
  }

  // ============================================================
  // ADVANCED CHECKLISTS (ETAPAS DE EXECUÇÃO)
  // ============================================================
  let currentTaskChecklists = [];
  let expandedChecklists    = new Set();

  function statusIcon(status) {
    if (status === 'doing')   return '<i class="fa-solid fa-circle-play" style="color:#3b82f6"></i>';
    if (status === 'review')  return '<i class="fa-solid fa-spinner fa-spin" style="color:#eab308"></i>';
    if (status === 'done')    return '<i class="fa-solid fa-circle-check" style="color:#10b981"></i>';
    if (status === 'blocked') return '<i class="fa-solid fa-circle-xmark" style="color:#ef4444"></i>';
    return '<i class="fa-regular fa-square" style="color:#64748b"></i>';
  }

  function renderChecklists() {
    const container = document.getElementById('d-checklists-container');
    container.innerHTML = '';

    const total    = currentTaskChecklists.length;
    const done     = currentTaskChecklists.filter(c => c.status === 'done').length;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

    document.getElementById('cl-progress-text').textContent = done + ' de ' + total + ' etapas concluídas';
    document.getElementById('cl-progress-pct').textContent  = pct + '%';
    document.getElementById('cl-progress-bar').style.width  = pct + '%';

    if (total === 0) {
      container.innerHTML = '<div class="no-items">Nenhuma etapa criada. Use o campo abaixo para adicionar.</div>';
      return;
    }

    currentTaskChecklists.forEach(chk => {
      const isOpen  = expandedChecklists.has(chk.id);
      const isDone  = chk.status === 'done';

      let assigneeBadge = '';
      if (chk.assignee_name) assigneeBadge = '<span class="adv-checklist-badge assignee"><i class="fa-solid fa-user"></i> ' + esc(chk.assignee_name) + '</span>';

      let timeBadge = '';
      if (chk.time_spent > 0) timeBadge = '<span class="adv-checklist-badge time"><i class="fa-regular fa-clock"></i> ' + formatMinutes(chk.time_spent) + '</span>';

      const assigneeOpts = '<option value="">Sem responsável</option>' +
        allMembers.map(m =>
          '<option value="' + esc(m.id) + '|' + esc(m.display_name || m.username) + '"' +
          (m.id === chk.assignee_discord_id ? ' selected' : '') + '>' +
          esc(m.display_name || m.username) + '</option>'
        ).join('');

      // Comments HTML
      let commentsHtml = '<div class="no-items" style="font-size:10px;">Sem comentários.</div>';
      if (chk.comments && chk.comments.length > 0) {
        commentsHtml = chk.comments.map(c =>
          '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.04);border-radius:4px;padding:5px 8px;font-size:11px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
              '<span style="font-weight:700;color:var(--accent);font-size:10px;">' + esc(c.author_name) + '</span>' +
              '<span style="color:var(--text-dim);font-size:9px;">' + fmtRelativeTime(c.created_at) + '</span>' +
            '</div>' +
            '<div style="color:#e2e8f0;word-break:break-word;line-height:1.3;">' + esc(c.text) + '</div>' +
          '</div>'
        ).join('');
      }

      // Activity HTML
      let activityHtml = '<div class="no-items" style="font-size:10px;">Sem histórico.</div>';
      if (chk.activity && chk.activity.length > 0) {
        activityHtml = chk.activity.map(a => {
          let at = '';
          if (a.action === 'created')         at = 'Criou a etapa';
          else if (a.action === 'status_changed')    at = 'Status → <strong>' + esc(a.to_value) + '</strong>';
          else if (a.action === 'assignee_changed')  at = 'Atribuiu para <strong>' + esc(a.to_value || 'Ninguém') + '</strong>';
          else if (a.action === 'time_spent_changed') at = 'Tempo: <strong>' + formatMinutes(parseFloat(a.to_value)) + '</strong>';
          else if (a.action === 'title_changed')     at = 'Renomeou para <strong>"' + esc(a.to_value) + '"</strong>';
          else if (a.action === 'completed')         at = 'Concluiu a etapa';
          else if (a.action === 'commented')         at = 'Comentou: <em>"' + esc(a.to_value) + '"</em>';
          else at = 'Alterou ' + esc(a.action);
          const d = new Date(a.created_at + (a.created_at.endsWith('Z') ? '' : 'Z'));
          const t = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return '<div style="padding:2px 0;border-bottom:1px dashed rgba(255,255,255,0.02);font-size:10.5px;color:var(--text-muted);">• ' + at + ' <span style="font-size:8px;color:var(--text-dim);">' + t + '</span></div>';
        }).join('');
      }

      const el = document.createElement('div');
      el.className = 'adv-checklist-item' + (isOpen ? ' open' : '');
      el.id = 'adv-cl-' + chk.id;
      el.innerHTML =
        '<div class="adv-checklist-header" onclick="toggleChecklistExpand(' + chk.id + ')">' +
          '<i class="fa-solid fa-chevron-right"></i>' +
          '<span style="font-size:14px;margin-right:4px;">' + statusIcon(chk.status) + '</span>' +
          '<div class="adv-checklist-title-col">' +
            '<span class="adv-checklist-title-text' + (isDone ? ' completed' : '') + '">' + esc(chk.title) + '</span>' +
          '</div>' +
          '<div class="adv-checklist-badges">' + assigneeBadge + timeBadge + '</div>' +
          '<div class="adv-checklist-actions" onclick="event.stopPropagation();">' +
            '<button class="col-action-btn delete" onclick="deleteChecklist(' + chk.id + ')" title="Excluir"><i class="fa-solid fa-trash"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="adv-checklist-body">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Título da Etapa</label>' +
              '<input type="text" class="fc" style="font-size:12px;padding:6px 8px;" value="' + esc(chk.title) + '"' +
              ' onchange="updateChecklistItem(' + chk.id + ',{title:this.value})">' +
            '</div>' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Status</label>' +
              '<select class="fc" style="font-size:12px;padding:6px 8px;" onchange="updateChecklistItem(' + chk.id + ',{status:this.value})">' +
                '<option value="todo"' + (chk.status==='todo'?' selected':'') + '>Não iniciado</option>' +
                '<option value="doing"' + (chk.status==='doing'?' selected':'') + '>Em andamento</option>' +
                '<option value="review"' + (chk.status==='review'?' selected':'') + '>Em revisão</option>' +
                '<option value="done"' + (chk.status==='done'?' selected':'') + '>Concluído</option>' +
                '<option value="blocked"' + (chk.status==='blocked'?' selected':'') + '>Bloqueado</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Responsável</label>' +
              '<select class="fc" style="font-size:12px;padding:6px 8px;" onchange="handleClAssignee(' + chk.id + ',this.value)">' +
                assigneeOpts +
              '</select>' +
            '</div>' +
            '<div class="fg">' +
              '<label class="checklist-sub-label">Tempo gasto (min)</label>' +
              '<input type="number" class="fc" style="font-size:12px;padding:6px 8px;" min="0" value="' + (chk.time_spent||0) + '"' +
              ' onchange="updateChecklistItem(' + chk.id + ',{time_spent:parseInt(this.value,10)||0})">' +
            '</div>' +
          '</div>' +
          '<div class="fg">' +
            '<label class="checklist-sub-label">Descrição</label>' +
            '<textarea class="fc" style="font-size:12px;padding:6px 8px;min-height:48px;" placeholder="Detalhes desta etapa..."' +
            ' onchange="updateChecklistItem(' + chk.id + ',{description:this.value})">' + esc(chk.description||'') + '</textarea>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">' +
            '<div>' +
              '<div class="checklist-sub-label"><i class="fa-solid fa-comments"></i> Comentários</div>' +
              '<div id="cl-cmt-' + chk.id + '" style="max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:6px;">' +
                commentsHtml +
              '</div>' +
              '<div style="display:flex;gap:4px;">' +
                '<input type="text" id="cl-ci-' + chk.id + '" class="fc" style="font-size:11px;padding:4px 6px;flex:1;" placeholder="Comentar..."' +
                ' onkeydown="if(event.key===\'Enter\') submitClComment(' + chk.id + ')">' +
                '<button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;" onclick="submitClComment(' + chk.id + ')"><i class="fa-solid fa-paper-plane"></i></button>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<div class="checklist-sub-label"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</div>' +
              '<div id="cl-act-' + chk.id + '" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;">' +
                activityHtml +
              '</div>' +
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
      const payload = { ...fields, actor_name: currentUser?.name || 'Web', actor_discord_id: currentUser?.id || null };
      const res = await fetch('/api/checklists/' + id, {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao atualizar subtarefa');

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
        body: JSON.stringify({ text, author_name: currentUser?.name || 'Web', author_discord_id: currentUser?.id || null })
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
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    try {
      const res = await fetch('/api/tasks/' + currentTaskId + '/checklists', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ title, actor_name: currentUser?.name || 'Web', actor_discord_id: currentUser?.id || null })
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
        body: JSON.stringify({ actor_name: currentUser?.name || 'Web', actor_discord_id: currentUser?.id || null })
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      currentTaskChecklists = currentTaskChecklists.filter(c => c.id !== id);
      renderChecklists();
      renderBoard();
    } catch (e) { toast(e.message, 'error'); }
  }

`;

html = html.slice(0, clStart) + newChecklistSection + '\n  ' + CHECKLIST_SECTION_END_MARKER + html.slice(clEnd + CHECKLIST_SECTION_END_MARKER.length);
console.log('✅ Checklist section replaced.');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fix duplicate reloadDetailFields (if any)
// ─────────────────────────────────────────────────────────────────────────────
const dupPattern = "if (!res.ok) return;\n    await loadTimeline(taskId);\n  }st res = await fetch";
if (html.includes(dupPattern)) {
  const badSection = html.indexOf(dupPattern);
  // Delete the duplicate tail: find the next closing }
  const afterBad = html.indexOf('\n  }', badSection + dupPattern.length);
  html = html.slice(0, badSection + 'if (!res.ok) return;\n    await loadTimeline(taskId);\n  }'.length) + html.slice(afterBad + '\n  }'.length);
  console.log('✅ Removed duplicate reloadDetailFields tail.');
} else {
  console.log('ℹ️  No duplicate reloadDetailFields found.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update openDetailsModal — add expandedChecklists reset + tab reset
// ─────────────────────────────────────────────────────────────────────────────
// Find the exact "// Checklists" block inside openDetailsModal and augment it
const OLD_DETAILS_CL = `    // Checklists\n    currentTaskChecklists = task.checklists || [];\n    renderChecklists();`;
const NEW_DETAILS_CL = `    // Checklists\n    currentTaskChecklists = task.checklists || [];\n    expandedChecklists = new Set();\n    renderChecklists();\n\n    // Reset right tab to Timeline\n    const timelineBtn = document.getElementById('btn-tab-timeline');\n    const phaseBtn    = document.getElementById('btn-tab-phase-logs');\n    const timelineContent = document.getElementById('tab-content-timeline');\n    const phaseContent    = document.getElementById('tab-content-phase-logs');\n    timelineBtn.classList.add('active');    timelineBtn.style.color = '#fff';\n    phaseBtn.classList.remove('active');   phaseBtn.style.color = 'var(--text-muted)';\n    timelineContent.style.display = 'flex';\n    phaseContent.style.display    = 'none';`;

if (html.includes(OLD_DETAILS_CL)) {
  html = html.replace(OLD_DETAILS_CL, NEW_DETAILS_CL);
  console.log('✅ openDetailsModal updated with tab reset + expandedChecklists init.');
} else {
  console.log('⚠️  Could not find openDetailsModal checklists init block.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Save
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(filePath, html, 'utf8');
console.log('\n✅ public/index.html patched successfully!');
