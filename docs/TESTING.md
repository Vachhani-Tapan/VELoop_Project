# Structured Testing Report

This report documents the results of the 15 automated core anti-cheat and concurrency test scenarios implemented in `backend/src/__tests__/streak.full.test.js`.

---

### Test Suite Execution Summary
* **Test Runner:** Jest 29.7
* **Environment:** Node.js with replica-set MongoDB transactions (`mongodb-memory-server`)
* **Total Test Suites:** 3 passed
* **Total Automated Tests:** 24 passed (100%)

---

### Core Anti-Cheat Scenarios Checklist

| # | Scenario | Test Action | Expected Result | Actual Result | Status |
|---|:---|:---|:---|:---|:---:|
| 1 | **Day 1 Happy Path** | Fresh user calls `POST /claim` on Day 1. | Day 1 credited (5 VES), cycle starts, `nextClaimAt = now + 24h`. | 200 OK, Day 1 claimed, 5 VES credited. | PASS ✅ |
| 2 | **Cooldown Gate (23h59m)** | Claim at 23 hours and 59 minutes after last claim. | Rejected with `403 REWARD_COOLDOWN`. Balance unchanged. | 403 Forbidden, code `REWARD_COOLDOWN`. | PASS ✅ |
| 3 | **Interval Boundary (24h)** | Claim at exactly 24 hours after last claim. | Allowed. Day advances to Day 2, credited (10 VES). | 200 OK, Day 2 claimed, total 15 VES. | PASS ✅ |
| 4 | **Grace Window (25h)** | Claim at 25 hours after last claim (within 24h grace). | Allowed. Streak continues unbroken to Day 2. | 200 OK, streak maintained at 2. | PASS ✅ |
| 5 | **Missed Window (49h)** | Claim after 49 hours (past 24h interval + 24h grace). | Rejects with `400 STREAK_RESET`. Resets streak to Day 1. | 400 Bad Request, code `STREAK_RESET`. | PASS ✅ |
| 6 | **20 Concurrent Requests** | 20 simultaneous claim requests fired in parallel. | Exactly 1 succeeds (200), 19 receive conflict (409). Wallet credited once. | Exactly 1 success, 19 conflicts, exactly 1 DB credit. | PASS ✅ |
| 7 | **Multiple Tokens Double-Claim** | User logs into two devices, tries claiming with both tokens. | First token succeeds, second token rejected with `409 ALREADY_CLAIMED`. | Token 1 gets 200, Token 2 gets 409 `ALREADY_CLAIMED`. | PASS ✅ |
| 8 | **Payload Tampering** | Client sends malicious `{ day: 7, amount: 100000, currency: "INR" }`. | Client payload ignored. Server grants configured Day 1 reward (5 VES). | 200 OK, Day 1 (5 VES) granted. | PASS ✅ |
| 9 | **Missing / Invalid Auth** | Claim request with missing or fake JWT. | Rejected with `401 UNAUTHORIZED`. | 401 Unauthorized, code `UNAUTHORIZED`. | PASS ✅ |
| 10 | **Mid-Transaction Failure** | Simulated database crash during wallet credit step. | Entire transaction rolls back; no claim or transaction persisted. | 500 Internal Server Error, zero claims or wallet entries written. | PASS ✅ |
| 11 | **Repeated Idempotent Claim** | User sends second claim immediately after success. | Second request returns `409 ALREADY_CLAIMED` without double-crediting. | 409 Conflict, code `ALREADY_CLAIMED`, balance remains 5 VES. | PASS ✅ |
| 12 | **Concurrent First Claims** | 10 concurrent claim requests for brand-new user without prior GET. | Exactly 1 active cycle created, exactly 1 claim succeeds. | Exactly 1 active cycle in DB, 1 claim. | PASS ✅ |
| 13 | **Transient Conflict Retry** | Simulated MongoDB WriteConflict error (code 112). | Service automatically retries transaction and succeeds cleanly. | 200 OK after retry, `attempts >= 2`. | PASS ✅ |
| 14 | **Day-Skip Attempt** | Client sends `{ day: 5 }` on Day 1. | Server ignores request body, grants Day 1. | 200 OK, grants Day 1 reward. | PASS ✅ |
| 15 | **Cross-User Data Isolation** | User A tries to read or claim User B's cycle. | State derived strictly from JWT `userId`. User A cannot alter User B. | User A streak unaffected by User B. | PASS ✅ |
