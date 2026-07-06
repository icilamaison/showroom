# Tasks: 계약서 작성 정보 저장 및 관리자 조회 시스템 (MVP)

> PRD: `.cursor/rules/prd-contract-system.md`  
> 생성일: 2026-06-24

---

## Relevant Files

### 프로젝트 설정 및 DB

- `next.config.ts` - Next.js 설정 (API 프록시 `/api` → Express 4000번 포트)
- `vitest.config.ts` - Vitest 테스트 설정
- `eslint.config.mjs` - ESLint 설정
- `app/layout.tsx` - Next.js 루트 레이아웃
- `app/page.tsx` - 홈 페이지
- `app/globals.css` - 전역 스타일
- `.env.example` - 환경 변수 템플릿 (DB URL, JWT_SECRET 등)
- `server/db/pool.ts` - PostgreSQL 연결 풀 설정
- `server/db/migrations/001_create_contracts.sql` - `contracts` 테이블 및 인덱스 생성
- `server/db/migrations/002_create_admins.sql` - `admins` 테이블 생성
- `server/db/migrate.ts` - 마이그레이션 실행 스크립트
- `server/db/seed.ts` - 관리자 시드 계정 삽입 스크립트 (bcrypt 해시)
- `server/routes/index.ts` - `/api` 라우트 마운트 (health check 등)

### 서버 — 공통

- `server/lib/api-response.ts` - `{ success, message, errors?, data? }` 공통 응답 헬퍼
- `server/lib/errors.ts` - 커스텀 에러 클래스 (ValidationError 등)

### 서버 — 고객 API

- `server/schemas/contract.schema.ts` - Zod 기반 계약서 입력 validation 스키마 (PRD 8.2 기준)
- `server/schemas/contract.schema.test.ts` - validation 스키마 단위 테스트
- `server/services/contract-number.ts` - 계약번호 생성 로직 (`CT-YYYYMMDD-XXXX`)
- `server/services/contract-number.test.ts` - 계약번호 생성 단위 테스트
- `server/services/contract.service.ts` - 계약서 저장 비즈니스 로직 (트랜잭션, payload JSONB 저장)
- `server/routes/contracts.ts` - `POST /api/contracts` 라우트 핸들러
- `server/routes/contracts.test.ts` - 계약서 제출 API 통합 테스트

### 서버 — 관리자 API

- `server/schemas/admin.schema.ts` - 로그인 요청 및 상태 변경 validation 스키마
- `server/middleware/auth.ts` - JWT httpOnly 쿠키 검증 미들웨어 (`/api/admin/*` 보호)
- `server/services/auth.service.ts` - bcrypt 비밀번호 비교 및 JWT 발급
- `server/services/admin-contract.service.ts` - 목록/상세/상태변경 DB 쿼리
- `server/routes/admin/index.ts` - 관리자 라우트 마운트 (login 제외 인증 미들웨어 적용)
- `server/routes/admin/contracts.ts` - `GET`, `PATCH` 관리자 계약서 API 라우트
- `server/routes/admin/contracts.test.ts` - 관리자 API 통합 테스트

### 프론트엔드 — 공통

- `lib/api-client.ts` - fetch 래퍼 (에러 응답 파싱, 쿠키 포함 옵션)
- `lib/validation/contract.ts` - 클라이언트 측 validation 규칙 (PRD 8.2와 동일 규칙)
- `lib/validation/contract.test.ts` - 클라이언트 validation 단위 테스트
- `lib/constants/contract-status.ts` - 상태 코드·라벨 상수 (`SUBMITTED` 등)

### 프론트엔드 — 고객 페이지

- `app/contract/write/page.tsx` - 계약서 작성 폼 페이지 (`/contract/write`)
- `app/contract/contract.css` - 고객 계약서 작성/완료 페이지 반응형 스타일
- `app/contract/write/ContractForm.tsx` - 입력 폼 컴포넌트 (필드, 약관 동의, 에러 표시)
- `app/contract/complete/page.tsx` - 제출 완료 페이지 (`/contract/complete`, 계약번호 표시)

### 프론트엔드 — 관리자 페이지

- `middleware.ts` - Next.js 미들웨어 (`/admin/*` 인증 없으면 `/admin/login` 리다이렉트)
- `app/admin/admin.css` - 관리자 페이지 공통 스타일
- `app/admin/login/page.tsx` - 관리자 로그인 페이지
- `app/admin/contracts/page.tsx` - 계약서 목록·검색·필터·페이지네이션
- `app/admin/contracts/[id]/page.tsx` - 계약서 상세 조회 및 상태 변경

### Notes

- 단위 테스트는 가능하면 테스트 대상 코드 파일과 같은 디렉토리에 둔다.
- API 통합 테스트는 `supertest` 사용
- 서버 테스트 실행: `npm run test:server`
- 프론트엔드 테스트 실행: `npm run test:client`
- 전체 테스트: `npm test`
- DB 마이그레이션: `npm run db:migrate`
- 시드 데이터: `npm run db:seed`
- 개발 서버: `npm run dev` (Next.js + Express 동시 실행 또는 프록시 설정)

---

## Tasks

- [x] 1.0 프로젝트 초기 설정 및 데이터베이스 구축
  - [x] 1.1 Next.js(App Router) + Express + TypeScript 프로젝트 초기화. `package.json`에 `dev`, `build`, `test`, `db:migrate`, `db:seed` 스크립트 추가
  - [x] 1.2 `.env.example` 작성 — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD` 항목 정의
  - [x] 1.3 `server/db/pool.ts`에 `pg` Pool 연결 설정. 연결 실패 시 명확한 에러 로그 출력
  - [x] 1.4 `server/db/migrations/001_create_contracts.sql` 작성 — PRD 8.1의 `contracts` 테이블, 인덱스, `status` CHECK 제약 포함
  - [x] 1.5 `server/db/migrations/002_create_admins.sql` 작성 — PRD 8.3의 `admins` 테이블 생성
  - [x] 1.6 `server/db/migrate.ts` 구현 — `migrations/` 폴더의 SQL 파일을 순서대로 실행하는 스크립트
  - [x] 1.7 `server/db/seed.ts` 구현 — bcrypt로 비밀번호 해시 후 관리자 계정 1개 삽입 (중복 실행 시 skip 처리)
  - [x] 1.8 `server/index.ts`에 Express 앱 기본 셋업 — `express.json()`, CORS, 쿠키 파서, `/api` 라우트 마운트, Next.js와 연동(또는 별도 포트 + 프록시)

- [x] 2.0 고객 계약서 제출 API 구현
  - [x] 2.1 `server/lib/api-response.ts` 구현 — PRD NFR-7 형식의 성공/실패 응답 헬퍼 (`success`, `message`, `errors`, `data`)
  - [x] 2.2 `server/schemas/contract.schema.ts` 구현 — PRD 8.2 필드 전체 Zod 스키마 (camelCase API 필드명, `termsAgreed`는 `true`만 허용, 종료일 ≥ 시작일 검증)
  - [x] 2.3 `server/schemas/contract.schema.test.ts` 작성 — 필수값 누락, 전화번호 형식 오류, 종료일 < 시작일, `termsAgreed: false` 케이스 테스트
  - [x] 2.4 `server/services/contract-number.ts` 구현 — `CT-YYYYMMDD-XXXX` 형식 생성. 당일 최대 순번 + 1 방식, UNIQUE 충돌 시 재시도 로직 포함
  - [x] 2.5 `server/services/contract-number.test.ts` 작성 — 첫 번째/두 번째 계약번호, 날짜 변경 시 순번 리셋 케이스 테스트
  - [x] 2.6 `server/services/contract.service.ts` 구현 — 트랜잭션 내 계약번호 생성 → `contracts` INSERT (`status: 'SUBMITTED'`, `payload`에 원본 body JSONB 저장)
  - [x] 2.7 `server/routes/contracts.ts`에 `POST /api/contracts` 구현 — Zod validation → 400 + `errors` 필드별 메시지, 성공 시 201 + `{ contractNumber, status }`, DB 오류 시 500 + 일반화된 메시지
  - [x] 2.8 `server/routes/contracts.test.ts` 작성 — AC-1, AC-2 시나리오 (정상 제출, validation 실패, 중복 제출 시 서로 다른 계약번호)

- [x] 3.0 관리자 인증 및 계약서 관리 API 구현
  - [x] 3.1 `server/services/auth.service.ts` 구현 — `admins` 테이블 조회, bcrypt `compare`, JWT 서명 (payload: `adminId`, `username`)
  - [x] 3.2 `server/routes/admin/auth.ts`에 `POST /api/admin/login` 구현 — 성공 시 httpOnly 쿠키에 JWT 설정 (`secure`는 운영 환경만), 401 시 `{ success: false, message }` 반환
  - [x] 3.3 `server/middleware/auth.ts` 구현 — 쿠키 JWT 검증, 만료/무효 시 401 응답. `/api/admin/*` 라우트에 적용 (login 제외)
  - [x] 3.4 `server/services/admin-contract.service.ts`에 목록 조회 구현 — `created_at DESC` 정렬, `page`(기본 1)·`limit`(기본 20), `customerName`/`customerPhone` 부분 검색(LIKE), `status` 정확 일치, 복합 조건 AND, `total` 카운트 반환
  - [x] 3.5 `server/routes/admin/contracts.ts`에 `GET /api/admin/contracts` 구현 — PRD 10.2 응답 형식 (`items`, `page`, `limit`, `total`)
  - [x] 3.6 `GET /api/admin/contracts/:id` 구현 — `contracts` 테이블 전체 컬럼 반환, 없으면 404
  - [x] 3.7 `PATCH /api/admin/contracts/:id/status` 구현 — body `{ status }` 검증 (`SUBMITTED`/`REVIEWING`/`CONFIRMED`/`CANCELED`만 허용), `status`와 `updated_at` 갱신, 잘못된 값이면 400
  - [x] 3.8 `server/routes/admin/contracts.test.ts` 작성 — AC-3~AC-6 시나리오 (로그인, 미인증 401, 검색/필터 AND, 상태 변경, 허용값 외 400)

- [x] 4.0 고객용 프론트엔드 구현
  - [x] 4.1 `lib/validation/contract.ts` 구현 — PRD 8.2와 동일한 클라이언트 validation 규칙 (필드별 에러 메시지 객체 반환)
  - [x] 4.2 `lib/validation/contract.test.ts` 작성 — 필수값, 전화번호, 날짜, 약관 동의 검증 케이스
  - [x] 4.3 `lib/api-client.ts` 구현 — `POST /api/contracts` 호출 함수, 400 응답의 `errors` 객체 파싱
  - [x] 4.4 `app/contract/write/ContractForm.tsx` 구현 — PRD 8.2 전체 입력 필드, 필수 항목 `*` 표시, 약관 동의 체크박스, 미체크 시 제출 버튼 비활성화
  - [x] 4.5 `app/contract/write/page.tsx` 구현 — 제출 시 클라이언트 validation → API 호출 → 성공 시 `/contract/complete?contractNumber=...` 이동, 실패 시 필드별 에러 표시 및 입력값 유지 (FR-C7)
  - [x] 4.6 `app/contract/complete/page.tsx` 구현 — URL 파라미터 또는 state로 받은 계약번호 표시, "계약번호를 보관해주세요" 안내 문구
  - [x] 4.7 고객 작성 폼 반응형 스타일 적용 — 모바일에서도 입력·제출 가능 (NFR-6)

- [x] 5.0 관리자용 프론트엔드 구현
  - [x] 5.1 `app/admin/login/page.tsx` 구현 — ID/PW 입력 폼, `POST /api/admin/login` 호출, 성공 시 `/admin/contracts` 이동, 실패 시 에러 메시지 표시
  - [x] 5.2 `middleware.ts` 구현 — `/admin/*` 경로 접근 시 JWT 쿠키 없으면 `/admin/login`으로 리다이렉트 (`/admin/login` 자체는 제외)
  - [x] 5.3 `app/admin/contracts/page.tsx` 구현 — 테이블(계약번호/고객명/연락처/상품명/계약금액/상태/작성일/상세보기), 상단 검색·필터(고객명/연락처/상태), 하단 페이지네이션
  - [x] 5.4 `lib/constants/contract-status.ts` 구현 — 상태 코드 → 한글 라벨 매핑 (PRD 11번 표)
  - [x] 5.5 `app/admin/contracts/[id]/page.tsx` 구현 — 고객 입력 전체 항목 표시, 계약번호/작성일/최종 수정일 표시, 상태 드롭다운(4개 값) + 저장 버튼 → `PATCH /api/admin/contracts/:id/status` 호출
  - [x] 5.6 전체 흐름 통합 확인 — 고객 제출 → DB 저장 확인 → 관리자 로그인 → 목록 조회 → 상세 확인 → 상태 변경 → 목록에 반영 (PRD AC-1~AC-6 체크리스트 수동 검증)
