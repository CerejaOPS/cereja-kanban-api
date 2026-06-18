import { db } from './database.js';
import bcrypt from 'bcryptjs';

const email = 'admin@cherdeal.com';
const passwordHash = bcrypt.hashSync('Admin@2026', 10);
const name = 'Admin Cherdeal';

try {
  db.prepare('INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, passwordHash, name, 'admin');
  console.log('Admin user created/verified successfully!');
} catch (e) {
  console.error('Error creating admin user:', e);
}
