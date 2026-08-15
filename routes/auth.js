import { Router } from 'express';
import { AppError } from '../utils/AppError.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../lib/db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// ==========================================
// TRADITIONAL AUTHENTICATION (username/password)
// ==========================================

router.post('/api/auth/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new AppError('Username and password are required', 400);
    }

    const db = await getDb();
    
    // Check if user exists
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser) {
      throw new AppError('Username already taken', 400);
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID(); // Requires Node 19+ global crypto, or you can use a uuid lib

    const newUser = await db.one(`
      INSERT INTO users (id, username, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, role, created_at
    `, [userId, username, hashedPassword, 'user']);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ user: newUser, token });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new AppError('Username and password are required', 400);
    }

    const db = await getDb();
    const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userObj = { ...user };
    delete userObj.password;

    return res.json({ user: userObj, token });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// DISCORD BOT OAUTH2 SYNC
// ==========================================

router.post('/api/auth/discord/sync', async (req, res, next) => {
  try {
    const { discord_id, display_name, email, avatar_url, role } = req.body;
    if (!discord_id || !display_name) {
      throw new AppError('discord_id and display_name are required', 400);
    }

    // Protect this endpoint (e.g. check API key)
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();

    // Upsert discord user
    const updatedUser = await db.one(`
      INSERT INTO discord_users (id, display_name, email, avatar_url, discord_role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        avatar_url = EXCLUDED.avatar_url,
        discord_role = EXCLUDED.discord_role,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [discord_id, display_name, email, avatar_url, role || 'member']);

    return res.json(updatedUser);
  } catch (error) {
    return next(error);
  }
});

import axios from 'axios';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

router.get('/auth/discord', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;
  res.redirect(url);
});

router.get('/auth/discord/callback', async (req, res, next) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);

    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const discordUser = userResponse.data;
    
    // Convert Discord avatar hash to full CDN URL
    let avatarUrl = null;
    if (discordUser.avatar) {
      const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}`;
    }

    const db = await getDb();

    let user = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [discordUser.id]);

    if (!user) {
      user = await db.one(`
        INSERT INTO discord_users (id, display_name, email, avatar_url, discord_role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [discordUser.id, discordUser.global_name || discordUser.username, discordUser.email || null, avatarUrl, 'member']);
    } else {
      user = await db.one(`
        UPDATE discord_users SET
          display_name = $2,
          email = $3,
          avatar_url = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [discordUser.id, discordUser.global_name || discordUser.username, discordUser.email || null, avatarUrl]);
    }

    const token = jwt.sign(
      { id: user.id, username: user.display_name, role: user.discord_role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Discord Auth Error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

router.get('/auth/me', async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    
    // Try discord_users first
    let dbUser = await db.oneOrNone('SELECT * FROM discord_users WHERE id = $1', [String(decoded.id)]);
    let userObj = {};

    if (dbUser) {
      userObj = {
        id: dbUser.id,
        name: dbUser.display_name,
        username: dbUser.display_name,
        avatarUrl: dbUser.avatar_url,
        role: dbUser.discord_role
      };
    } else {
      // Try normal users
      dbUser = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [String(decoded.id)]);
      if (dbUser) {
        userObj = {
          id: dbUser.id,
          name: dbUser.username,
          username: dbUser.username,
          role: dbUser.role
        };
      } else {
        // Fallback to token decoded data
        userObj = {
          id: decoded.id,
          name: decoded.username,
          username: decoded.username,
          role: decoded.role
        };
      }
    }

    return res.json({ user: userObj, guildId: null });
  } catch (err) {
    return res.status(401).json({ error: 'Expired or invalid token' });
  }
});

export default router;
