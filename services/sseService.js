/**
 * Servico para gerenciar conexoes Server-Sent Events (SSE) e enviar atualizacoes.
 * @module sseService
 */

const sseClients = new Set();

/**
 * Registra um novo cliente SSE.
 * @param {import('express').Response} res Objeto de resposta do Express
 */
export function addClient(res) {
  sseClients.add(res);
}

/**
 * Remove um cliente SSE.
 * @param {import('express').Response} res Objeto de resposta do Express
 */
export function removeClient(res) {
  sseClients.delete(res);
}

/**
 * Helper: Broadcasts SSE event.
 * @param {string|number} taskId O ID da task que sofreu alteracao
 * @param {string} action A acao que ocorreu
 */
export function broadcastBoardUpdate(taskId, action) {
  const payload = JSON.stringify({ type: 'board_update', taskId: String(taskId), action });
  console.log(`📡 SSE Broadcast: board_update (Task: ${taskId}, Action: ${action}) to ${sseClients.size} clients.`);
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}
