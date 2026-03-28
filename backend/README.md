# Referral MLM — Backend API

Complete production-ready backend for a 5-level referral MLM system built with **Node.js + Express + Firebase (Firestore + Auth)**.

---

## 🚀 Quick Start

### 1. Setup Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/) → Create a project
2. Enable **Firestore** (Native mode)
3. Enable **Authentication** → Email/Password provider
4. Go to **Project Settings → Service Accounts** → Generate new private key → Save as `backend/firebase/serviceAccountKey.json`
5. Get your **Web API Key** from Project Settings → General

### 2. Configure Environment
```bash
cd backend
cp .env.example .env
# Fill in your values in .env
```

### 3. Install & Run
```bash
npm install
npm run dev        # Development (with nodemon)
npm start          # Production
```

Server runs on **http://localhost:5000**

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Register new user |
| POST | `/api/login` | Login, returns Firebase ID token |

### User *(requires Bearer token)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get own profile |
| GET | `/api/user/referrals` | Get own 5-level referral tree |

### Plan *(requires Bearer token)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/plan/buy` | Buy a plan (1000 or 2000) |

### Wallet *(requires Bearer token)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet` | Get balance & totalEarnings |
| GET | `/api/transactions` | Get transaction history |

### Deposit *(requires Bearer token)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deposit` | Submit deposit request |
| GET | `/api/deposit/history` | Own deposit history |

### Withdraw *(requires Bearer token)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/withdraw` | Request withdrawal |
| GET | `/api/withdraw/history` | Own withdrawal history |

### Admin *(requires Bearer token + admin role)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Stats overview |
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/users/:uid` | User details |
| PATCH | `/api/admin/block-user` | Block/unblock user |
| GET | `/api/admin/referrals/:uid` | User's referral tree |
| GET | `/api/admin/deposits` | All deposits |
| POST | `/api/admin/deposit/approve` | Approve/reject deposit |
| GET | `/api/admin/withdraws` | All withdrawals |
| POST | `/api/admin/withdraw/approve` | Approve/reject withdrawal |

---

## 🔐 Authentication

All protected routes require an `Authorization` header:
```
Authorization: Bearer <Firebase ID Token>
```

Get the ID token from the `/api/login` response `idToken` field.

---

## 🌳 Commission Structure (5 Levels)

| Level | 1000 Plan | 2000 Plan |
|-------|-----------|-----------|
| L1    | 10%       | 20%       |
| L2    | 7%        | 7%        |
| L3    | 5%        | 5%        |
| L4    | 3%        | 3%        |
| L5    | 2%        | 2%        |

---

## 📁 Project Structure

```
backend/
├── server.js                  # Entry point
├── .env.example               # Environment variable template
├── firebase/
│   ├── firebaseAdmin.js       # Firebase Admin SDK init
│   └── firestore.rules        # Firestore security rules
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── planRoutes.js
│   ├── walletRoutes.js
│   ├── depositRoutes.js
│   ├── withdrawRoutes.js
│   └── adminRoutes.js
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── planController.js
│   ├── walletController.js
│   ├── depositController.js
│   ├── withdrawController.js
│   └── adminController.js
├── services/
│   ├── commissionService.js   # 5-level commission distributor
│   └── walletService.js       # Credit/debit balance helpers
├── middlewares/
│   ├── authMiddleware.js      # Firebase token verification
│   ├── blockedCheck.js        # Blocked user guard
│   └── adminMiddleware.js     # Admin role check
└── utils/
    ├── generateReferralCode.js
    └── validators.js
```

---

## 🔒 Admin Setup

To make a user an admin, either:
- Set `ADMIN_EMAIL=youremail@example.com` in `.env` (easiest)
- OR manually set `role: 'admin'` in the user's Firestore document

---

## 📦 Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | All user profiles |
| `transactions` | Commission, deposit, withdraw logs |
| `deposits` | Deposit requests |
| `withdraws` | Withdrawal requests |
