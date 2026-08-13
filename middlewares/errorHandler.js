import logger from '../lib/logger.js';
import { AppError } from '../utils/AppError.js';

/**
 * Middleware Global de Tratamento de Erros.
 * Deve ser o ÚLTIMO middleware registrado no `server.js`.
 * 
 * Ele captura qualquer erro que ocorre durante o fluxo da requisição.
 */
export function errorHandler(err, req, res, next) {
  // Se for um erro operacional que já conhecemos (lançado com new AppError)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // Se for um erro inesperado (ex: banco de dados, sintaxe, null pointer)
  // 1. Logamos o erro completo para os desenvolvedores investigarem
  logger.error(`[UNHANDLED ERROR] ${err.name}: ${err.message}\nStack: ${err.stack}`);

  // 2. Retornamos uma mensagem genérica para o frontend (nunca expor detalhes de infra)
  return res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor. Nossa equipe já foi notificada.'
  });
}
