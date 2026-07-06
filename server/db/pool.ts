import "dotenv/config";
import { Pool, type PoolConfig } from "pg";

function getPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure your database connection.",
    );
  }

  return {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
}

export const pool = new Pool(getPoolConfig());

pool.on("error", (error) => {
  console.error("[db] Unexpected PostgreSQL pool error:", error);
});

export async function verifyDatabaseConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      console.log("[db] PostgreSQL connection verified");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[db] Failed to connect to PostgreSQL:", error);
    throw error;
  }
}
