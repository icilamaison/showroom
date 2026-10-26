#!/usr/bin/env bash
# 카탈로그 동기화 1단계: dump + dry-run만 하고 product.json은 쓰지 않는다.
# 결과는 GitHub Actions Job Summary / artifacts로 남긴다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

mkdir -p artifacts/catalog-sync
SUMMARY="${GITHUB_STEP_SUMMARY:-artifacts/catalog-sync/summary.md}"
DUMP_LOG="artifacts/catalog-sync/dump.log"
MERGE_LOG="artifacts/catalog-sync/merge-dry-run.log"
STOCK_LOG="artifacts/catalog-sync/stock-variants-dry-run.log"
OPTIONS_LOG="artifacts/catalog-sync/options-dry-run.log"

if [[ ! -f .env.local ]]; then
  echo ".env.local이 없습니다. CI에서 시크릿으로 먼저 만들어주세요." >&2
  exit 1
fi

{
  echo "# Catalog sync report (dry-run)"
  echo
  echo "- 시각: $(date -u +"%Y-%m-%d %H:%M:%SZ")"
  echo "- 모드: dump → merge dry-run(--add-new) → stock variants dry-run → option prices dry-run"
  echo "- product.json 쓰기: **없음**"
  echo
  echo "## Token status (값 없음)"
  echo
  echo '```'
  npx tsx scripts/cafe24-auth.ts status 2>&1 || true
  echo '```'
  echo
} > "$SUMMARY"

echo "==> 1/4 dump"
set +e
npx tsx scripts/sync-products-from-cafe24.ts --dump 2>&1 | tee "$DUMP_LOG"
DUMP_EXIT=${PIPESTATUS[0]}
set -e

{
  echo "## 1. Dump"
  echo
  if [[ "$DUMP_EXIT" -eq 0 ]]; then
    echo "✅ 성공"
  else
    echo "❌ 실패 (exit $DUMP_EXIT)"
  fi
  echo
  echo '```'
  tail -n 40 "$DUMP_LOG"
  echo '```'
  echo
} >> "$SUMMARY"

if [[ "$DUMP_EXIT" -ne 0 ]]; then
  exit "$DUMP_EXIT"
fi

echo "==> 2/4 merge dry-run (+ 신규 후보)"
set +e
npx tsx scripts/merge-cafe24-dump.ts --add-new 2>&1 | tee "$MERGE_LOG"
MERGE_EXIT=${PIPESTATUS[0]}
set -e

{
  echo "## 2. Merge dry-run (--add-new)"
  echo
  if [[ "$MERGE_EXIT" -eq 0 ]]; then
    echo "✅ 성공 (파일 미반영)"
  else
    echo "❌ 실패 (exit $MERGE_EXIT)"
  fi
  echo
  echo "### 신규 추가 후보"
  echo '```'
  grep -E "\[신규 추가\]|^[[:space:]]+[0-9]+ " "$MERGE_LOG" || echo "(없음)"
  echo '```'
  echo
  echo "### 변경 요약 (끝부분)"
  echo '```'
  tail -n 60 "$MERGE_LOG"
  echo '```'
  echo
} >> "$SUMMARY"

echo "==> 3/4 stock variants dry-run"
set +e
npx tsx scripts/sync-stock-from-variants.ts 2>&1 | tee "$STOCK_LOG"
STOCK_EXIT=${PIPESTATUS[0]}
set -e

{
  echo "## 3. Stock variants dry-run"
  echo
  if [[ "$STOCK_EXIT" -eq 0 ]]; then
    echo "✅ 성공 (파일 미반영)"
  else
    echo "❌ 실패 (exit $STOCK_EXIT)"
  fi
  echo
  echo "> 세트 구성품 품절은 HTML 파싱(\`sync-stock-from-cafe24.ts\`)이라 CI 1단계에서는 제외했습니다."
  echo
  echo '```'
  # 상품 수집 진행 로그는 빼고 새로 품절 / 재입고 목록만 남긴다
  grep -v '^\[products\]' "$STOCK_LOG" | tail -n 80
  echo '```'
  echo
} >> "$SUMMARY"

echo "==> 4/4 option prices dry-run"
set +e
npx tsx scripts/sync-options-from-variants.ts 2>&1 | tee "$OPTIONS_LOG"
OPTIONS_EXIT=${PIPESTATUS[0]}
set -e

{
  echo "## 4. Option prices dry-run (사이즈·TYPE 추가금)"
  echo
  if [[ "$OPTIONS_EXIT" -eq 0 ]]; then
    echo "✅ 성공 (파일 미반영)"
  else
    echo "❌ 실패 (exit $OPTIONS_EXIT)"
  fi
  echo
  echo "> 덤프에는 옵션 추가금이 비어 있어서 merge(2단계)에는 안 나오는 사이즈별·TYPE별 판매가 차이입니다."
  echo
  echo '```'
  # 상품 수집 진행 로그는 빼고 변경 내역만 남긴다
  grep -v '^\[products\]' "$OPTIONS_LOG" | tail -n 120
  echo '```'
  echo
  echo "## 다음 단계 (로컬에서 전체 반영)"
  echo
  echo "CI는 dry-run만 한다. product.json에 쓰려면 로컬에서 아래 순서로 실행한다."
  echo
  echo '```bash'
  echo 'cd /path/to/showroom   # 또는 play-auto'
  echo
  echo '# 1) 카페24 덤프 (없으면/오래됐으면)'
  echo 'npx tsx scripts/sync-products-from-cafe24.ts --dump'
  echo
  echo '# 2) 상품명·가격·옵션·세트·신규 반영'
  echo 'npx tsx scripts/merge-cafe24-dump.ts --write --add-new'
  echo
  echo '# 3) 품절 (일반 상품)'
  echo 'npx tsx scripts/sync-stock-from-variants.ts --write'
  echo
  echo '# 4) 품절 (세트 구성품)'
  echo 'npx tsx scripts/sync-stock-from-cafe24.ts --write'
  echo
  echo '# 5) 사이즈·TYPE 가격 (옵션 추가금)'
  echo 'npx tsx scripts/sync-options-from-variants.ts --write'
  echo '```'
  echo
  echo "- 신규 상품은 \`internalCode\` / \`category\`가 비어 있을 수 있으니 확인한다."
  echo "- 세트 구성품 색이 비면: \`npx tsx scripts/merge-cafe24-dump.ts --write --refresh-sets\`"
  echo "- 반영 후 product.json을 커밋한다."
} >> "$SUMMARY"

# dump 외 merge/stock/options 실패도 job 실패로 보이게 한다.
if [[ "$MERGE_EXIT" -ne 0 || "$STOCK_EXIT" -ne 0 || "$OPTIONS_EXIT" -ne 0 ]]; then
  exit 1
fi
