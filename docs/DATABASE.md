# Database Schema & Data Models

The system runs on MongoDB Atlas using Mongoose ODM with strong transactional consistency and strict compound indexing.

---

### 1. `User` Collection
Stores authenticated user records.
* `email`: `String` (unique, indexed, trimmed, lowercase)
* `passwordHash`: `String` (bcrypt hash with salt rounds = 12, `select: false`)
* `isActive`: `Boolean` (default: true)
* `createdAt`, `updatedAt`: Timestamps

---

### 2. `Wallet` & `WalletTransaction` Collection
Two-phase ledger tracking currency balances with atomic updates.
* **`Wallet`**:
  * `userId`: `ObjectId` (unique index per user)
  * `balances`: `{ VES: Number, INR: Number }` (updated strictly via atomic MongoDB `$inc`)
* **`WalletTransaction`**:
  * `userId`: `ObjectId`
  * `currency`: `String` (`VES` | `INR`)
  * `amount`: `Number`
  * `type`: `String` (`CREDIT` | `DEBIT`)
  * `source`: `String` (`DAILY_STREAK`)
  * `referenceId`: `String` (unique index, e.g. `STREAK-<cycleId>-<day>` for deterministic idempotency)
  * `balanceBefore`: `Number`
  * `balanceAfter`: `Number`
  * `createdAt`: Timestamp

---

### 3. `StreakReward` Collection
Central configuration table defining Day 1–7 rewards. Allows changing reward values without touching frontend code.
* `day`: `Number` (1 to 7, unique index)
* `rewardType`: `String` (`VES` | `Amazon Gift Card`)
* `currency`: `String` (`VES` | `INR`)
* `amount`: `Number` (e.g. 5, 10, 15, 1, 2, 30, 5)
* `title`: `String`
* `assetType`: `String` (`coin` | `gift-box` | `crown` | `gift-card`)
* `isUltimate`: `Boolean` (true for Day 7)
* `active`: `Boolean` (default: true)

---

### 4. `StreakCycle` Collection
Represents an ongoing 7-day streak attempt per user.
* `userId`: `ObjectId` (indexed)
* `cycleNumber`: `Number` (1, 2, 3...)
* `status`: `String` (`ACTIVE` | `COMPLETED` | `RESET`)
* `currentDay`: `Number` (1 to 7)
* `startedAt`: `Date`
* `lastClaimAt`: `Date`
* `nextClaimAt`: `Date` (server-enforced 24h rolling cooldown timestamp)
* **Indices**:
  * `{ userId: 1, status: 1 }` (guarantees fast active cycle lookups)

---

### 5. `StreakClaim` Collection
Immutable record of every successful reward claim.
* `userId`: `ObjectId`
* `cycleId`: `ObjectId`
* `day`: `Number` (1 to 7)
* `rewardId`: `ObjectId` (ref: StreakReward)
* `transactionId`: `String` (ref: WalletTransaction)
* `claimedAt`: `Date`
* `status`: `String` (`SUCCESS`)
* **Critical Unique Index**:
  * `index({ userId: 1, cycleId: 1, day: 1 }, { unique: true })`
  * **Anti-cheat guarantee**: If two simultaneous requests hit MongoDB at the exact same millisecond, only one can insert into `StreakClaim`; the other triggers an immediate `E11000` Duplicate Key exception and rolls back the session.

---

### 6. `AuditLog` Collection
Append-only log recording every lifecycle and security event.
* `userId`: `ObjectId`
* `eventType`: `String` (`STREAK_CLAIM_REQUEST`, `STREAK_CLAIM_SUCCESS`, `STREAK_CLAIM_REJECTED`, `STREAK_RESET`, `DUPLICATE_CLAIM`, `INVALID_CLAIM`)
* `detail`: `Object` (contextual metadata, diffs, timing records, error codes)
* `createdAt`: Timestamp
