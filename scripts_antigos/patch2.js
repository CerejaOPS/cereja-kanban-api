// patch2.js - Targeted patch for public/index.html
// Run with: node patch2.js
import fs from 'fs';

const filePath = 'public/index.html';
let html = fs.readFileSync(filePath, 'utf8');
const originalLen = html.length;

// Helper to safely replace a unique substring
function safeReplace(oldStr, newStr, label) {
  const count = html.split(oldStr).length - 1;
  if (count === 0) {
    console.error(`❌ [${label}] Pattern NOT found!`);
    return false;
  }
  if (count > 1) {
    console.warn(`⚠️  [${label}] Pattern found ${count} times — replacing first only`);
    html = html.replace(oldStr, newStr);
  } else {
    html = html.replace(oldStr, newStr);
  }
  console.log(`✅ [${label}] Replaced successfully.`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH A — Fix broken reloadDetailFields (has duplicated tail)
// ─────────────────────────────────────────────────────────────────────────────
const brokenReload = `    if (!res.ok) return;\n    await loadTimeline(taskId);\n  }st res = await fetch(\`/api/tasks/\${taskId}\`);\n    if (!res.ok) return;\n    await loadTimeline(taskId);\n  }`;
const fixedReload  = `    if (!res.ok) return;\n    await loadTimeline(taskId);\n  }`;
safeReplace(brokenReload, fixedReload, 'Fix broken reloadDetailFields');

// ─────────────────────────────────────────────────────────────────────────────
// PATCH B — Replace OLD checklists section with NEW advanced version
//           (everything from "// CHECKLISTS" to "// Close buttons trigger auto-save")
// ─────────────────────────────────────────────────────────────────────────────
const OLD_CL_SECTION_START = `  // ============================================================\n  // CHECKLISTS\n  // ============================================================\n  let currentTaskChecklists = [];`;
const OLD_CL_SECTION_END   = `  // Close buttons trigger auto-save`;

const idxStart = html.indexOf(OLD_CL_SECTION_START);
const idxEnd   = html.indexOf(OLD_CL_SECTION_END);

if (idxStart === -1 || idxEnd === -1 || idxStart >= idxEnd) {
  console.error(`❌ [Checklists section] Cannot locate section. Start=${idxStart} End=${idxEnd}`);
  process.exit(1);
}

const newSection = `  // ============================================================
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
    if (!mins || mins <= 0) return '0min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
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
          else if (t === 'moved')          text = 'Moveu de <strong>' + esc(det.from_phase || '') + '</strong> para <strong>' + esc(det.to_phase || '') + '</strong>';
          else if (t === 'assigned')       text = 'Atribuiu para <strong>' + esc(det.to_phase || det.to_value || '') + '</strong>';
          else if (t === 'unassigned')     text = 'Removeu atribuição de <strong>' + esc(det.from_phase || det.from_value || '') + '</strong>';
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
              '<label class="checklist-sub-label">Tempo gasto (min)</label>' +
              '<input type="number" class="fc" style="font-size:12px;padding:5px 8px;" min="0" value="' + (chk.time_spent||0) + '"' +
              ' onchange="updateChecklistItem(' + chk.id + ',{time_spent:parseInt(this.value,10)||0})">' +
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
                '<input type="text" id="cl-ci-' + chk.id + '" class="fc" style="font-size:11px;padding:3px 6px;flex:1;" placeholder="Comentar..." onkeydown="if(event.key===\'Enter\') submitClComment(' + chk.id + ')">' +
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

`;

html = html.slice(0, idxStart) + newSection + '\n  ' + OLD_CL_SECTION_END + html.slice(idxEnd + OLD_CL_SECTION_END.length);
console.log('✅ [Checklists section] Full advanced section injected.');

// ─────────────────────────────────────────────────────────────────────────────
// PATCH C — Update openDetailsModal to reset expandedChecklists + tabs
// ─────────────────────────────────────────────────────────────────────────────
const OLD_DETMODAL_CL =
`    // Checklists
    currentTaskChecklists = task.checklists || [];
    expandedChecklists = new Set();
    renderChecklists();

    // Reset right tab to Timeline
    const timelineBtn = document.getElementById('btn-tab-timeline');
    const phaseBtn    = document.getElementById('btn-tab-phase-logs');
    const timelineContent = document.getElementById('tab-content-timeline');
    const phaseContent    = document.getElementById('tab-content-phase-logs');
    timelineBtn.classList.add('active');    timelineBtn.style.color = '#fff';
    phaseBtn.classList.remove('active');   phaseBtn.style.color = 'var(--text-muted)';
    timelineContent.style.display = 'flex';
    phaseContent.style.display    = 'none';`;

const OLD_DETMODAL_CL_SIMPLE =
`    // Checklists
    currentTaskChecklists = task.checklists || [];
    expandedChecklists = new Set();
    renderChecklists();`;

const NEW_DETMODAL_CL =
`    // Checklists
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
    }`;

if (html.includes(OLD_DETMODAL_CL)) {
  safeReplace(OLD_DETMODAL_CL, NEW_DETMODAL_CL, 'openDetailsModal — tab reset (already full)');
} else if (html.includes(OLD_DETMODAL_CL_SIMPLE)) {
  safeReplace(OLD_DETMODAL_CL_SIMPLE, NEW_DETMODAL_CL, 'openDetailsModal — tab reset');
} else {
  // Find just the minimal anchor and do a safe injection
  const anchor = '    currentTaskChecklists = task.checklists || [];\n    renderChecklists();';
  const replacement = '    currentTaskChecklists = task.checklists || [];\n    expandedChecklists = new Set();\n    renderChecklists();\n\n    // Reset right tab to Timeline\n    { const tbtn = document.getElementById(\'btn-tab-timeline\'); const pbtn = document.getElementById(\'btn-tab-phase-logs\'); const tcnt = document.getElementById(\'tab-content-timeline\'); const pcnt = document.getElementById(\'tab-content-phase-logs\'); if (tbtn) { tbtn.classList.add(\'active\'); tbtn.style.color=\'#fff\'; } if (pbtn) { pbtn.classList.remove(\'active\'); pbtn.style.color=\'var(--text-muted)\'; } if (tcnt) tcnt.style.display=\'flex\'; if (pcnt) pcnt.style.display=\'none\'; }';
  if (html.includes(anchor)) {
    safeReplace(anchor, replacement, 'openDetailsModal — tab reset (fallback)');
  } else {
    console.warn('⚠️  [openDetailsModal] Could not find checklist init block. Skipping tab reset injection.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH D — Add CSS for advanced checklist components (if not already present)
// ─────────────────────────────────────────────────────────────────────────────
if (!html.includes('.adv-checklist-item {')) {
  const CSS_ANCHOR = '  </style>';
  const lastCSSEnd = html.lastIndexOf(CSS_ANCHOR);
  if (lastCSSEnd !== -1) {
    const newCSS = `
  /* ── Advanced Checklist Items ── */
  .adv-checklist-item {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color .2s;
  }
  .adv-checklist-item:hover { border-color: rgba(99,102,241,.3); }
  .adv-checklist-header {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    gap: 4px;
    user-select: none;
  }
  .adv-checklist-header:hover { background: rgba(255,255,255,0.03); }
  .adv-checklist-body {
    display: none;
    padding: 12px;
    border-top: 1px solid rgba(255,255,255,0.05);
    flex-direction: column;
    gap: 8px;
  }
  .adv-checklist-item.open .adv-checklist-body { display: flex; }
  .adv-checklist-item.open .adv-checklist-header .fa-chevron-right { transform: rotate(90deg); }
  .adv-checklist-title-text.completed { text-decoration: line-through; color: var(--text-muted); }
  .checklist-sub-label { display:block; font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:3px; }

  /* ── Checklist Progress Bar ── */
  .cl-progress-wrap { background:rgba(255,255,255,0.05); border-radius:4px; height:4px; overflow:hidden; margin-bottom:4px; }
  .cl-progress-bar  { height:100%; background:linear-gradient(90deg,#6366f1,#8b5cf6); border-radius:4px; transition:width .4s ease; }

  /* ── User Log Accordion ── */
  .user-log-accordion {}
  .user-log-header { display:flex; align-items:center; padding:6px 0; cursor:pointer; border-bottom:1px dashed rgba(255,255,255,0.04); }
  .user-log-title  { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--text-secondary); width:100%; }
  .user-log-body   { display:none; padding:6px 12px 6px 28px; display:none; flex-direction:column; gap:3px; }
  .user-log-accordion.open .user-log-body { display:flex; }
  .user-log-accordion.open .user-log-header .fa-chevron-right { transform:rotate(90deg); }
  .user-log-avatar { width:22px; height:22px; border-radius:50%; }
  .action-entry    { display:flex; align-items:baseline; gap:6px; font-size:11.5px; color:var(--text-secondary); padding:2px 0; flex-wrap:wrap; }
  .action-dot      { color:var(--text-dim); flex-shrink:0; }
  .action-entry-time { margin-left:auto; font-size:9px; color:var(--text-dim); white-space:nowrap; }

`;
    html = html.slice(0, lastCSSEnd) + newCSS + html.slice(lastCSSEnd);
    console.log('✅ [CSS] Advanced checklist + user-log CSS injected.');
  } else {
    console.warn('⚠️  [CSS] Could not find </style> to inject CSS.');
  }
} else {
  console.log('ℹ️  [CSS] Advanced checklist CSS already present.');
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH E — Add Checklist Progress Bar HTML (if not there)
// ─────────────────────────────────────────────────────────────────────────────
if (!html.includes('cl-progress-bar')) {
  const CL_SECTION_ANCHOR = 'id="d-checklists-container"';
  const idx = html.indexOf(CL_SECTION_ANCHOR);
  if (idx !== -1) {
    const insertBefore = html.lastIndexOf('<div', idx);
    const PROGRESS_HTML =
      `<div style="margin-bottom:10px;">\n            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">\n              <span id="cl-progress-text" style="font-size:11px;color:var(--text-muted);">0 de 0 etapas concluídas</span>\n              <span id="cl-progress-pct" style="font-size:11px;font-weight:700;color:var(--accent);">0%</span>\n            </div>\n            <div class="cl-progress-wrap"><div id="cl-progress-bar" class="cl-progress-bar" style="width:0%"></div></div>\n          </div>\n          `;
    html = html.slice(0, insertBefore) + PROGRESS_HTML + html.slice(insertBefore);
    console.log('✅ [HTML] Checklist progress bar injected.');
  }
} else {
  console.log('ℹ️  [HTML] Checklist progress bar already present.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(filePath, html, 'utf8');
const newLen = html.length;
console.log(`\n✅ Done. File size: ${originalLen} → ${newLen} bytes (+${newLen - originalLen})`);
