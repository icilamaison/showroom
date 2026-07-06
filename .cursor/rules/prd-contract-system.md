# PRD: 계약서 작성 정보 저장 및 관리자 조회 시스템 (MVP)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 작성일 | 2026-06-24 |
| 작성 대상 | Junior Developer 이해 및 구현 기준 |
| 상태 | Draft |

---

## 1. 개요

고객이 직접 계약서 정보를 입력하면 서버가 이를 검증하여 PostgreSQL DB에 저장하고, 관리자는 별도 관리자 페이지에서 로그인 후 저장된 계약서 목록과 상세 내용을 확인하고 상태를 변경할 수 있는 시스템을 구축한다.

이번 1차 MVP는 **"안정적으로 입력받고 → 저장하고 → 조회한다"**는 핵심 흐름만 구현하며, 알림톡 발송·PDF 생성·외부 연동 등은 다음 단계로 미룬다.

---

## 2. 배경 및 문제 정의

- 현재는 고객 정보와 계약 정보를 사람이 직접 확인하고 정리하는 수기 프로세스로 처리되고 있다.
- 수기 처리 과정에서 옮겨 적는 실수가 발생할 수 있다.
- 계약서 작성 이력이 체계적으로 관리되지 않는다.
- 계약이 어느 단계까지 진행되었는지 한눈에 확인하기 어렵다.
- 향후 알림톡 발송, PDF 자동 생성, 플레이오토 연동을 붙이려면 먼저 안정적인 데이터 구조가 있어야 한다.

---

## 3. 목표

1. 고객이 별도 로그인 없이 계약서 작성 폼에 접근하여 정보를 입력하고 제출할 수 있다.
2. 제출된 데이터는 서버 측 validation을 통과한 뒤 PostgreSQL에 저장된다.
3. 관리자는 로그인 후 모든 계약서를 목록/상세로 조회하고 상태를 변경할 수 있다.
4. 향후 기능 확장(알림톡, PDF, 결제, 플레이오토 연동)을 고려해 원본 제출 데이터를 JSONB로 함께 보관한다.

---

## 4. 범위

### 4.1 포함 범위 (In Scope)

**고객 기능**
- 계약서 작성 페이지 (인증 없이 누구나 접근 가능한 공개 페이지)
- 계약서 정보 입력 폼
- 클라이언트 측 입력값 validation
- 약관 동의 체크박스
- 제출 완료 화면

**서버 기능**
- 계약서 정보 저장 API (`POST /api/contracts`)
- 서버 측 validation (클라이언트 검증을 신뢰하지 않고 서버에서 재검증)
- 계약번호 자동 생성
- PostgreSQL DB 저장
- 저장 성공/실패에 대한 명확한 응답 처리

**관리자 기능**
- 관리자 로그인 (ID/PW 기반, 단일 관리자 계정 또는 복수 계정 모두 가능한 단순 구조)
- 계약서 목록 조회 (페이지네이션 포함)
- 고객명 / 연락처 / 상태 기준 검색·필터
- 계약서 상세 조회
- 계약 상태 변경

### 4.2 제외 범위 (Out of Scope)

다음 항목은 이번 MVP에서 **명시적으로 제외**한다. 구현 중 욕심내서 같이 만들지 않는다.

| 제외 기능 | 비고 |
|---|---|
| 플레이오토 업로드 | 2차 이후 연동 예정 |
| 카카오 알림톡 발송 | 2차 이후 연동 예정 |
| PDF 자동 생성 | 2차 이후 연동 예정. 단, payload는 미리 보관해둠 |
| 결제 연동 | 범위 외 |
| 파일 첨부 | 범위 외 |
| 복잡한 관리자 권한 관리 (역할별 권한 등) | 로그인 여부만 체크하는 단순 인증 |
| 전자서명의 법적 효력 검증 | 서명명은 텍스트 입력으로만 처리, 법적 서명 아님 |
| 계약서 템플릿 다중 관리 | 입력 항목은 고정된 단일 템플릿 |

---

## 5. User Story

### US-1. 고객 — 계약서 작성
> 고객으로서, 나는 로그인 없이 계약서 작성 페이지에 접속해서 내 정보와 계약 정보를 입력하고 제출하고 싶다. 그래야 직원과 따로 통화하거나 서류를 주고받지 않고도 계약을 진행할 수 있다.

### US-2. 고객 — 입력 오류 확인
> 고객으로서, 나는 필수 항목을 빠뜨리거나 형식이 잘못된 값을 입력했을 때 어떤 항목이 잘못되었는지 명확히 알고 싶다. 그래야 다시 처음부터 입력하지 않고 바로 수정할 수 있다.

### US-3. 고객 — 제출 완료 확인
> 고객으로서, 나는 계약서를 제출한 뒤 정상적으로 접수되었다는 것과 내 계약번호를 확인하고 싶다. 그래야 나중에 문의할 때 계약번호로 조회를 요청할 수 있다.

### US-4. 관리자 — 로그인
> 관리자로서, 나는 ID/PW로 로그인해서 관리자 페이지에 접근하고 싶다. 그래야 인증되지 않은 사람이 고객의 계약 정보를 볼 수 없다.

### US-5. 관리자 — 목록 조회 및 검색
> 관리자로서, 나는 들어온 계약서를 목록으로 한눈에 보고, 고객명/연락처/상태로 검색하고 싶다. 그래야 특정 계약서를 빠르게 찾을 수 있다.

### US-6. 관리자 — 상세 조회
> 관리자로서, 나는 목록에서 특정 계약서를 클릭해 고객이 입력한 전체 내용을 확인하고 싶다. 그래야 계약 내용을 검토하고 다음 단계를 진행할 수 있다.

### US-7. 관리자 — 상태 변경
> 관리자로서, 나는 계약서를 검토한 뒤 상태를 "검토중", "계약확정", "취소"로 변경하고 싶다. 그래야 계약의 진행 단계를 다른 담당자도 알 수 있다.

---

## 6. 기능 요구사항 (Functional Requirements)

### 6.1 고객 기능

| ID | 요구사항 |
|---|---|
| FR-C1 | 고객은 인증 없이 `/contract/write` 페이지에 접근할 수 있다. |
| FR-C2 | 입력 폼은 아래 "8.2 입력 항목"에 정의된 모든 필드를 포함한다. |
| FR-C3 | 필수 항목이 비어 있으면 제출 버튼 클릭 시 클라이언트에서 즉시 에러 메시지를 표시한다. |
| FR-C4 | 약관 동의 체크박스가 체크되지 않으면 제출할 수 없다. |
| FR-C5 | 제출 시 폼 데이터를 `POST /api/contracts`로 전송한다. |
| FR-C6 | 서버 응답이 성공이면 제출 완료 화면으로 이동하고 발급된 계약번호를 표시한다. |
| FR-C7 | 서버 응답이 실패(validation 오류 등)이면 어떤 항목이 문제인지 화면에 표시하고, 사용자가 입력한 값은 유지된다 (처음부터 다시 입력하지 않음). |

### 6.2 서버 기능

| ID | 요구사항 |
|---|---|
| FR-S1 | `POST /api/contracts`는 요청 본문을 서버 측에서 다시 validation한다. 클라이언트 검증 통과 여부와 무관하게 항상 재검증한다. |
| FR-S2 | validation 실패 시 `400` 상태 코드와 함께 실패한 필드 목록을 응답한다. |
| FR-S3 | validation 통과 시 계약번호를 자동 생성한다 (규칙은 "9. 계약번호 생성 규칙" 참조). |
| FR-S4 | 계약 데이터와 원본 제출 payload(JSONB)를 `contracts` 테이블에 저장한다. |
| FR-S5 | 신규 계약의 초기 상태는 항상 `SUBMITTED`로 저장한다. |
| FR-S6 | DB 저장 성공 시 `201` 상태 코드와 계약번호를 응답한다. |
| FR-S7 | DB 저장 실패(서버 오류 등) 시 `500` 상태 코드와 일반화된 에러 메시지를 응답하고, 고객의 입력 데이터가 유실되지 않도록 클라이언트는 재시도 가능한 상태를 유지한다. |

### 6.3 관리자 기능

| ID | 요구사항 |
|---|---|
| FR-A1 | 관리자는 로그인 페이지(`/admin/login`)에서 ID/PW로 로그인한다. |
| FR-A2 | 로그인 성공 시 인증 토큰(JWT, httpOnly 쿠키 저장)을 발급한다. |
| FR-A3 | 인증 토큰이 없거나 만료된 상태로 `/admin/*` 페이지 또는 `/api/admin/*` API에 접근하면 로그인 페이지로 리다이렉트(페이지) 또는 `401` 응답(API)한다. |
| FR-A4 | 관리자는 계약서 목록을 페이지네이션과 함께 조회할 수 있다. |
| FR-A5 | 목록은 고객명, 연락처, 상태로 검색·필터링할 수 있다 (복합 조건도 가능, AND 조건). |
| FR-A6 | 관리자는 목록에서 특정 계약서를 선택해 상세 페이지로 이동할 수 있다. |
| FR-A7 | 상세 페이지에서는 고객이 입력한 전체 항목을 확인할 수 있다. |
| FR-A8 | 관리자는 상세 페이지에서 상태를 4가지 값(`SUBMITTED`, `REVIEWING`, `CONFIRMED`, `CANCELED`) 중 하나로 변경할 수 있다. |
| FR-A9 | 상태 변경 시 변경 이력(누가, 언제 변경했는지)은 이번 MVP에서는 별도 테이블로 관리하지 않고, `contracts.updated_at`만 갱신한다. (이력 테이블은 향후 확장 항목) |

---

## 7. 비기능 요구사항 (Non-Functional Requirements)

| ID | 분류 | 요구사항 |
|---|---|---|
| NFR-1 | 보안 | 관리자 비밀번호는 평문 저장 금지. bcrypt 등으로 해시 후 저장한다. |
| NFR-2 | 보안 | JWT는 httpOnly, secure(운영 환경) 쿠키로 저장하여 XSS로 토큰이 탈취되지 않게 한다. |
| NFR-3 | 보안 | 고객 작성 API(`POST /api/contracts`)는 비인증 공개 API이므로, 비정상적인 반복 제출을 막기 위한 기본적인 rate limiting을 고려한다 (MVP에서는 설계만 해두고 구현은 선택). |
| NFR-4 | 데이터 정합성 | 계약번호는 DB 레벨에서 `UNIQUE` 제약을 건다. |
| NFR-5 | 데이터 보존 | 고객이 제출한 원본 데이터는 이후 폼 구조가 바뀌어도 추적 가능하도록 `payload` JSONB 컬럼에 그대로 보관한다. |
| NFR-6 | 사용성 | 고객 작성 폼은 모바일 환경에서도 정상적으로 입력 가능해야 한다 (반응형). |
| NFR-7 | 에러 처리 | 모든 API 에러 응답은 `{ success: false, message: string, errors?: object }` 형태의 일관된 포맷을 따른다. |
| NFR-8 | 성능 | 관리자 목록 조회는 기본적으로 최신 작성일 순으로 정렬되며, 페이지당 20건을 기본값으로 한다. |

---

## 8. 데이터 모델

### 8.1 `contracts` 테이블

```sql
CREATE TABLE contracts (
  id                  SERIAL PRIMARY KEY,
  contract_number     VARCHAR(30)   NOT NULL UNIQUE,
  customer_name       VARCHAR(50)   NOT NULL,
  customer_phone      VARCHAR(20)   NOT NULL,
  customer_address    TEXT          NOT NULL,
  product_name        VARCHAR(100)  NOT NULL,
  contract_amount     NUMERIC(12,2) NOT NULL,
  contract_start_date DATE          NOT NULL,
  contract_end_date   DATE          NOT NULL,
  special_terms       TEXT,
  terms_agreed        BOOLEAN       NOT NULL DEFAULT FALSE,
  signature_name      VARCHAR(50)   NOT NULL,
  status              VARCHAR(20)   NOT NULL DEFAULT 'SUBMITTED',
  payload             JSONB         NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_customer_name  ON contracts (customer_name);
CREATE INDEX idx_contracts_customer_phone ON contracts (customer_phone);
CREATE INDEX idx_contracts_status         ON contracts (status);
CREATE INDEX idx_contracts_created_at     ON contracts (created_at DESC);
```

**컬럼 설명**

| 컬럼 | 설명 |
|---|---|
| `contract_number` | 자동 생성되는 고유 계약번호 (규칙은 9번 항목 참조) |
| `payload` | 고객이 제출한 원본 요청 body 전체를 JSON 그대로 저장. 폼이 바뀌어도 당시 데이터를 그대로 추적 가능 |
| `status` | `SUBMITTED` / `REVIEWING` / `CONFIRMED` / `CANCELED` 중 하나. 애플리케이션 레벨에서 값 검증 (DB `CHECK` 제약 추가 권장) |
| `terms_agreed` | 약관 동의 여부. `FALSE`인 요청은 서버에서 저장 전에 거부됨 (validation 단계) |

> 참고: `status`에 `CHECK (status IN ('SUBMITTED','REVIEWING','CONFIRMED','CANCELED'))` 제약을 추가하면 잘못된 상태값이 DB에 들어가는 것을 막을 수 있다. 추가를 권장한다.

### 8.2 입력 항목 정의 (고객 작성 폼)

| 필드명 | DB 컬럼 | 타입 | 필수 | Validation 규칙 |
|---|---|---|---|---|
| 고객명 | `customer_name` | string | O | 2~50자 |
| 연락처 | `customer_phone` | string | O | 숫자/하이픈, 010-0000-0000 형식 |
| 주소 | `customer_address` | string | O | 1자 이상 |
| 상품명/서비스명 | `product_name` | string | O | 1~100자 |
| 계약 금액 | `contract_amount` | number | O | 0보다 큰 숫자 |
| 계약 시작일 | `contract_start_date` | date | O | 유효한 날짜 |
| 계약 종료일 | `contract_end_date` | date | O | 유효한 날짜, **종료일 ≥ 시작일** |
| 특약사항 | `special_terms` | string | X | 없으면 빈 값 허용 |
| 약관 동의 | `terms_agreed` | boolean | O | 반드시 `true`여야 제출 가능 |
| 서명명 | `signature_name` | string | O | 2~50자. 텍스트 입력(전자서명 캔버스 아님) |

### 8.3 `admins` 테이블 (관리자 로그인용)

```sql
CREATE TABLE admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

> MVP에서는 관리자 계정을 시드 데이터로 직접 삽입(예: 시딩 스크립트)하며, 관리자 가입 화면은 만들지 않는다.

---

## 9. 계약번호 생성 규칙

**형식:** `CT-YYYYMMDD-XXXX`

- `CT` : 고정 접두사 (Contract)
- `YYYYMMDD` : 계약서 제출일 (예: 20260624)
- `XXXX` : 해당 날짜 내 순번, 4자리 zero-padding (0001부터 시작)

**예시:** `CT-20260624-0001`, `CT-20260624-0002`, `CT-20260625-0001`

**생성 로직 (서버, 트랜잭션 내에서 처리)**

1. 오늘 날짜(`YYYYMMDD`)를 구한다.
2. 해당 날짜로 시작하는 `contract_number`의 개수를 조회하거나, 날짜별 시퀀스를 관리하는 보조 테이블/방식을 사용한다.
3. 순번을 4자리로 zero-padding하여 계약번호를 조립한다.
4. `INSERT` 시 `UNIQUE` 제약 충돌이 발생하면(동시 요청으로 인한 race condition) 재시도하거나, DB 시퀀스(`SEQUENCE`)를 활용해 동시성 문제를 원천적으로 방지한다.

> 동시 제출이 많지 않은 초기 단계에서는 "같은 날짜의 최대 순번 + 1" 방식으로 충분하지만, 동시성 이슈를 줄이려면 PostgreSQL `SEQUENCE`를 날짜별로 따로 두는 방식도 고려할 수 있다. Junior 개발자는 우선 단순한 방식으로 구현하고, 동시 접속 테스트에서 중복이 발생하면 시퀀스 방식으로 개선한다.

---

## 10. API 명세

### 10.1 고객 API

#### `POST /api/contracts`
계약서 제출

**Request Body**
```json
{
  "customerName": "홍길동",
  "customerPhone": "010-1234-5678",
  "customerAddress": "서울시 강서구 마곡동 123-45",
  "productName": "프리미엄 침구 세트",
  "contractAmount": 350000,
  "contractStartDate": "2026-07-01",
  "contractEndDate": "2027-06-30",
  "specialTerms": "배송은 7월 5일 이후 희망",
  "termsAgreed": true,
  "signatureName": "홍길동"
}
```

**Response 201 (성공)**
```json
{
  "success": true,
  "data": {
    "contractNumber": "CT-20260624-0001",
    "status": "SUBMITTED"
  }
}
```

**Response 400 (validation 실패)**
```json
{
  "success": false,
  "message": "입력값을 확인해주세요.",
  "errors": {
    "contractEndDate": "종료일은 시작일보다 빠를 수 없습니다.",
    "termsAgreed": "약관에 동의해야 합니다."
  }
}
```

### 10.2 관리자 API

#### `POST /api/admin/login`
**Request Body**
```json
{ "username": "admin", "password": "********" }
```
**Response 200**: 로그인 성공 시 httpOnly 쿠키로 JWT 발급, body에는 최소 정보만 반환.
**Response 401**: ID/PW 불일치.

#### `GET /api/admin/contracts`
목록 조회 (인증 필요)

**Query Parameters**

| 파라미터 | 설명 |
|---|---|
| `customerName` | 고객명 부분 검색 |
| `customerPhone` | 연락처 부분 검색 |
| `status` | 상태값 정확히 일치 |
| `page` | 페이지 번호 (기본 1) |
| `limit` | 페이지당 개수 (기본 20) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "contractNumber": "CT-20260624-0001",
        "customerName": "홍길동",
        "customerPhone": "010-1234-5678",
        "productName": "프리미엄 침구 세트",
        "contractAmount": 350000,
        "status": "SUBMITTED",
        "createdAt": "2026-06-24T01:23:45.000Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 134
  }
}
```

#### `GET /api/admin/contracts/:id`
상세 조회 (인증 필요) — `contracts` 테이블의 전체 컬럼 반환

#### `PATCH /api/admin/contracts/:id/status`
상태 변경 (인증 필요)

**Request Body**
```json
{ "status": "REVIEWING" }
```
**Response 400**: `status` 값이 4가지 허용값 외의 다른 값인 경우.

---

## 11. 계약 상태 정의

| 상태 코드 | 라벨 | 의미 |
|---|---|---|
| `SUBMITTED` | 작성완료 | 고객이 막 제출한 초기 상태 |
| `REVIEWING` | 검토중 | 관리자가 내용을 검토하고 있는 상태 |
| `CONFIRMED` | 계약확정 | 계약이 최종 확정된 상태 |
| `CANCELED` | 취소 | 계약이 취소된 상태 |

**상태 전환 규칙 (MVP 기준)**

- MVP에서는 상태 전환 순서를 시스템적으로 강제하지 않는다. 관리자가 드롭다운에서 4개 값 중 자유롭게 선택해 변경할 수 있다.
- 권장 흐름은 `SUBMITTED → REVIEWING → CONFIRMED` 또는 `→ CANCELED`이지만, 강제 검증은 2차 이후 필요 시 추가한다.

---

## 12. 화면 명세 (개략)

### 12.1 고객 — 계약서 작성 페이지 (`/contract/write`)
- 8.2의 입력 항목을 모두 포함한 단일 페이지 폼
- 필수 항목에 `*` 표시
- 제출 버튼 클릭 시 클라이언트 validation → 통과하면 API 호출
- 약관 동의 체크박스 미체크 시 제출 버튼 비활성화 또는 클릭 시 에러 표시

### 12.2 고객 — 제출 완료 화면 (`/contract/complete`)
- 발급된 계약번호 표시
- "계약번호를 보관해주세요" 안내 문구

### 12.3 관리자 — 로그인 (`/admin/login`)
- ID, PW 입력 필드
- 로그인 실패 시 에러 메시지 표시

### 12.4 관리자 — 계약서 목록 (`/admin/contracts`)
- 표 형태: 계약번호 / 고객명 / 연락처 / 상품명 / 계약금액 / 상태 / 작성일 / 상세보기 버튼
- 상단 검색/필터 영역: 고객명, 연락처, 상태 드롭다운
- 하단 페이지네이션

### 12.5 관리자 — 계약서 상세 (`/admin/contracts/:id`)
- 고객이 입력한 전체 항목 표시 (8.2 항목 전체)
- 상태 변경 드롭다운 + 저장 버튼
- 계약번호, 작성일, 최종 수정일 표시

---

## 13. Acceptance Criteria

### AC-1 (계약서 제출)
- [ ] 필수 항목을 모두 올바르게 입력하고 제출하면 `201` 응답과 계약번호를 받는다.
- [ ] 필수 항목 중 하나라도 비어 있으면 제출이 막히고 어떤 항목이 문제인지 표시된다.
- [ ] 계약 종료일이 시작일보다 빠르면 제출이 거부된다.
- [ ] 약관 동의 체크박스가 체크되지 않으면 제출이 거부된다.
- [ ] 동일한 입력으로 두 번 제출해도 계약번호는 항상 서로 다르게 생성된다.

### AC-2 (DB 저장)
- [ ] 제출된 데이터는 `contracts` 테이블에 정확히 저장된다.
- [ ] 제출 당시 원본 요청 데이터는 `payload` 컬럼에 JSON 그대로 저장된다.
- [ ] 신규 계약의 `status`는 항상 `SUBMITTED`로 저장된다.

### AC-3 (관리자 로그인)
- [ ] 올바른 ID/PW로 로그인하면 인증 토큰이 발급되고 `/admin/contracts`로 이동한다.
- [ ] 잘못된 ID/PW로 로그인하면 에러 메시지가 표시되고 토큰이 발급되지 않는다.
- [ ] 인증 토큰 없이 `/admin/contracts`에 접근하면 로그인 페이지로 리다이렉트된다.

### AC-4 (목록 조회 및 검색)
- [ ] 목록 페이지에서 전체 계약서가 최신 작성일 순으로 표시된다.
- [ ] 고객명으로 검색하면 해당 이름을 포함한 계약서만 표시된다.
- [ ] 상태로 필터링하면 해당 상태의 계약서만 표시된다.
- [ ] 검색 조건을 여러 개 동시에 적용하면 AND 조건으로 동작한다.

### AC-5 (상세 조회)
- [ ] 목록에서 상세보기를 클릭하면 해당 계약서의 모든 입력 항목이 표시된다.

### AC-6 (상태 변경)
- [ ] 관리자가 상태를 변경하고 저장하면 DB의 `status`와 `updated_at`이 갱신된다.
- [ ] 변경된 상태는 목록 페이지에 즉시 반영된다.
- [ ] 4가지 허용값 외의 값으로 변경을 시도하면 `400` 에러가 발생한다.

---

## 14. 향후 확장 가능성 (Out of Scope이지만 고려된 구조)

- **카카오 알림톡 발송**: 상태 변경 시(`status` 컬럼 변경 트리거) 알림톡 발송 로직을 붙일 수 있도록 상태 변경 API를 단일 엔드포인트로 분리해둠.
- **PDF 자동 생성**: `payload` JSONB에 원본 제출 데이터가 그대로 보관되어 있어, 추후 PDF 템플릿에 매핑하기 용이함.
- **플레이오토 업로드**: `contracts` 테이블에 별도 연동 상태 컬럼(예: `playauto_synced_at`)을 추가하는 방식으로 확장 가능.
- **상태 변경 이력 관리**: 별도 `contract_status_logs` 테이블(계약 ID, 이전 상태, 이후 상태, 변경자, 변경 시각)을 추가해 변경 이력을 추적할 수 있음.
- **관리자 권한 분리**: `admins` 테이블에 `role` 컬럼을 추가하고 미들웨어에서 권한 체크를 추가하는 방식으로 확장 가능.
- **전자서명 강화**: `signature_name`을 캔버스 기반 서명 이미지 저장(`signature_image_url`)으로 교체하거나 추가하는 방식으로 확장 가능.
- **계약서 템플릿 다중화**: `contracts` 테이블에 `template_type` 컬럼을 추가하고, 입력 항목을 템플릿별로 동적 구성하는 방식으로 확장 가능.

---

## 15. 결정된 사항 요약 (Decision Log)

| 항목 | 결정 |
|---|---|
| 고객 작성 폼 접근 방식 | 인증 없이 누구나 접근 가능한 공개 페이지 |
| 관리자 인증 | ID/PW 로그인 + JWT(httpOnly 쿠키) |
| 서명 방식 | 텍스트 입력 (법적 전자서명 아님) |
| 계약번호 형식 | `CT-YYYYMMDD-XXXX` |
| 상태 전환 강제 여부 | MVP에서는 강제하지 않음 (자유 변경) |
| 상태 변경 이력 | MVP에서는 미보관 (`updated_at`만 갱신), 향후 확장 항목 |

---

## 16. 구현 체크리스트 (Junior Developer용)

1. [ ] PostgreSQL에 `contracts`, `admins` 테이블 생성 (8번 항목 SQL 참고)
2. [ ] 관리자 시드 계정 1개 생성 (bcrypt 해시 비밀번호)
3. [ ] Express: `POST /api/contracts` — validation 라이브러리(예: Zod, Joi)로 서버 측 검증 구현
4. [ ] Express: 계약번호 생성 함수 구현 및 단위 테스트
5. [ ] Express: `POST /api/admin/login` — bcrypt 비교 + JWT 발급
6. [ ] Express: 인증 미들웨어 구현 (`/api/admin/*`에 적용)
7. [ ] Express: `GET /api/admin/contracts` — 검색/필터/페이지네이션 구현
8. [ ] Express: `GET /api/admin/contracts/:id`
9. [ ] Express: `PATCH /api/admin/contracts/:id/status` — 허용값 검증 포함
10. [ ] Next.js: 고객 작성 폼 페이지 + 클라이언트 validation
11. [ ] Next.js: 제출 완료 페이지
12. [ ] Next.js: 관리자 로그인 페이지
13. [ ] Next.js: 관리자 목록/검색 페이지
14. [ ] Next.js: 관리자 상세/상태변경 페이지
15. [ ] 전체 흐름 통합 테스트 (제출 → DB 확인 → 관리자 조회 → 상태 변경 → 목록 반영 확인)
