# Banking Ledger System API

A state-of-the-art, placement-oriented **Banking Ledger System** built with **Node.js, Express.js, MongoDB, and Mongoose**. 

This system is designed around the **Double-Entry Bookkeeping** principle. Accounts do not store static balances; instead, balances are calculated dynamically from an immutable ledger of Credit and Debit entries.

---

## 🏛️ Architecture & Core Financial Design

### 1. Dynamic Balance & Double-Entry Ledger
*   Balances are calculated as: 
    $$\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$$
*   Money is never deleted or directly edited in the database. Every financial event creates two offsetting ledger entries (one **Debit** and one **Credit**).
*   Any correction requires a compensating reversal transaction, maintaining full audibility.

### 2. Transactional Integrity (ACID)
*   Uses MongoDB/Mongoose Sessions (`startTransaction`) to guarantee that all ledger updates and audit trail creations succeed together, or roll back entirely.

### 3. Concurrency & Idempotency
*   Ensures safety against double-clicks and network retries using an `idempotencyKey` unique index constraint on the `Transaction` collection. A pending transaction status is claimed outside the session block to secure the key, preventing concurrent race conditions.

---

## 🛠️ Tech Stack & Setup

### Prerequisites
*   Node.js (v16+)
*   MongoDB Instance (Atlas or Local)

### Setup Steps
1.  **Clone & Install Dependencies:**
    ```bash
    cd backend
    npm install
    ```
2.  **Environment Setup:**
    Configure your environment values by creating a `.env` file (see `.env.example` for details):
    ```bash
    cp .env.example .env
    ```
3.  **Seed System User & Account:**
    Seed the mandatory single system account that represents the bank:
    ```bash
    npm run seed-system-user
    ```
4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

---

## 📂 Core Models Schema

### Account
*   `user`: Ref User (Owner of account)
*   `status`: `"Active" | "Frozen" | "Closed"`
*   `currency`: String (3-letter code, e.g. `"INR"`)
*   `getBalance(session)`: Custom instance method that aggregates ledger entries.

### Ledger (Immutable)
*   `account`: Ref Account
*   `amount`: Number (stored as positive integers in minor units, e.g., cents/paise)
*   `transaction`: Ref Transaction
*   `type`: `"Credit" | "Debit"`

### Transaction
*   `fromAccount`: Ref Account
*   `toAccount`: Ref Account
*   `amount`: Number
*   `type`: `"Transfer" | "Deposit" | "Withdrawal" | "Initial_Funding"`
*   `status`: `"Pending" | "Completed" | "Failed" | "Reversed"`
*   `idempotencyKey`: String (unique)

---

## 🔌 API Route Reference

### 🔐 1. Authentication (`/api/v1/auth`)

#### 📝 Register User
*   **Method**: `POST`
*   **Route**: `/register`
*   **Body**:
    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "password": "Password123"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "User registered successfully"
    }
    ```

#### 🔑 Login User
*   **Method**: `POST`
*   **Route**: `/login`
*   **Body**:
    ```json
    {
      "email": "jane@example.com",
      "password": "Password123"
    }
    ```
*   **Response (200 OK)**:
    Sets HTTP-only cookie `accessToken` and returns user data:
    ```json
    {
      "status": "success",
      "message": "Logged in successfully",
      "data": { "userId": "...", "name": "Jane Doe", "email": "..." }
    }
    ```

#### 🚪 Logout User
*   **Method**: `POST`
*   **Route**: `/logout`
*   **Headers**: Requires `Cookie: accessToken=...` or `Authorization: Bearer <token>`
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Logged out successfully"
    }
    ```

#### 🔄 Refresh Token
*   **Method**: `POST`
*   **Route**: `/refresh`
*   **Response (200 OK)**: Re-issues a transient access token cookie.

#### 👤 Get Current User Profile (Me)
*   **Method**: `GET`
*   **Route**: `/me`
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "_id": "60d5ec49f7e8a932d4310d54",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "createdAt": "2026-07-02T10:11:48.000Z",
        "updatedAt": "2026-07-02T10:11:48.000Z"
      }
    }
    ```

#### 🔒 Change Password
*   **Method**: `PATCH`
*   **Route**: `/change-password`
*   **Body**:
    ```json
    {
      "oldPassword": "CurrentPassword123",
      "newPassword": "NewSecurePassword456"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Password changed successfully"
    }
    ```

---

### 💳 2. Account Management (`/api/v1/accounts`)
*   *Note: All account endpoints require user authentication (bearer token or cookie).*

#### 🆕 Create Account
*   **Method**: `POST`
*   **Route**: `/`
*   **Body**:
    ```json
    {
      "currency": "INR"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Account created and initialized successfully",
      "data": { 
        "_id": "...", 
        "user": "...", 
        "currency": "INR", 
        "status": "Active",
        "balance": 100000,
        "createdAt": "...",
        "updatedAt": "..."
      }
    }
    ```

#### 📋 Get All Accounts
*   **Method**: `GET`
*   **Route**: `/`
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Accounts retrieved successfully",
      "data": [ ... ]
    }
    ```

#### 🔍 Get Account Details
*   **Method**: `GET`
*   **Route**: `/:accountId`
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Account details retrieved successfully",
      "data": {
        "_id": "60d5ec49f7e8a932d4310d51",
        "user": "60d5ec49f7e8a932d4310d54",
        "status": "Active",
        "currency": "INR",
        "balance": 15000,
        "createdAt": "2026-07-02T10:11:48.000Z",
        "updatedAt": "2026-07-02T10:11:48.000Z"
      }
    }
    ```

#### ❄️ Update Account Status (Freeze/Unfreeze)
*   **Method**: `PATCH`
*   **Route**: `/:accountId`
*   **Body**:
    ```json
    {
      "status": "Frozen"
    }
    ```
    *(Allowed values: `"Active"`, `"Frozen"`, `"Closed"`)*
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Account status updated successfully",
      "data": {
        "_id": "60d5ec49f7e8a932d4310d51",
        "status": "Frozen",
        "currency": "INR",
        "balance": 15000
      }
    }
    ```

---

### 💸 3. Transactions & Ledger Engine (`/api/v1/transactions`)
*   *Note: All endpoints require authentication.*

#### 🔄 Create Transfer (User ➔ User)
*   **Method**: `POST`
*   **Route**: `/create`
*   **Body**:
    ```json
    {
      "fromAccount": "66a01...",
      "toAccount": "66a02...",
      "amount": 5000,
      "idempotencyKey": "uuid-v4-key-here"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "message": "Transaction completed successfully",
      "transaction": { "_id": "...", "type": "Transfer", "status": "Completed" }
    }
    ```

#### 📥 Deposit Money (System ➔ User Account)
*   **Method**: `POST`
*   **Route**: `/deposit`
*   **Body**:
    ```json
    {
      "accountId": "66a01...",
      "amount": 25000,
      "idempotencyKey": "uuid-v4-key-here"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "message": "Deposit completed successfully",
      "transaction": { "_id": "...", "type": "Deposit", "status": "Completed" }
    }
    ```

#### 📤 Withdraw Money (User Account ➔ System)
*   **Method**: `POST`
*   **Route**: `/withdraw`
*   **Body**:
    ```json
    {
      "accountId": "66a01...",
      "amount": 10000,
      "idempotencyKey": "uuid-v4-key-here"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "message": "Withdrawal completed successfully",
      "transaction": { "_id": "...", "type": "Withdrawal", "status": "Completed" }
    }
    ```

#### 📋 Transaction History & Statement
*   **Method**: `GET`
*   **Route**: `/`
*   **Query Parameters**:
    *   `accountId` (optional): Filter by specific account.
    *   `type` (optional): `"Transfer" | "Deposit" | "Withdrawal" | "Initial_Funding"`.
    *   `page` (optional, default: `1`).
    *   `limit` (optional, default: `10`).
    *   `startDate` / `endDate` (optional): ISO Dates.
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "transactions": [ ... ],
        "pagination": {
          "totalDocs": 45,
          "limit": 10,
          "page": 1,
          "totalPages": 5,
          "hasNextPage": true,
          "hasPrevPage": false
        }
      }
    }
    ```

#### 🔍 Get Single Transaction Details
*   **Method**: `GET`
*   **Route**: `/:transactionId`
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "_id": "60d5ec49f7e8a932d4310d54",
        "fromAccount": {
          "_id": "60d5ec49f7e8a932d4310d51",
          "currency": "INR",
          "status": "Active"
        },
        "toAccount": {
          "_id": "60d5ec49f7e8a932d4310d52",
          "currency": "INR",
          "status": "Active"
        },
        "amount": 5000,
        "type": "Transfer",
        "status": "Completed",
        "idempotencyKey": "uuid-v4-key-here",
        "createdAt": "2026-07-02T10:11:48.000Z",
        "updatedAt": "2026-07-02T10:11:48.000Z"
      }
    }
    ```

---

## 🎯 Interview Highlights (Resumé Pitch points)
When presenting this project to technical recruiters, emphasize these key highlights:
1.  **Immutability**: Explain how ledger records are immutable (secured using schema hooks in Mongoose to block modifications/deletions).
2.  **Atomicity**: Discuss the use of `startSession` to implement ACID transactions across multiple ledger and audit trail documents.
3.  **Idempotency & Race Conditions**: Explain how you claim the idempotency key outside the transaction block to handle overlapping parallel request collisions.
4.  **Dynamic Ledger Math**: Clarify that balance fields are not stored dynamically, protecting the data from drift bugs and providing a complete chronological statement audit.
