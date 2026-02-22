# TODO Frontend V2 Cutover Runbook

## 1) Parallel Run
- [ ] Keep legacy UI at `frontend/web` (current production)
- [ ] Run new UI at `frontend/app-next` on `:3100`
- [ ] Validate same API backend with identical dataset

## 2) Validation Checklist
- [ ] Replay preview/upload flow
- [ ] Current user selection persistence
- [ ] Recent games paging/select/detail
- [ ] Rankings 3v3 sort/refresh
- [ ] Race composition table sort/refresh
- [ ] Analyzer game selector + detail tabs
- [ ] Player stats query + suggestion

## 3) Local Regression
- [ ] Start backend on `127.0.0.1:3000`
- [ ] Start frontend v2 on `127.0.0.1:3100`
- [ ] Run Playwright smoke tests
- [ ] Capture mismatch list vs legacy

## 4) Railway Staging Cutover
- [ ] Deploy `frontend/app-next` as separate service or route
- [ ] Point API base URL to same production API
- [ ] Verify no CORS/security regression
- [ ] Run live smoke checklist

## 5) Production Cutover
- [ ] Switch traffic entrypoint to v2 (`/` or dedicated domain)
- [ ] Keep legacy route alive as rollback target for 1 release window
- [ ] Monitor API error rate / UI console error / upload failure rate

## 6) Rollback Plan
- [ ] Revert route/domain to legacy UI immediately
- [ ] Keep backend unchanged
- [ ] Record failure scenario and patch v2

## 7) Exit Criteria
- [ ] 7-day error budget 안정
- [ ] 핵심 플로우 이슈 0건
- [ ] 운영팀 승인 후 legacy sunset 계획 시작
