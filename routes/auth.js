import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import 'dotenv/config';

const router = Router();

function getFrontendRedirectUrl(params = {}) {
  const fallbackCallback = `http://localhost:${process.env.PORT || 3001}/auth/discord/callback`;
  const callbackUrl = new URL(process.env.DISCORD_REDIRECT_URI || fallbackCallback);
  const frontendUrl = new URL('/', callbackUrl.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      frontendUrl.searchParams.set(key, value);
    }
  }

  return frontendUrl.toString();
}

function redirectWithAuthError(res, message) {
  return res.redirect(getFrontendRedirectUrl({ auth_error: message }));
}

router.get('/auth/discord', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return redirectWithAuthError(res, 'CLIENT_ID ou DISCORD_REDIRECT_URI nao configurado no .env da API.');
  }

  const authUrl = new URL('https://discord.com/api/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify');

  return res.redirect(authUrl.toString());
});

router.get('/auth/discord/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    const message = error_description || error;
    console.warn('Discord OAuth returned an error:', message);
    return redirectWithAuthError(res, message.toString());
  }

  if (!code) {
    return redirectWithAuthError(res, 'Codigo de autorizacao faltando no retorno do Discord.');
  }

  if (!process.env.CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
    return redirectWithAuthError(res, 'CLIENT_ID, DISCORD_CLIENT_SECRET ou DISCORD_REDIRECT_URI faltando no .env da API.');
  }

  if (!process.env.JWT_SECRET) {
    return redirectWithAuthError(res, 'JWT_SECRET faltando no .env da API.');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorMsg = await tokenResponse.text();
      console.error('Erro na troca de codigo Discord:', errorMsg);
      return redirectWithAuthError(res, 'Falha ao trocar o codigo do Discord. Confira DISCORD_CLIENT_SECRET e Redirect URI.');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      const errorMsg = await userResponse.text();
      console.error('Erro ao buscar usuario Discord:', errorMsg);
      return redirectWithAuthError(res, 'Falha ao obter dados do usuario no Discord.');
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    const username = userData.username;
    const globalName = userData.global_name || username;

    if (!process.env.DISCORD_TOKEN || !process.env.GUILD_ID) {
      return redirectWithAuthError(res, 'DISCORD_TOKEN ou GUILD_ID faltando no .env da API.');
    }

    const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`
      }
    });

    if (memberResponse.status === 404) {
      return redirectWithAuthError(res, 'Acesso negado: seu usuario Discord nao esta no servidor configurado em GUILD_ID.');
    }

    if (!memberResponse.ok) {
      const errorMsg = await memberResponse.text();
      console.error('Erro ao validar guilda Discord:', errorMsg);
      return redirectWithAuthError(res, 'Erro ao validar acesso ao servidor Discord. Confira DISCORD_TOKEN, GUILD_ID e permissoes do bot.');
    }

    const memberData = await memberResponse.json();

    let avatarUrl = '';
    if (memberData.avatar) {
      avatarUrl = `https://cdn.discordapp.com/guilds/${process.env.GUILD_ID}/users/${userId}/avatars/${memberData.avatar}.png`;
    } else if (userData.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`;
    } else {
      const defaultIndex = userData.discriminator === '0'
        ? (BigInt(userId) >> 22n) % 6n
        : parseInt(userData.discriminator, 10) % 5;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    const adminUsers = process.env.ADMIN_USERS
      ? process.env.ADMIN_USERS.split(',').map(u => u.trim().toLowerCase())
      : [];

    const isUserAdmin = adminUsers.includes(userId) || adminUsers.includes(username.toLowerCase());

    let role = 'user';
    if (isUserAdmin) {
      role = 'admin';
    } else if (process.env.PM_ROLE_ID && memberData.roles) {
      const pmRoleIds = process.env.PM_ROLE_ID.split(',').map(id => id.trim());
      const isPM = pmRoleIds.some(roleId => memberData.roles.includes(roleId));
      if (isPM) role = 'pm';
    }

    const displayName = memberData.nick || globalName;

    db.prepare(`
      INSERT INTO discord_users (id, username, display_name, avatar_url, role)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        role = excluded.role
    `).run(userId, username, displayName, avatarUrl, role);

    const payload = {
      id: userId,
      email: userData.email || `${username}@discord.com`,
      name: displayName,
      role,
      avatarUrl
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.redirect(getFrontendRedirectUrl({ token }));
  } catch (error) {
    console.error('Erro geral no callback do Discord:', error);
    return redirectWithAuthError(res, `Erro interno durante autenticacao: ${error.message}`);
  }
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);

  if (!isValid) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }

  const payload = {
    id: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6c63ff&color=fff`
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    token,
    user: payload
  });
});

router.get('/auth/me', authenticateJWT, (req, res) => {
  if (req.user.id.length > 5) {
    return res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatarUrl: req.user.avatarUrl
      }
    });
  }

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario nao encontrado.' });
  }

  return res.json({
    user: {
      ...user,
      id: String(user.id),
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6c63ff&color=fff`
    }
  });
});

export default router;
