#!/usr/bin/env bash
# Cafe24 판매수량 통계 → 짧은 인사이트 마크다운.
# 결과는 GitHub Actions Job Summary / artifacts / 메일로 남긴다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

OUT="artifacts/sales-insights"
mkdir -p "$OUT"
SUMMARY="${GITHUB_STEP_SUMMARY:-$OUT/summary.md}"
REPORT_LOG="$OUT/run.log"
DAYS="${SALES_DAYS:-7}"

if [[ ! -f .env.local ]]; then
  echo ".env.local이 없습니다. CI에서 시크릿으로 먼저 만들어주세요." >&2
  exit 1
fi

echo "==> sales insights"
set +e
npx tsx scripts/sales-insights-report.ts --days "$DAYS" --out "$OUT" 2>&1 | tee "$REPORT_LOG"
SALES_EXIT=${PIPESTATUS[0]}
set -e

if [[ "$SALES_EXIT" -eq 0 && -f "$OUT/summary.md" ]]; then
  if [[ "$SUMMARY" != "$OUT/summary.md" ]]; then
    cat "$OUT/summary.md" >> "$SUMMARY"
  fi
  exit 0
fi

{
  echo "# 매출 인사이트 실패"
  echo
  echo '```'
  tail -n 40 "$REPORT_LOG"
  echo '```'
} > "$SUMMARY"

if grep -q "mall.read_salesreport" "$REPORT_LOG" 2>/dev/null; then
  {
    echo
    echo "Cafe24 앱에 \`mall.read_salesreport\` 가 있는지, 재인증했는지 확인한다."
  } >> "$SUMMARY"
fi

exit "$SALES_EXIT"
