window.currentBoardId = 'all';
window.myTasksMode = false;

async function loadBoards() {
  const grid = document.getElementById('boards-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="no-items">Carregando quadros...</div>';

  try {
    const res = await fetch('/api/boards', {
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!res.ok) throw new Error('Erro ao carregar boards');
    const boards = await res.json();
    
    // Add "Visão Geral" block
    grid.innerHTML = `
      <div class="board-card" onclick="openBoard('all', 'Visão Geral', '#6366f1', 'visao-geral')" style="--board-color: #6366f1">
        <div class="board-card-content">
          <div class="board-icon">🌐</div>
          <div>
            <div class="board-title">Visão Geral</div>
            <div class="board-meta">Todas as tarefas de todos os quadros</div>
          </div>
        </div>
        <div class="board-card-actions">
          <i class="fa-solid fa-arrow-right board-card-action-icon"></i>
        </div>
      </div>
    `;

    // Populate actual boards
    boards.forEach(b => {
      const color = b.color || '#6C63FF';
      grid.innerHTML += `
        <div class="board-card" onclick="openBoard('${b.id}', '${b.name}', '${color}', '${b.slug}')" style="--board-color: ${color}">
          <div class="board-card-content">
            <div class="board-icon">${b.icon || '📋'}</div>
            <div>
              <div class="board-title">${b.name.toUpperCase()}</div>
            </div>
          </div>
          <div class="board-card-actions">
            <i class="fa-solid fa-gear board-card-action-icon" style="opacity: 0.8;" onclick="event.stopPropagation(); openEditBoardModal('${b.id}', '${esc(b.name)}', '${color}', '${b.icon}')" title="Configurações do Quadro"></i>
            <i class="fa-solid fa-arrow-right board-card-action-icon"></i>
          </div>
        </div>
      `;
    });
    
    // Populate the select in Create Task modal
    const ctBoard = document.getElementById('ct-board');
    if (ctBoard) {
      ctBoard.innerHTML = '';
      boards.forEach(b => {
        ctBoard.innerHTML += `<option value="${b.id}">${b.name}</option>`;
      });
    }

  } catch (err) {
    grid.innerHTML = `<div class="no-items" style="color:red">Falha ao carregar quadros.</div>`;
    console.error(err);
  }
}

function openBoard(id, name, color, slug, pushState = true) {
  window.myTasksMode = false;
  window.currentBoardId = id;
  document.getElementById('view-hub').style.display = 'none';
  document.getElementById('view-kanban').style.display = 'block';
  document.getElementById('btn-back-hub').style.display = 'inline-flex';
  
  // Set title to include board name
  document.getElementById('app-logo-name').innerText = name;
  document.documentElement.style.setProperty('--accent', color);

  if (pushState) {
    history.pushState({ boardId: id, name, color, slug }, '', '/kanban/' + slug);
  }

  if (typeof renderBoard === 'function') {
    renderBoard();
  }
}

function openHub(pushState = true) {
  window.myTasksMode = false;
  window.currentBoardId = 'all';
  document.getElementById('view-hub').style.display = 'block';
  document.getElementById('view-kanban').style.display = 'none';
  document.getElementById('btn-back-hub').style.display = 'none';
  
  document.getElementById('app-logo-name').innerText = 'Cereja Kanban';
  document.documentElement.style.setProperty('--accent', '#6366f1'); // Reset to default

  if (pushState) {
    history.pushState({ hub: true }, '', '/kanban/hub');
  }

  loadBoards();
}

function openMyTasks(pushState = true) {
  window.myTasksMode = true;
  window.currentBoardId = 'all';
  
  document.getElementById('view-hub').style.display = 'none';
  document.getElementById('view-kanban').style.display = 'block';
  document.getElementById('btn-back-hub').style.display = 'inline-flex';
  
  document.getElementById('app-logo-name').innerHTML = '<i class="fa-solid fa-user-check" style="margin-right: 6px;"></i> Minhas Tasks';
  document.documentElement.style.setProperty('--accent', '#6C63FF');

  if (pushState) {
    history.pushState({ myTasks: true }, '', '/minhas-tasks');
  }

  if (typeof renderBoard === 'function') {
    renderBoard();
  }
}

function openCreateBoardModal() {
  document.getElementById('modal-create-board').style.display = 'flex';
}

document.getElementById('create-board-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('board-name').value;
  const color = document.getElementById('board-color').value;
  const icon = document.getElementById('board-icon').value;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerText = 'Criando...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, icon })
    });
    if (!res.ok) throw new Error('Erro ao criar quadro');
    
    if (typeof closeModal === 'function') closeModal('modal-create-board');
    e.target.reset();
    loadBoards();
    if (typeof toast === 'function') toast('Quadro criado!', 'success');
  } catch (err) {
    if (typeof toast === 'function') toast(err.message, 'error');
  } finally {
    btn.innerText = 'Criar Quadro';
    btn.disabled = false;
  }
});

window.openEditBoardModal = function(id, name, color, icon) {
  document.getElementById('edit-board-id').value = id;
  document.getElementById('edit-board-name').value = name;
  document.getElementById('edit-board-color').value = color || '#6C63FF';
  
  let finalIcon = icon;
  if (icon === 'null' || icon === 'undefined' || !icon) finalIcon = '';
  document.getElementById('edit-board-icon').value = finalIcon;
  
  const modal = document.getElementById('modal-edit-board');
  if (modal) {
    modal.classList.add('active');
  } else {
    console.error('Modal modal-edit-board não encontrado!');
    if (typeof toast === 'function') toast('Erro ao abrir configurações.', 'error');
  }
};

document.getElementById('edit-board-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-board-id').value;
  const name = document.getElementById('edit-board-name').value;
  const color = document.getElementById('edit-board-color').value;
  const icon = document.getElementById('edit-board-icon').value;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerText = 'Salvando...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/boards/${id}`, {
      method: 'PUT',
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, icon })
    });
    if (!res.ok) throw new Error('Erro ao atualizar quadro');
    
    if (typeof closeModal === 'function') closeModal('modal-edit-board');
    loadBoards();
    if (typeof toast === 'function') toast('Quadro atualizado!', 'success');
  } catch (err) {
    if (typeof toast === 'function') toast(err.message, 'error');
  } finally {
    btn.innerText = 'Salvar';
    btn.disabled = false;
  }
});

function deleteBoard() {
  const id = document.getElementById('edit-board-id').value;
  
  if (typeof openConfirmModal === 'function') {
    openConfirmModal('Excluir Quadro', 'Tem certeza que deseja excluir este quadro? Todas as suas configurações de fase serão perdidas. (É necessário excluir/mover as tasks antes)', 'Excluir Quadro', async () => {
      await executeDeleteBoard(id);
    });
  } else {
    if (confirm('Tem certeza que deseja excluir este quadro?')) {
      executeDeleteBoard(id);
    }
  }
}

async function executeDeleteBoard(id) {
  try {
    const res = await fetch(`/api/boards/${id}`, {
      method: 'DELETE',
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir quadro');
    }
    
    if (typeof closeModal === 'function') closeModal('modal-edit-board');
    loadBoards();
    if (typeof toast === 'function') toast('Quadro excluído!', 'success');
  } catch (err) {
    if (typeof toast === 'function') toast(err.message, 'error');
  }
}

// History API popstate handling for back button
window.addEventListener('popstate', (e) => {
  if (e.state) {
    if (e.state.myTasks) {
      openMyTasks(false);
    } else if (e.state.boardId) {
      openBoard(e.state.boardId, e.state.name, e.state.color, e.state.slug, false);
    } else {
      openHub(false);
    }
  } else {
    handlePathRouting(false);
  }
});

async function handlePathRouting(pushState = true) {
  const path = window.location.pathname;
  
  if (path === '/minhas-tasks') {
    openMyTasks(pushState);
  } else if (path.startsWith('/kanban/')) {
    const slug = path.split('/kanban/')[1];
    
    if (slug === 'hub' || slug === '') {
      openHub(pushState);
      return;
    }
    
    if (slug === 'visao-geral') {
      openBoard('all', 'Visão Geral', '#6366f1', 'visao-geral', pushState);
      return;
    }
    
    // We need to fetch boards to find the ID and info from the slug
    try {
      const res = await fetch('/api/boards', {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      if (res.ok) {
        const boards = await res.json();
        const board = boards.find(b => b.slug === slug);
        if (board) {
          openBoard(board.id, board.name, board.color || '#6C63FF', board.slug, pushState);
        } else {
          openHub(pushState);
        }
      } else {
        openHub(pushState);
      }
    } catch (err) {
      openHub(pushState);
    }
  } else {
    // Default to hub for /hub or unknown paths
    openHub(pushState);
  }
}

// Load boards on init if not already loaded by main.js
document.addEventListener('DOMContentLoaded', () => {
  // Check path on load
  handlePathRouting(false);
});
