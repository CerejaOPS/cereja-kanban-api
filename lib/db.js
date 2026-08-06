import pgPromise from 'pg-promise';
import { runner as runMigrations } from 'node-pg-migrate';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pgp = pgPromise();

export class PostgresConnection {
  constructor(opts, systemLogger = logger) {
    this.opts = opts;
    this.logger = systemLogger;
    this.instance = null;
    this.listenerConfigured = false;
  }

  async getConnection() {
    if (this.opts.dbMock) {
      return this.opts.dbMock;
    }

    if (this.instance) {
      try {
        const db = await this.instance;
        await db.one('SELECT 1 as health_check');
        this.opts.onConnect?.();
        return db;
      } catch (error) {
        this.logger.warn?.(`[postgres] Connection health check failed, reconnecting: ${error.message}`);
        this.instance = null;
        this.listenerConfigured = false;
      }
    }

    this.instance = this.connectTo(
      this.opts.dbAddress,
      this.opts.migrationsTable || 'pgmigrations',
      this.opts.migrationsDir || path.join(__dirname, '../migrations'),
      this.opts.ignoreMigrations
    );

    try {
      const db = await this.instance;
      this.logger.info?.(`[postgres] Connected successfully`);

      if (this.opts.onPgsqlChanges && !this.listenerConfigured) {
        db.$pool.connect().then(client => {
          client.query('LISTEN pgsql_changes');
          client.on('notification', msg => this.opts.onPgsqlChanges(msg));
          this.listenerConfigured = true;
          client.release();
        });
      }

      this.opts.onConnect?.();
      return db;
    } catch (error) {
      this.instance = null;
      this.logger.error?.(`[postgres] Failed to connect: ${error.message}`);
      throw error;
    }
  }

  async connectTo(dbAddress, migrationsTable, migrationsDir, ignoreMigrations = false) {
    if (!ignoreMigrations) {
      await this.runMigrations(dbAddress, migrationsTable, migrationsDir);
    }
    return pgp(dbAddress);
  }

  async runMigrations(databaseUrl, migrationsTable, dir) {
    try {
      const migrationsResponse = await runMigrations({
        databaseUrl,
        migrationsTable,
        dir,
        direction: 'up',
        log: (msg) => this.logger.info?.(`[postgres-migrate] ${msg}`)
      });
      
      if (migrationsResponse.length > 0) {
        this.logger.info?.(`[postgres] Ran ${migrationsResponse.length} migrations`);
        for (const migration of migrationsResponse) {
          this.logger.info?.(` - ${migration.name}`);
        }
      } else {
        this.logger.info?.('[postgres] No migrations to run!');
      }
    } catch (error) {
      this.logger.error?.(`[postgres] Failed to run migrations: ${error.message}`);
      throw error;
    }
  }
}

// Global instance
export const dbConnection = new PostgresConnection({
  dbAddress: process.env.DATABASE_URL,
});

// Helper wrapper to easily get the DB instance anywhere without awaiting the connection setup repeatedly
// Usage: const db = await getDb();
export const getDb = () => dbConnection.getConnection();
