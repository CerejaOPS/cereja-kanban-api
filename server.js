import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { initDatabase } from './database.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import statsRouter from './routes/stats.js';
import boardsRouter from './routes/boards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routers
app.use('/', authRouter);
app.use('/', tasksRouter);
app.use('/', statsRouter);
app.use('/', boardsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend SPA fallback if requested (optional but good practice)
app.get('*', (req, res, next) => {
  // If it's an API request, skip to error/404 handling
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database then start server
initDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Cereja Kanban API rodando em http://localhost:${PORT}`);
});
