import "dotenv/config";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { pool } from "./pool";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY filename",
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function getMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function applyMigration(filename: string, sql: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [filename],
    );
    await client.query("COMMIT");
    console.log(`[migrate] Applied: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`[migrate] Failed: ${filename}`, error);
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = await getMigrationFiles();
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("[migrate] No pending migrations");
    return;
  }

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filePath, "utf8");
    await applyMigration(filename, sql);
  }

  console.log(`[migrate] Completed ${pending.length} migration(s)`);
}

async function main(): Promise<void> {
  try {
    await runMigrations();
  } catch (error) {
    console.error("[migrate] Migration run failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
