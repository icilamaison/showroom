import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { pool } from "../db/pool";

export const ADMIN_TOKEN_COOKIE = "admin_token";

// 쿠키 삭제(clearCookie)는 심을 때와 동일한 옵션이어야 브라우저가 삭제를 인정한다.
// 로그인 설정과 로그아웃 삭제가 이 옵션을 공유한다.
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export type AdminTokenPayload = {
  adminId: number;
  username: string;
};

export type AuthenticatedAdmin = AdminTokenPayload;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Copy .env.example to .env and configure JWT_SECRET.",
    );
  }

  return secret;
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? "1d";
}

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<AuthenticatedAdmin | null> {
  const result = await pool.query<{
    id: number;
    username: string;
    password_hash: string;
  }>("SELECT id, username, password_hash FROM admins WHERE username = $1", [
    username,
  ]);

  if (!result.rowCount) {
    return null;
  }

  const admin = result.rows[0];
  const isValidPassword = await bcrypt.compare(password, admin.password_hash);

  if (!isValidPassword) {
    return null;
  }

  return {
    adminId: admin.id,
    username: admin.username,
  };
}

export function signAdminToken(payload: AdminTokenPayload): string {
  const options: SignOptions = {
    expiresIn: getJwtExpiresIn() as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("adminId" in decoded) ||
    !("username" in decoded)
  ) {
    throw new Error("Invalid admin token payload");
  }

  return {
    adminId: Number((decoded as AdminTokenPayload).adminId),
    username: String((decoded as AdminTokenPayload).username),
  };
}
