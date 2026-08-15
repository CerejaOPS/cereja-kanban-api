import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import logger from './lib/logger.js';
import { getDb } from './lib/db.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import statsRouter from './routes/stats.js';
import boardsRouter from './routes/boards.js';
import { addClient, removeClient } from './services/sseService.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
let lastBotHeartbeat = null;

// Documentação da API com Swagger
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(requestLogger);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Server-Sent Events endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': heartbeat\n\n');

  addClient(res);
  req.on('close', () => {
    removeClient(res);
  });
});

// Routers
app.use('/', authRouter);
app.use('/', tasksRouter);
app.use('/', statsRouter);
app.use('/', boardsRouter);

// Discord bot status endpoint
app.get('/api/discord/status', async (req, res) => {
  const BOT_BASE_URL = process.env.BOT_WEBHOOK_BASE_URL || process.env.BOT_WEBHOOK_URL || 'http://localhost:3005';
  let botOnline = false;

  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(`${BOT_BASE_URL}/health`, { timeout: 3000 });
    botOnline = response.status === 200;
  } catch (e) {
    botOnline = false;
  }

  return res.json({
    botOnline,
    botUrl: BOT_BASE_URL,
    channels: {
      forum: process.env.FORUM_CHANNEL_ID || null,
      review: process.env.REVIEW_CHANNEL_ID || null,
      alerts: process.env.ALERTS_CHANNEL_ID || null,
      summary: process.env.KANBAN_SUMMARY_CHANNEL_ID || null,
      log: process.env.LOG_CHANNEL_ID || null,
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Bot Heartbeat
app.post('/api/bot/heartbeat', (req, res) => {
  lastBotHeartbeat = new Date();
  res.json({ success: true, timestamp: lastBotHeartbeat });
});

app.get('/api/bot/status', (req, res) => {
  if (!lastBotHeartbeat) {
    return res.json({ online: false, message: "Bot nunca deu sinal de vida" });
  }
  
  // Calcula a diferença em segundos entre agora e o último heartbeat
  const now = new Date();
  const diffInSeconds = (now - lastBotHeartbeat) / 1000;
  
  // Se faz menos de 60 segundos, ele tá online!
  const isOnline = diffInSeconds < 60;
  
  res.json({ 
    online: isOnline, 
    lastSeen: lastBotHeartbeat,
    secondsAgo: Math.floor(diffInSeconds)
  });
});

// Serve frontend SPA fallback Se solicitado
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento de Rota API Não Encontrada (404)
app.use('/api/*', (req, res) => {
  res.status(404).json({ status: 'error', message: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// Middleware Global de Tratamento de Erros (DEVE ser o último app.use)
app.use(errorHandler);

// Initialize database (which runs migrations automatically) then start server
getDb()
  .then(() => {
    logger.info('✅ Conectado ao banco de dados e migrações verificadas (pg-promise)');
  })
  .catch((e) => {
    logger.error('❌ Erro ao conectar no Postgres:', e);
  });

app.listen(PORT, () => {
  logger.info(`🚀 Cereja Kanban API rodando em http://localhost:${PORT}`);
});
