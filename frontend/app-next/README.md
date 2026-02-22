# frontend/app-next

Next.js(App Router) + Fastify + TypeScript 기반 신규 프론트엔드입니다.

## 목적
- `frontend/web` 레거시 UI를 유지한 상태에서 병행 운영
- 로컬에서 기능 패리티 검증 후 전환

## 실행
```bash
cd frontend/app-next
npm install
npm run dev
```

- 기본 URL: `http://127.0.0.1:3100`
- API 기본 URL: `NEXT_PUBLIC_API_BASE_URL` (기본 권장: `http://127.0.0.1:3000`)

## 주요 스택
- Next.js + React + TypeScript
- Fastify(custom server)
- Tailwind CSS + shadcn 스타일 컴포넌트
- Recharts
- TanStack Query / TanStack Table
- Zustand

## 테스트
```bash
npm run test:e2e
```

Playwright 스모크 테스트:
- `/`
- `/rankings`
- `/analyzer`
