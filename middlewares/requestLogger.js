import logger from '../lib/logger.js';

/**
 * Middleware para logar todas as requisições HTTP recebidas pela API.
 * Ele registra o método HTTP, a URL acessada, o status code da resposta e o tempo de execução.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Intercepta quando a resposta terminar de ser enviada ao cliente
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
}
