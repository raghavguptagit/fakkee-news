import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DEFAULT_DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'backend/data/truthlens.db');

export function createDbConnection(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  initializeSchema(db);
  return db;
}

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alembic_version (
      version_num VARCHAR(32) NOT NULL PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      hashed_password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      input_type TEXT NOT NULL CHECK (input_type IN ('text', 'url', 'file', 'headline', 'demo')),
      original_url TEXT,
      title TEXT,
      input_text TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'processing', 'completed', 'partial', 'failed', 'cancelled')),
      assessment_label TEXT NOT NULL,
      model_score REAL,
      model_confidence_label TEXT,
      model_version TEXT,
      gemini_status TEXT NOT NULL DEFAULT 'unavailable',
      evidence_status TEXT NOT NULL DEFAULT 'unavailable',
      summary TEXT,
      report_json TEXT NOT NULL,
      processing_ms INTEGER DEFAULT 0,
      error_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL,
      claim_text TEXT NOT NULL,
      claim_type TEXT NOT NULL DEFAULT 'other',
      checkability TEXT NOT NULL DEFAULT 'checkable',
      status TEXT NOT NULL DEFAULT 'unverified',
      confidence REAL,
      explanation TEXT,
      search_query TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      claim_id TEXT,
      analysis_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_title TEXT NOT NULL,
      publisher TEXT NOT NULL,
      published_at TEXT,
      retrieved_at TEXT NOT NULL DEFAULT (datetime('now')),
      snippet TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'context',
      provider TEXT NOT NULL DEFAULT 'none',
      relevance_score REAL,
      metadata TEXT DEFAULT '{}',
      dedupe_hash TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      analysis_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, analysis_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      analysis_id TEXT,
      category TEXT NOT NULL,
      feedback_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS model_versions (
      id TEXT PRIMARY KEY,
      model_name TEXT NOT NULL,
      version TEXT NOT NULL UNIQUE,
      dataset_metadata TEXT NOT NULL DEFAULT '{}',
      metrics TEXT NOT NULL DEFAULT '{}',
      artifact_location TEXT NOT NULL,
      artifact_hash TEXT NOT NULL,
      trained_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
    CREATE INDEX IF NOT EXISTS idx_analyses_content_hash ON analyses(content_hash);
    CREATE INDEX IF NOT EXISTS idx_claims_analysis_id ON claims(analysis_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_analysis_id ON evidence_items(analysis_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_dedupe_hash ON evidence_items(dedupe_hash);
    CREATE INDEX IF NOT EXISTS idx_saved_analyses_user ON saved_analyses(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id, created_at DESC);
  `);

  const row = db.prepare('SELECT version_num FROM alembic_version LIMIT 1').get();
  if (!row) {
    db.prepare('INSERT INTO alembic_version (version_num) VALUES (?)').run('0001_initial_sqlite_schema');
  }
}

export async function backupDatabase(db: Database.Database, backupPath: string): Promise<string> {
  const dir = path.dirname(backupPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await db.backup(backupPath);
  return backupPath;
}

export function restoreDatabase(backupPath: string, targetPath: string = DEFAULT_DB_PATH): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(backupPath, targetPath);
}

let _db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (!_db) {
    _db = createDbConnection(DEFAULT_DB_PATH);
  }
  return _db;
}
