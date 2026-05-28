import jwt from 'jsonwebtoken';
import 'dotenv/config';

/**
 * Middleware: validates Bearer JWT token in Authorization header.
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or malformed.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware: validates x-api-key header against API_KEY env variable.
 */
export function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header.' });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key.' });
  }

  next();
}

/**
 * Middleware: Allows access if a valid API Key is provided OR a valid JWT token.
 * Used for routes that both the Frontend Web App and the Discord Bot call.
 */
export function requireAuthOrApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.API_KEY) {
    req.isBot = true;
    req.user = { role: 'admin', name: 'Bot' }; // Bots have admin powers
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  }

  return res.status(401).json({ error: 'Missing or invalid authentication.' });
}
