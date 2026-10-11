# API Documentation

All endpoints (except `/api/auth/*`) require a valid JWT token in the `Authorization: Bearer <token>` header.

---

### 1. `POST /api/auth/register`
Registers a new user and provisions their initial wallet.
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "66f5a3b2e7c4b1234567890a"
  }
  ```

---

### 2. `POST /api/auth/login`
Authenticates a user and issues a JWT token.
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "66f5a3b2e7c4b1234567890a"
  }
  ```

---

### 3. `GET /api/daily-streak`
Fetches full streak status, 7-day card array, countdown timers, and wallet balances. Evaluates missed windows automatically.
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "serverTime": "2026-10-11T12:00:00.000Z",
    "streak": {
      "currentStreak": 1,
      "currentDay": 2,
      "checkedIn": 1,
      "totalRewards": 7,
      "nextClaimAt": "2026-10-12T12:00:00.000Z",
      "remainingMs": 86400000,
      "status": "ACTIVE",
      "cycleNumber": 1
    },
    "rewards": [
      {
        "day": 1,
        "status": "CLAIMED",
        "reward": {
          "currency": "VES",
          "amount": 5,
          "title": "Day 1 Reward",
          "assetType": "coin",
          "isUltimate": false
        }
      },
      {
        "day": 2,
        "status": "TODAY_LOCKED",
        "reward": {
          "currency": "VES",
          "amount": 10,
          "title": "Day 2 Reward",
          "assetType": "coin",
          "isUltimate": false
        }
      }
    ],
    "wallet": {
      "balances": {
        "VES": 5,
        "INR": 0
      }
    }
  }
  ```

---

### 4. `GET /api/daily-streak/status`
Lightweight polling endpoint to verify unlock readiness when client countdown reaches zero.
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):** Same payload as `GET /api/daily-streak`.

---

### 5. `POST /api/daily-streak/claim`
Claims today's reward. Strictly rate-limited and protected by database transactions with unique compound indexing.
* **Headers:** 
  * `Authorization: Bearer <token>`
  * `Idempotency-Key: REQ-1728648000-abc123` *(optional client trace)*
* **Body:** `{}` *(Any payload like { day: 7 } is ignored; server derives day from cycle)*
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "serverTime": "2026-10-11T12:00:00.000Z",
    "day": 1,
    "reward": {
      "day": 1,
      "type": "VES",
      "currency": "VES",
      "amount": 5,
      "title": "Day 1 Reward",
      "assetType": "coin"
    },
    "streak": {
      "currentStreak": 1,
      "currentDay": 2,
      "status": "ACTIVE"
    },
    "wallet": {
      "balances": {
        "VES": 5,
        "INR": 0
      }
    }
  }
  ```
* **Failure Response Examples:**
  * **Already Claimed / Duplicate (409 Conflict):**
    ```json
    { "success": false, "code": "ALREADY_CLAIMED", "message": "This reward has already been claimed." }
    ```
  * **Cooldown Active (403 Forbidden):**
    ```json
    { "success": false, "code": "REWARD_COOLDOWN", "message": "Reward is currently on cooldown. Please wait until unlock time." }
    ```
  * **Missed Window Expired (400 Bad Request):**
    ```json
    { "success": false, "code": "STREAK_RESET", "message": "Your claim window expired. Streak has been reset to Day 1." }
    ```

---

### 6. `GET /api/daily-streak/wallet`
Returns user balance for real-time header display.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "balances": {
      "VES": 5,
      "INR": 0
    }
  }
  ```

---

### 7. `GET /api/daily-streak/history`
Paginated audit history of past claims.
* **Query Params:** `?page=1&limit=10`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "claims": [
      {
        "day": 1,
        "claimedAt": "2026-10-11T12:00:00.000Z",
        "transactionId": "STREAK-TX-1728648000",
        "rewardId": { "title": "Day 1 Reward", "amount": 5, "currency": "VES" }
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 10, "pages": 1 }
  }
  ```
