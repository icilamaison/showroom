/**
 * 카페24 OAuth 토큰 (skin31 tools/.cafe24-tokens.json 과 같은 방식).
 *
 * refresh_token은 쓸 때마다 새 값으로 바뀌고, 이전 값은 즉시 무효다.
 * 그래서 로컬·CI가 같은 앱을 쓰면 갱신 후 반드시 한곳(Secrets)에 다시 저장해야 한다.
 *
 *   npx tsx scripts/cafe24-auth.ts auth
 *   npx tsx scripts/cafe24-auth.ts init CODE
 *   npx tsx scripts/cafe24-auth.ts status
 *   npx tsx scripts/cafe24-auth.ts push-secret
 *   npx tsx scripts/cafe24-auth.ts import /path/to/.cafe24-tokens.json
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
export const ENV_PATH = path.join(ROOT, ".env.local");
export const TOKEN_PATH = path.join(ROOT, ".cafe24-tokens.json");

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 45_000;

export type Cafe24Tokens = {
  access_token: string;
  expires_at?: string;
  refresh_token: string;
  refresh_token_expires_at?: string;
  client_id?: string;
  mall_id?: string;
  user_id?: string;
  scopes?: string[];
  issued_at?: string;
  shop_no?: string;
  token_type?: string;
};

export type Cafe24Config = {
  mallId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  tokenUrl: string;
  basic: string;
};

type EnvMap = Map<string, string>;

function readEnvFile(): EnvMap {
  const map = new Map<string, string>();
  if (!existsSync(ENV_PATH)) return map;

  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    map.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }
  return map;
}

function updateEnvValue(key: string, value: string): void {
  const original = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(original)
    ? original.replace(pattern, `${key}=${value}`)
    : `${original}${original.endsWith("\n") || !original ? "" : "\n"}${key}=${value}\n`;
  writeFileSync(ENV_PATH, next, "utf8");
}

function envGet(env: EnvMap, key: string): string | undefined {
  return process.env[key] ?? env.get(key);
}

function requireEnv(env: EnvMap, key: string): string {
  const value = envGet(env, key);
  if (!value) {
    throw new Error(`${key}가 없습니다. .env.local에 추가해주세요. (${ENV_PATH})`);
  }
  return value;
}

export function loadCafe24Config(): Cafe24Config {
  const env = readEnvFile();
  const mallId = envGet(env, "CAFE24_MALL_ID") ?? "icilamaison";
  const clientId = requireEnv(env, "CAFE24_CLIENT_ID");
  const clientSecret = requireEnv(env, "CAFE24_CLIENT_SECRET");
  const redirectUri =
    envGet(env, "CAFE24_REDIRECT_URI") ?? "https://localhost/callback";

  return {
    mallId,
    clientId,
    clientSecret,
    redirectUri,
    scope:
      envGet(env, "CAFE24_SCOPE") ??
      "mall.read_product,mall.read_category,mall.read_promotion",
    tokenUrl: `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
    basic: Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
  };
}

function parseExpiry(value: string | undefined): number {
  if (!value) return 0;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return Date.parse(hasZone ? value : `${value}+09:00`) || 0;
}

export function readTokens(): Cafe24Tokens | null {
  if (!existsSync(TOKEN_PATH)) return null;
  return JSON.parse(readFileSync(TOKEN_PATH, "utf8")) as Cafe24Tokens;
}

export function saveTokens(tokens: Cafe24Tokens): void {
  writeFileSync(TOKEN_PATH, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
  updateEnvValue("CAFE24_REFRESH_TOKEN", tokens.refresh_token);
}

/** CI/.env만 있을 때: refresh_token으로 최소 토큰 객체를 만든다. */
function bootstrapTokensFromEnv(): Cafe24Tokens | null {
  const env = readEnvFile();
  const refresh = envGet(env, "CAFE24_REFRESH_TOKEN");
  if (!refresh) return null;
  return {
    access_token: "",
    refresh_token: refresh,
    expires_at: "1970-01-01T00:00:00.000Z",
  };
}

async function requestToken(payload: string): Promise<Cafe24Tokens> {
  const { tokenUrl, basic } = loadCafe24Config();
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `토큰 갱신 실패 (${response.status}). refresh_token이 만료됐거나 다른 곳에서 이미 갱신됐을 수 있습니다.\n` +
        `로컬 skin31 등과 같은 앱을 쓰면 npx tsx scripts/cafe24-auth.ts import <토큰파일> 후 push-secret 하세요.\n${text}`,
    );
  }
  const tokens = JSON.parse(text) as Cafe24Tokens;
  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(): Promise<Cafe24Tokens> {
  const tokens = readTokens() ?? bootstrapTokensFromEnv();
  if (!tokens?.refresh_token) {
    throw new Error(
      "토큰이 없습니다. npx tsx scripts/cafe24-auth.ts auth 부터 실행하세요.",
    );
  }

  const refreshExpiry = parseExpiry(tokens.refresh_token_expires_at);
  if (refreshExpiry > 0 && refreshExpiry <= Date.now()) {
    throw new Error(
      "refresh 토큰이 만료됐습니다. npx tsx scripts/cafe24-auth.ts auth 부터 다시 진행하세요.",
    );
  }

  const next = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }).toString(),
  );

  console.log(
    `[token] 갱신 완료 (access ${next.expires_at ?? "미표기"} / refresh ${next.refresh_token_expires_at ?? "미표기"})`,
  );
  console.log(`[token] 저장: ${path.relative(ROOT, TOKEN_PATH)} + .env.local`);

  const push = await pushRefreshSecret({ quiet: false });
  if (push === "ok") {
    console.log("[token] GitHub Secret CAFE24_REFRESH_TOKEN 동기화 완료");
  } else if (push === "skip") {
    console.log(
      "[token] Secret 자동 동기화 스킵 (CAFE24_SYNC_PAT/GH_TOKEN 없음 또는 CAFE24_SKIP_SECRET_PUSH=1)",
    );
  }

  return next;
}

export async function getAccessToken(): Promise<string> {
  const existing = readTokens() ?? bootstrapTokensFromEnv();
  if (!existing?.refresh_token) {
    throw new Error(
      "토큰이 없습니다. npx tsx scripts/cafe24-auth.ts auth 부터 실행하세요.",
    );
  }

  if (
    existing.access_token &&
    parseExpiry(existing.expires_at) - REFRESH_MARGIN_MS > Date.now()
  ) {
    return existing.access_token;
  }

  return (await refreshAccessToken()).access_token;
}

export function authUrl(): string {
  const { mallId, clientId, redirectUri, scope } = loadCafe24Config();
  return `https://${mallId}.cafe24api.com/api/v2/oauth/authorize?${new URLSearchParams(
    {
      response_type: "code",
      client_id: clientId,
      state: "play-auto",
      redirect_uri: redirectUri,
      scope,
    },
  )}`;
}

export async function initFromCode(code: string): Promise<Cafe24Tokens> {
  const { redirectUri } = loadCafe24Config();
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  );
  console.log(
    `토큰 저장 완료: access ${tokens.expires_at ?? "?"} / refresh ${tokens.refresh_token_expires_at ?? "?"}`,
  );
  await pushRefreshSecret({ quiet: false });
  return tokens;
}

export function importTokensFromFile(filePath: string): Cafe24Tokens {
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) {
    throw new Error(`파일이 없습니다: ${absolute}`);
  }
  const tokens = JSON.parse(readFileSync(absolute, "utf8")) as Cafe24Tokens;
  if (!tokens.refresh_token) {
    throw new Error("파일에 refresh_token이 없습니다.");
  }
  saveTokens(tokens);
  console.log(
    `가져옴 → ${path.relative(ROOT, TOKEN_PATH)} (refresh 만료: ${tokens.refresh_token_expires_at ?? "미표기"})`,
  );
  return tokens;
}

export type TokenStatus = {
  hasTokenFile: boolean;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  accessValid: boolean;
  refreshValid: boolean;
};

export function getTokenStatus(): TokenStatus {
  const tokens = readTokens() ?? bootstrapTokensFromEnv();
  const accessExpiresAt = tokens?.expires_at ?? null;
  const refreshExpiresAt = tokens?.refresh_token_expires_at ?? null;
  return {
    hasTokenFile: existsSync(TOKEN_PATH),
    accessExpiresAt,
    refreshExpiresAt,
    accessValid: parseExpiry(accessExpiresAt ?? undefined) > Date.now(),
    refreshValid:
      !refreshExpiresAt || parseExpiry(refreshExpiresAt) > Date.now(),
  };
}

export function printTokenStatus(): void {
  const status = getTokenStatus();
  console.log(`[token] file: ${status.hasTokenFile ? TOKEN_PATH : "(없음, .env.local fallback)"}`);
  console.log(
    `[token] access  만료: ${status.accessExpiresAt ?? "?"} ${status.accessValid ? "(유효)" : "(만료/없음 → 갱신 예정)"}`,
  );
  console.log(
    `[token] refresh 만료: ${status.refreshExpiresAt ?? "?"} ${status.refreshValid ? "(유효)" : "(만료 → auth 필요)"}`,
  );
}

/**
 * 현재 refresh_token을 repo Secret에 올린다.
 * CI Persist 스텝과 로컬 갱신 후 동기화에 쓴다. 토큰 값은 로그에 찍지 않는다.
 */
export async function pushRefreshSecret(options?: {
  quiet?: boolean;
}): Promise<"ok" | "skip" | "fail"> {
  if (process.env.CAFE24_SKIP_SECRET_PUSH === "1") return "skip";

  const tokens = readTokens() ?? bootstrapTokensFromEnv();
  const refresh = tokens?.refresh_token;
  if (!refresh) return "skip";

  // GITHUB_TOKEN(기본 Actions 토큰)은 secrets:write가 없다. PAT만 쓴다.
  const pat = process.env.CAFE24_SYNC_PAT || process.env.GH_TOKEN;
  if (!pat) return "skip";

  try {
    execFileSync("gh", ["secret", "set", "CAFE24_REFRESH_TOKEN"], {
      input: refresh,
      env: { ...process.env, GH_TOKEN: pat, GITHUB_TOKEN: pat },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return "ok";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!options?.quiet) {
      console.error(`[token] Secret 동기화 실패: ${message}`);
    }
    return "fail";
  }
}
