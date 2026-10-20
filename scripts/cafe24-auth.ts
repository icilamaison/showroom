/**
 * 카페24 OAuth CLI (로컬·CI 토큰을 한곳으로 맞춘다).
 *
 *   npx tsx scripts/cafe24-auth.ts auth
 *   npx tsx scripts/cafe24-auth.ts init CODE
 *   npx tsx scripts/cafe24-auth.ts status
 *   npx tsx scripts/cafe24-auth.ts push-secret
 *   npx tsx scripts/cafe24-auth.ts import /path/to/.cafe24-tokens.json
 *   npx tsx scripts/cafe24-auth.ts refresh
 */

import {
  authUrl,
  importTokensFromFile,
  initFromCode,
  printTokenStatus,
  pushRefreshSecret,
  refreshAccessToken,
} from "./lib/cafe24-auth";

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);

  if (command === "auth") {
    console.log(authUrl());
    console.log("승인 후 주소의 code 값을 복사해 1분 안에 아래를 실행하세요.");
    console.log("npx tsx scripts/cafe24-auth.ts init CODE");
    return;
  }

  if (command === "init") {
    if (!argument) {
      throw new Error(
        "code가 필요합니다: npx tsx scripts/cafe24-auth.ts init CODE",
      );
    }
    await initFromCode(argument);
    return;
  }

  if (command === "status") {
    printTokenStatus();
    return;
  }

  if (command === "push-secret") {
    const result = await pushRefreshSecret({ quiet: false });
    if (result === "ok") {
      console.log("CAFE24_REFRESH_TOKEN secret 갱신 완료");
      return;
    }
    if (result === "skip") {
      console.log("스킵: refresh_token이 없거나 로컬에서 CAFE24_PUSH_SECRET=1이 아닙니다");
    }
    process.exitCode = 1;
    return;
  }

  if (command === "import") {
    if (!argument) {
      throw new Error(
        "경로가 필요합니다: npx tsx scripts/cafe24-auth.ts import /path/to/.cafe24-tokens.json",
      );
    }
    importTokensFromFile(argument);
    const result = await pushRefreshSecret({ quiet: false });
    if (result === "ok") {
      console.log("GitHub Secret 동기화 완료 — 다음 CI는 이 토큰을 씁니다");
      return;
    }
    if (result === "skip") {
      console.log(
        "로컬만 갱신됨. CI까지 맞추려면: CAFE24_SYNC_PAT 설정 후 npx tsx scripts/cafe24-auth.ts push-secret",
      );
    }
    return;
  }

  if (command === "refresh") {
    await refreshAccessToken();
    return;
  }

  console.log(`사용법:
  npx tsx scripts/cafe24-auth.ts auth
  npx tsx scripts/cafe24-auth.ts init CODE
  npx tsx scripts/cafe24-auth.ts status
  npx tsx scripts/cafe24-auth.ts refresh
  npx tsx scripts/cafe24-auth.ts push-secret
  npx tsx scripts/cafe24-auth.ts import /path/to/.cafe24-tokens.json

skin31 등에서 이미 갱신한 토큰이 있으면 import → (자동) push-secret 하면 CI 실패가 멈춥니다.`);
  process.exitCode = command ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
