## CenterFlow Backend API 설계 초안

이 문서는 현재 프런트엔드(`types.ts`, `dataService.ts`) 구조에 맞춰 설계한 백엔드 REST API 초안입니다. 실제 구현 시 언어/프레임워크(Node, Python, Java 등)는 자유롭게 선택할 수 있습니다.

---

## 1. 공통 사항

- Base URL: `https://api.centerflow.example.com`
- 모든 응답은 JSON
- 시간 형식: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- 인증:
  - 키오스크: 별도 인증 없이 제한된 엔드포인트만 사용 (IP 화이트리스트 또는 키오스크 토큰)
  - 관리자: JWT 또는 세션 기반 인증 (예: `Authorization: Bearer <token>`)

---

## 2. 도메인 모델 요약

프런트엔드 `types.ts`와 1:1 대응.

### Visitor (회원)

- `id: string`
- `phone_number: string`
- `name: string`
- `created_at: string`
- `birth_date?: string`
- `address?: string`
- `is_startup?: boolean`
- `notes?: string`
- `terms_accepted_at?: string`

### Visit (방문 기록)

- `id: string`
- `visitor_id: string`
- `visitor_name: string`
- `check_in_at: string`
- `check_out_at: string | null`
- `purpose: 'Study' | 'Meeting' | 'Rest' | 'Event' | 'Other'`
- `status: 'active' | 'completed'`
- `space_id?: string`
- `space_name?: string`
- `program_id?: string`
- `program_name?: string`

### Space (공간)

- `id: string`
- `name: string`
- `capacity: number`
- `type?: 'Coworking' | 'Meeting' | 'Event' | 'Other'`
- `is_active?: boolean`

### Penalty (제재)

- `id: string`
- `visitor_id: string`
- `type: 'warning' | 'suspension'`
- `reason: string`
- `created_at: string`
- `active: boolean`

### Program / ProgramAttendance (프로그램/출석)

Program:
- `id: string`
- `name: string`
- `description?: string`
- `start_at: string`
- `end_at: string`
- `capacity?: number`
- `is_active: boolean`

ProgramAttendance:
- `id: string`
- `program_id: string`
- `visitor_id: string`
- `visit_id: string`
- `created_at: string`

### DashboardStats (대시보드 통계)

- `currentOccupancy: number`
- `totalVisitsToday: number`
- `averageDurationMinutes: number`

---

## 3. 키오스크용 API

### 3.1 휴대폰 번호로 회원 조회

`GET /api/kiosk/visitors/lookup?phone=01012345678`

응답:
- 200 OK: `{ visitor: Visitor | null }`

### 3.2 신규 회원 생성

`POST /api/kiosk/visitors`

요청:
```json
{
  "phone_number": "01012345678",
  "name": "홍길동",
  "birth_date": "1995-01-01",
  "address": "서울시 강동구 ...",
  "is_startup": true,
  "terms_accepted_at": "2025-01-01T10:00:00Z"
}
```

응답:
- 201 Created: `Visitor`

### 3.3 마지막 활성 방문 조회 (입실 중인지 확인)

`GET /api/kiosk/visitors/{visitorId}/active-visit`

응답:
- 200 OK: `{ visit: Visit | null }`

### 3.4 체크인

`POST /api/kiosk/visits/checkin`

요청:
```json
{
  "visitor_id": "vis_123",
  "purpose": "Study",
  "space_id": "space-coworking",
  "program_id": "program-startup-mentoring"
}
```

응답:
- 201 Created: `Visit`

### 3.5 체크아웃

`POST /api/kiosk/visits/{visitId}/checkout`

응답:
- 200 OK: `Visit` (체크아웃된 상태)

### 3.6 이용 정지 제재 여부 확인

`GET /api/kiosk/visitors/{visitorId}/active-penalty`

응답:
- 200 OK: `{ penalty: Penalty | null }` (type이 `"suspension"`이고 `active=true`인 제재)

### 3.7 사용 가능한 공간 목록 + 현재 점유

`GET /api/kiosk/spaces`

응답:
```json
[
  {
    "id": "space-coworking",
    "name": "코워킹 존",
    "capacity": 40,
    "type": "Coworking",
    "is_active": true,
    "currentOccupancy": 12
  }
]
```

### 3.8 진행 중 프로그램 목록 (행사 참여용)

`GET /api/kiosk/programs/active`

쿼리(옵션):
- `date=2025-01-01`

응답:
- 200 OK: `Program[]`

---

## 4. 관리자용 API

### 4.1 인증

예시:

- `POST /api/admin/auth/login`
  - 요청: `{ "email": "admin@example.com", "password": "..." }`
  - 응답: `{ "token": "JWT..." }`
- 이후 요청 헤더에 `Authorization: Bearer <token>`

### 4.2 대시보드 통계

`GET /api/admin/stats/summary?date=2025-01-01`

응답: `DashboardStats`

추가 통계:
- `GET /api/admin/stats/daily-trend?days=7`
  - 응답: `{ date: string; count: number }[]`
- `GET /api/admin/stats/heatmap?from=...&to=...`
  - 요일/시간대별 방문 수 매트릭스 (추후 확장)

### 4.3 실시간/전체 방문 목록

`GET /api/admin/visits/active`
- 응답: `Visit[]`

`GET /api/admin/visits?from=...&to=...&q=...`
- 이름/전화/목적/공간 등 필터
- 응답: `Visit[]`

### 4.4 회원 관리

`GET /api/admin/visitors?search=홍길동`
- 응답: `Visitor[]`

`GET /api/admin/visitors/{id}`
- 응답: `Visitor` + 누적 방문 수/시간, 제재 이력 등(확장)

`PATCH /api/admin/visitors/{id}`
- 요청: `{ name?, address?, is_startup?, notes? }`
- 응답: `Visitor`

### 4.5 제재/경고 관리

`GET /api/admin/visitors/{id}/penalties`
- 응답: `Penalty[]`

`POST /api/admin/visitors/{id}/penalties`

요청:
```json
{
  "type": "warning",
  "reason": "소란 행위"
}
```

또는:
```json
{
  "type": "suspension",
  "reason": "반복 규정 위반",
  "until": "2025-02-01T00:00:00Z"
}
```

응답:
- 201 Created: `Penalty`

`PATCH /api/admin/penalties/{penaltyId}`
- 활성/비활성 전환, 사유 수정 등

### 4.6 공간 관리

`GET /api/admin/spaces`
- 응답: `(Space & { currentOccupancy: number })[]`

`POST /api/admin/spaces`
- 요청: `{ name, capacity, type?, is_active? }`
- 응답: `Space`

`PATCH /api/admin/spaces/{id}`
- 요청: `{ name?, capacity?, is_active? }`
- 응답: `Space`

### 4.7 프로그램/이벤트 관리

`GET /api/admin/programs?from=...&to=...`
- 응답: `Program[]`

`POST /api/admin/programs`

요청:
```json
{
  "name": "스타트업 1:1 멘토링",
  "description": "초기 창업팀 대상",
  "start_at": "2025-01-05T14:00:00Z",
  "end_at": "2025-01-05T16:00:00Z",
  "capacity": 20
}
```

응답:
- 201 Created: `Program`

`GET /api/admin/programs/{id}/attendances`
- 응답: `ProgramAttendance[]` (+ `visitor` 조인 정보는 서버에서 join 하거나 추가 DTO로 반환)

---

## 5. 감사 로그 / 시스템 관리 (확장용)

향후 요구사항 반영 시 추가:

- `GET /api/admin/audit-logs?from=...&to=...&actor=...`
  - 관리자 로그인/설정 변경/회원정보 수정/제재 추가 등의 기록
- `GET/POST /api/admin/settings`
  - 회원 유형, 약관 버전, 기본 좌석 수, 운영 정책 등
- `GET /api/admin/admins` / `POST /api/admin/admins`
  - 관리자 계정/역할(Role) 관리

---

## 6. 프런트엔드 연동 포인트

현재 `services/dataService.ts`는 `mockDb`를 사용하지만, 실제 백엔드 구현 후에는:

- 동일한 함수 시그니처를 가진 `httpApiClient`를 만들고
- `dataService`에서 환경 변수(`VITE_API_MODE=http`)에 따라 `mockDb` 또는 `httpApiClient`를 선택하도록 구현하면, 프런트 코드 수정 없이 백엔드로 자연스럽게 전환할 수 있습니다.

이 파일은 그 `httpApiClient`가 호출해야 할 엔드포인트와 데이터 형식을 정의한 “참고 설계서” 역할을 합니다.

