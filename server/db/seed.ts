import "dotenv/config";
import bcrypt from "bcrypt";
import { AUDIT_LOG_VIEWER_USERNAME } from "../../lib/audit-access";
import { pool } from "./pool";

const BCRYPT_ROUNDS = 10;

function getSeedCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_SEED_USERNAME;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD must be set in .env",
    );
  }

  return { username, password };
}

export async function seedAdmin(): Promise<void> {
  const { username, password } = getSeedCredentials();

  const existing = await pool.query<{ id: number }>(
    "SELECT id FROM admins WHERE username = $1",
    [username],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    console.log(`[seed] Admin "${username}" already exists — skipped`);
  } else {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.query(
      "INSERT INTO admins (username, password_hash) VALUES ($1, $2)",
      [username, passwordHash],
    );

    console.log(`[seed] Admin "${username}" created`);
  }

  // 감사 로그 전용 개발자 계정. 비밀번호는 당분간 a 고정.
  await upsertAuditViewerAdmin();
}

async function upsertAuditViewerAdmin(): Promise<void> {
  const password = process.env.AUDIT_VIEWER_PASSWORD ?? "a";
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await pool.query<{ id: number }>(
    "SELECT id FROM admins WHERE username = $1",
    [AUDIT_LOG_VIEWER_USERNAME],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    await pool.query(
      "UPDATE admins SET password_hash = $1, name = COALESCE(name, $2) WHERE username = $3",
      [passwordHash, "개발자", AUDIT_LOG_VIEWER_USERNAME],
    );
    console.log(
      `[seed] Audit viewer "${AUDIT_LOG_VIEWER_USERNAME}" password refreshed`,
    );
    return;
  }

  await pool.query(
    "INSERT INTO admins (username, password_hash, name) VALUES ($1, $2, $3)",
    [AUDIT_LOG_VIEWER_USERNAME, passwordHash, "개발자"],
  );
  console.log(`[seed] Audit viewer "${AUDIT_LOG_VIEWER_USERNAME}" created`);
}

async function main(): Promise<void> {
  try {
    await seedAdmin();
  } catch (error) {
    console.error("[seed] Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
