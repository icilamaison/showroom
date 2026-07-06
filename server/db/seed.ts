import "dotenv/config";
import bcrypt from "bcrypt";
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
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await pool.query(
    "INSERT INTO admins (username, password_hash) VALUES ($1, $2)",
    [username, passwordHash],
  );

  console.log(`[seed] Admin "${username}" created`);
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
