<div align="center">

# 🏛️ Core Banking & Double-Entry Ledger System API

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.2.1-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_v9-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![JWT Auth](https://img.shields.io/badge/JWT-Dual_Token_Auth-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white)](https://jwt.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](https://opensource.org/licenses/ISC)

<p align="center">
  A production-grade, placement-oriented <b>Core Banking & Ledger REST API</b> built with <b>Node.js, Express, MongoDB, and Mongoose</b>. Engineered around the <b>Double-Entry Bookkeeping</b> principle with <b>ACID Transactions</b>, <b>Two-Phase Idempotency</b>, and <b>Enterprise-Grade Security</b>.
</p>

</div>

---

## 📑 Table of Contents
- [🏛️ Architectural Highlights](#️-architectural-highlights)
- [🛠️ Tech Stack & Key Libraries](#️-tech-stack--key-libraries)
- [🔄 System Architecture & Data Flow](#-system-architecture--data-flow)
- [📊 Financial Ledger & Money Movement](#-financial-ledger--money-movement)
- [🛡️ Security Architecture](#️-security-architecture)
- [🗄️ Database Schema & Entities](#️-database-schema--entities)
- [🔌 API Route Reference](#-api-route-reference)
- [🚀 Quickstart & Setup Guide](#-quickstart--setup-guide)

---

## 🏛️ Architectural Highlights

### 1. Dynamic Balances & Double-Entry Bookkeeping
* **Zero Mutable Balances:** Accounts do not store static balance numbers. Balance is computed on-the-fly from immutable ledger records:
  $$\text{Live Balance} = \sum(\text{Total Credits}) - \sum(\text{Total Debits})$$
* **Strict Immutability:** Ledger records are append-only. Mongoose schema lifecycle hooks explicitly block `updateOne`, `deleteMany`, `save` on existing entries, and `findOneAndUpdate`.

### 2. Multi-Document ACID Transactions
* All financial operations (Transfers, Deposits, Withdrawals, Initial Funding) execute inside **MongoDB replica sessions** (`mongoose.startSession()`).
* If currency verification, account status validation, or balance checks fail, the entire transaction is rolled back via `session.abortTransaction()`.

### 3. Two-Phase Idempotency Engine
* Guarantees zero duplicate charges during network retries or client double-clicks.
* Enforces a two-phase protocol: checks existing `idempotencyKey` $\rightarrow$ pre-claims key as `Pending` outside session block $\rightarrow$ executes transfer $\rightarrow$ marks `Completed`.

### 4. Minor Unit Currency Arithmetic
* Modeled after payment gateway standards (**Stripe & Razorpay**).
* Amounts are strictly validated with `Number.isSafeInteger` and stored in minor units (e.g. ₹10.50 is stored as `1050` paise), eliminating IEEE 754 floating-point rounding errors.

---

## 🛠️ Tech Stack & Key Libraries

| Technology | Role in Project | Engineering Rationale |
| :--- | :--- | :--- |
| **Node.js (v18+)** | Runtime Engine | Event-driven, non-blocking asynchronous I/O ideal for scalable financial request processing. |
| **Express.js 5** | REST API Framework | Minimalist routing, middleware pipelines, and native asynchronous error propagation. |
| **MongoDB & Mongoose 9** | Database & ODM | Schema validation, aggregation pipelines, and multi-document ACID transaction sessions. |
| **JSON Web Tokens (JWT)** | Authentication | Stateless dual-token authentication (15m access token + 7d refresh token) in HttpOnly cookies. |
| **Bcrypt.js** | Cryptography | One-way cryptographic salting and hashing for passwords and refresh token hashes in MongoDB. |
| **Express Rate Limit** | Ingress Defense | Rate limiting on authentication (50 reqs/15m) and transaction endpoints (100 reqs/15m). |
| **Nodemailer** | Notification Engine | Automated dispatch of transactional email receipts with OAuth2 and mock console fallback. |

---

## 🔄 System Architecture & Data Flow

```
[ Client / Browser / Mobile App ]
               │
               │ HTTP Request + HttpOnly Cookie Credentials
               ▼
┌────────────────────────────────────────────────────────┐
│                   EXPRESS PIPELINE                     │
│  • express.json() ──► cookieParser() ──► cors()        │
│  • express-rate-limit (Brute-force & DDoS defense)     │
│  • authMiddleware (Verifies JWT & checks Blacklist)    │
└────────────────────────────┬───────────────────────────┘
                             │
                             │ Validated req.user + Payload
                             ▼
┌────────────────────────────────────────────────────────┐
│                     CONTROLLERS                        │
│  • Parameter format validation (ObjectIDs, Integers)   │
│  • Account ownership checks (`sourceAcc.user == user`) │
│  • Response serialization (Minor units + Formatted)   │
└────────────────────────────┬───────────────────────────┘
                             │
                             │ Business Logic Delegation
                             ▼
┌────────────────────────────────────────────────────────┐
│                      SERVICES                          │
│  • Idempotency pre-claim & race condition handling     │
│  • MongoDB Session (`session.startTransaction()`)      │
│  • Dynamic Balance Check (`getBalance(session)`)       │
│  • Commit / Rollback coordination                      │
│  • Async email receipt dispatch                        │
└────────────────────────────┬───────────────────────────┘
                             │
                             │ Mongoose CRUD & Aggregations
                             ▼
┌────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                       │
│  • Users ──► Accounts ──► Transactions ──► Ledgers     │
│  • Blacklist Model (TTL index for auto-cleanup)        │
│  • Pre-save immutability guards                        │
└────────────────────────────────────────────────────────┘
```

---

## 📊 Financial Ledger & Money Movement

### Real-World Example: Michael transfers ₹2,000 to Rahul

```
Michael (Initial Balance: ₹10,000)        Rahul (Initial Balance: ₹5,000)
             │                                         │
             ▼                                         ▼
┌───────────────────────────────────────────────────────────────────┐
│                 MONGODB ACID TRANSACTION SESSION                  │
│                                                                   │
│ 1. Verify Michael dynamic balance >= ₹2,000 (10,000 >= 2,000) ✅  │
│ 2. Verify both accounts are "Active" and currency is "INR"     ✅  │
│ 3. Create DEBIT  Ledger Entry for Michael:   -₹2,000           ✅  │
│ 4. Create CREDIT Ledger Entry for Rahul:     +₹2,000           ✅  │
│ 5. Update Transaction status: "Completed"                      ✅  │
│ 6. Commit Session (Atomic all-or-nothing execution)            ✅  │
└───────────────────────────────────────────────────────────────────┘
             │                                         │
             ▼                                         ▼
Michael's Balance: ₹8,000                 Rahul's Balance: ₹7,000
```

### System Counterparty Operations
* **Deposit (Cash $\rightarrow$ Account):** Central Bank System Account is **Debited**; User Account is **Credited**.
* **Withdrawal (Account $\rightarrow$ Cash):** User Account is **Debited**; Central Bank System Account is **Credited**.
* **Initial Funding:** Seeded bank account funds ₹1,000 bonus on opening a new bank account.

---

## 🛡️ Security Architecture

1. **HttpOnly & SameSite Cookies:** Access and refresh tokens are stored exclusively in `HttpOnly`, `SameSite: "lax"` cookies, eliminating JavaScript **Cross-Site Scripting (XSS)** token extraction.
2. **Active Token Blacklisting:** On user logout, the active `accessToken` is recorded in the `Blacklist` collection. The `authMiddleware` verifies incoming tokens against the blacklist, terminating access instantly. A MongoDB **TTL index** auto-deletes expired records after 3 days.
3. **Database-Level Refresh Token Salting:** Refresh tokens are hashed via **bcrypt** before persistence in MongoDB, neutralizing token replay attacks even if the database is leaked.
4. **Self-Transfer & Ownership Protection:** All operations strictly verify account ownership against `req.user._id` and reject transfers to the same source account (`400 Bad Request`).
5. **Rate Limiting:** Protects `/api/v1/auth` and `/api/v1/transactions` against automated dictionary attacks and rapid-fire API abuse.

---

## 🗄️ Database Schema & Entities

```
┌──────────────┐         1 : N         ┌─────────────────┐
│     User     ├──────────────────────►│     Account     │
└──────┬───────┘                       └────────┬────────┘
       │                                        │ 1
       │                                        │
       │                                        │ N (fromAccount / toAccount)
       │                                        ▼
       │                               ┌─────────────────┐
       │                               │   Transaction   │
       │                               └────────┬────────┘
       │                                        │ 1
       │                                        │
       │                                        │ 2 (One Debit, One Credit)
       │                                        ▼
       │                               ┌─────────────────┐
       └──────────────────────────────►│     Ledger      │
                                       │   (Immutable)   │
                                       └─────────────────┘
```

---

## 🔌 API Route Reference

### 🔐 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Purpose | Request Body |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/register` | Public | Create user, hash password, set cookies | `{ "name": "Jane Doe", "email": "jane@example.com", "password": "Password123" }` |
| `POST` | `/login` | Public | Verify credentials, issue tokens in cookies | `{ "email": "jane@example.com", "password": "Password123" }` |
| `POST` | `/refresh` | Cookie | Issue new Access Token using Refresh Token | None (Reads `refreshToken` cookie) |
| `POST` | `/logout` | Private | Blacklist token, clear cookies, unset DB hash | None |
| `GET` | `/me` | Private | Get authenticated user profile | None |
| `PATCH`| `/change-password`| Private | Update current password | `{ "oldPassword": "...", "newPassword": "..." }` |

---

### 💳 2. Account Management (`/api/v1/accounts`)

| Method | Endpoint | Access | Purpose | Sample Response |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/` | Private | Open new bank account + ₹1,000 bonus | `{ "currency": "INR", "balanceMinor": 100000, "balance": 1000, "formattedBalance": "₹1,000.00" }` |
| `GET` | `/` | Private | List all user accounts with dynamic balances | `[ { "_id": "...", "currency": "INR", "balance": 1000, "formattedBalance": "₹1,000.00" } ]` |
| `GET` | `/:accountId` | Private | Get single account details & live balance | `{ "_id": "...", "balanceMinor": 100000, "formattedBalance": "₹1,000.00" }` |
| `PATCH`| `/:accountId` | Private | Freeze / Unfreeze account status | `{ "status": "Frozen", "formattedBalance": "₹1,000.00" }` |

---

### 💸 3. Transactions & Ledger Engine (`/api/v1/transactions`)

| Method | Endpoint | Access | Purpose | Request Body |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/create` | Private | Transfer money (User $\rightarrow$ User) | `{ "fromAccount": "...", "toAccount": "...", "amount": 5000, "idempotencyKey": "uuid-v4" }` |
| `POST` | `/deposit` | Private | Deposit cash (System $\rightarrow$ User) | `{ "accountId": "...", "amount": 25000, "idempotencyKey": "uuid-v4" }` |
| `POST` | `/withdraw`| Private | Withdraw cash (User $\rightarrow$ System) | `{ "accountId": "...", "amount": 10000, "idempotencyKey": "uuid-v4" }` |
| `GET` | `/` | Private | Paginated statement (`?page=1&limit=10`) | Returns paginated list with minor units and formatted strings |
| `GET` | `/:transactionId` | Private | Fetch single transaction receipt | Populated account metadata + formatted currency |

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
* **Node.js**: v18.0.0 or higher
* **MongoDB**: Atlas Cluster or Local MongoDB instance (v6.0+ recommended for replica sessions)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/banking-system.git
cd banking-system/backend

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `backend/` directory (see `.env.example`):
```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/banking_system?retryWrites=true&w=majority

ACCESS_TOKEN_SECRET=your_super_secret_access_key_256bit
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_256bit
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d

CLIENT_URL=http://localhost:5173

# Optional: Nodemailer OAuth2 Credentials (Fallback to console mock if omitted)
EMAIL_USER=system@bank.com
CLIENT_ID=your_oauth2_client_id
CLIENT_SECRET=your_oauth2_client_secret
REFRESH_TOKEN=your_oauth2_refresh_token
```

### 4. Seed Central Banking System User & Account
```bash
npm run seed-system-user
```

### 5. Run Server
```bash
# Development Mode (with nodemon)
npm run dev

# Production Mode
npm start
```

---

<div align="center">
  <sub>Engineered with precision for Core Banking & FinTech System Design.</sub>
</div>
