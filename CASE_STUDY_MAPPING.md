# Case-Study Mapping

This document maps the delivered code to the standard case-study sections.

---

## 1. Architecture

**Three-tier architecture.**

```
┌──────────────────────────┐        ┌───────────────────────────┐        ┌──────────────┐
│  Presentation (React)    │  HTTP  │  Application (Node/Express)│  TCP   │  Data (Mongo)│
│  Vite + Bootstrap        │ ─────► │  REST API + PayPal service │ ─────► │  Mongoose    │
│  PayPal JS SDK (browser) │        │  OAuth 2.0, webhooks       │        │  User/Course │
└──────────────────────────┘        └─────────────┬─────────────┘        │  Order       │
             │                                     │ HTTPS                └──────────────┘
             │  PayPal JS SDK (renders buttons)    ▼
             └──────────────────────────►  PayPal REST API v2
```

- **Presentation tier** — `frontend/`. Renders courses, the PayPal buttons, and all
  payment states. Holds **no secrets**.
- **Application tier** — `backend/`. Owns all business rules, talks to PayPal with
  OAuth 2.0, verifies captures and webhooks, and persists orders.
- **Data tier** — MongoDB via Mongoose models in `backend/src/models/`.

**Key architectural decisions**

| Decision | Why | Code |
|---|---|---|
| Price read server-side | Never trust the client | `paymentController.createOrder` |
| Capture verified server-side | Prevent spoofed success | `paymentController.verifyCapture` |
| Webhooks as a second source of truth | Buyer may close the browser | `webhookController.handleWebhook` |
| Sandbox/live split by env var | No code change to go live | `config/env.js` |
| Central error shape | Consistent UX + debugging | `middleware/errorHandler.js` |

---

## 2. Database design

### `users` (User model — `backend/src/models/User.js`)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | primary key |
| `name` | String | required |
| `email` | String | required, unique, lowercase |
| `passwordHash` | String | bcrypt hash (never returned) |
| `role` | String | `user` \| `admin` |

### `courses` (Course model — `backend/src/models/Course.js`)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | primary key |
| `title`, `slug`, `description` | String | display |
| `price` | Number | **in cents** — the source of truth for the amount charged |
| `currency` | String | e.g. `USD` |
| `active` | Boolean | hide without deleting |

### `orders` (Order model — `backend/src/models/Order.js`)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | primary key |
| `userId` | ObjectId → User | who bought |
| `courseId` | ObjectId → Course | what was bought |
| `courseTitle` | String | snapshot at purchase time |
| `paypalOrderId` | String | PayPal order id |
| `captureId` | String | PayPal capture id (set on success) |
| `amount` | Number | cents, copied from the course |
| `currency` | String | e.g. `USD` |
| `paymentStatus` | Enum | `CREATED` `PENDING` `SUCCESS` `FAILED` `CANCELLED` `REFUNDED` |
| `courseAccess` | Enum | `YES` \| `NO` |
| `refundId`, `refundStatus`, `refundedAmount`, `refundReason` | — | refund tracking |
| `failureReason` | String | failed-payment tracking |
| `idempotencyKey` | String | duplicate-payment protection |
| `events[]` | Array | audit trail |

**On successful payment:** `paymentStatus = SUCCESS` and `courseAccess = YES`
(see `orderService.markOrderPaid`).

### `webhookevents` (WebhookEvent model)

Stores every received webhook (`eventId` unique) so retries are idempotent.

---

## 3. Actors

| Actor | Description | Entry point |
|---|---|---|
| **Buyer / Student** | Browses courses, pays with PayPal, views orders, requests refunds | `CourseListPage`, `CheckoutPage`, `OrderHistoryPage` |
| **Admin** | Views payments/refunds, downloads reports, cancels orders, executes refunds | `AdminDashboardPage` |
| **PayPal** | External system: hosts checkout, captures funds, sends webhooks | `paypalService.js`, `webhookController.js` |
| **System (backend)** | Validates, creates/captures orders, verifies, persists | `paymentController.js` |

---

## 4. User flow

```
Browse courses ──► Buy Now ──► (login if needed) ──► Checkout page
      │                                                    │
      │                          POST /create-order ───────┤ (server reads price)
      │                                                    ▼
      │                                          PayPal order created
      │                                                    │
      │                          PayPal JS SDK renders buttons
      │                                                    │
      │                          Buyer approves in PayPal window
      │                                                    │
      │                          onApprove ──► POST /capture-order
      │                                                    │
      │                          Server verifies capture (status + amount)
      │                                                    │
      │                          Order → SUCCESS, courseAccess → YES
      │                                                    ▼
      └──────────────────────────────  Payment Successful ──► Invoice
                                                             │
                                          Order history ◄────┤
                                          Refund request ◄───┘
```

**Alternate paths**

- Buyer cancels → `onCancel` → `POST /cancel-order` → **Payment Cancelled** screen.
- Capture fails → **Payment Failed** screen, order marked `FAILED` with a reason.
- Buyer closes browser after paying → PayPal webhook `PAYMENT.CAPTURE.COMPLETED`
  marks the order paid anyway.

---

## 5. Functional requirements

| # | Requirement | Status | Code |
|---|---|---|---|
| F1 | Course listing with Buy Now | ✅ | `CourseListPage.jsx` |
| F2 | `POST /create-order` validates user + course | ✅ | `paymentController.createOrder` |
| F3 | Price read server-side | ✅ | `course.price` used, never `req.body.price` |
| F4 | Call PayPal create-order API | ✅ | `paypalService.createPayPalOrder` |
| F5 | Persist + return PayPal order id | ✅ | `order.paypalOrderId` |
| F6 | PayPal JS SDK checkout with `onApprove` | ✅ | `CheckoutPage.jsx` |
| F7 | `POST /capture-order` calls PayPal capture | ✅ | `paymentController.captureOrder` |
| F8 | Verify capture server-side | ✅ | `paymentController.verifyCapture` |
| F9 | Update order: captureId, status, access | ✅ | `orderService.markOrderPaid` |
| F10 | Webhook `PAYMENT.CAPTURE.COMPLETED` | ✅ | `webhookController.processEvent` |
| F11 | Webhook signature verification | ✅ | `paypalService.verifyWebhookSignature` |
| F12 | Success / failure / cancel UI states | ✅ | `PaymentResultPage.jsx` |
| F13 | Order confirmation + invoice | ✅ | `OrderConfirmationPage.jsx` |
| F14 | Order history | ✅ | `OrderHistoryPage.jsx` |
| F15 | Refund request action | ✅ | `paymentController.requestRefund` |
| F16 | Admin: view payments & refunds | ✅ | `adminController.listPayments/listRefunds` |
| F17 | Admin: download reports | ✅ | `adminController.downloadPaymentsReport` |
| F18 | Admin: cancel orders | ✅ | `adminController.adminCancelOrder` |
| F19 | Admin: track failed payments | ✅ | `adminController.listFailedPayments` |
| F20 | Seedable sample data | ✅ | `scripts/seed.js` |

---

## 6. Security

| Concern | Mitigation | Code |
|---|---|---|
| Secret exposure | Client Secret only in backend env; browser gets only the public Client ID | `config/paypal.js`, `GET /api/config` |
| Price tampering | Amount read from the Course document, never from the request | `paymentController.createOrder` |
| Fake success | Capture verified server-side (status + amount + currency) | `paymentController.verifyCapture` |
| Forged webhooks | Signature verified with PayPal before processing | `paypalService.verifyWebhookSignature` |
| Duplicate payments | Idempotency key + open-order reuse + `ALREADY_PURCHASED` guard | `paymentController.createOrder` |
| Duplicate webhooks | Event id stored; repeats ignored | `webhookController`, `WebhookEvent` |
| Unauthorized access | JWT on user routes, role check on admin routes | `middleware/auth.js` |
| Brute force / abuse | Rate limiting on auth + payment endpoints | `middleware/rateLimit.js` |
| Common web attacks | Helmet headers, strict CORS | `app.js` |
| Inconsistent errors | One error shape everywhere | `middleware/errorHandler.js` |
| Secrets in git | `.env` git-ignored; only `.env.example` ships | `.gitignore` |
| Transport | HTTPS-ready (trust proxy, secure config) | `app.js`, README §12 |

---

## 7. Learning outcomes

By studying and running this project you will be able to:

1. **Integrate the PayPal REST API v2** — OAuth 2.0 client-credentials tokens, the
   Orders API (`create` / `capture`) and the Payments API (refunds).
2. **Build a secure payment flow** — server-side pricing, server-side capture
   verification, and webhook signature verification.
3. **Design a payment data model** — orders with status lifecycles, capture ids,
   access flags, refunds and an audit trail.
4. **Handle real-world edge cases** — cancellations, failures, duplicate payments,
   retried webhooks, and buyers who close the browser.
5. **Separate sandbox from live** cleanly via environment variables.
6. **Build a full-stack app** — React + Vite frontend, Express backend, MongoDB,
   JWT auth, and an admin dashboard with reporting.
7. **Ship a runnable project** — seed data, `.env.example`, and documented commands.

---

## 8. Steps that require YOUR credentials

| Step | What you provide | Where to paste it |
|---|---|---|
| 1 | MongoDB connection string | `backend/.env` → `MONGODB_URI` |
| 2 | PayPal **Client ID** | `backend/.env` → `PAYPAL_CLIENT_ID` |
| 3 | PayPal **Client Secret** | `backend/.env` → `PAYPAL_CLIENT_SECRET` |
| 4 | PayPal **Webhook ID** | `backend/.env` → `PAYPAL_WEBHOOK_ID` |
| 5 | Receiving account email | `backend/.env` → `PAYPAL_RECEIVING_ACCOUNT` |
| 6 | A random JWT secret | `backend/.env` → `JWT_SECRET` |

Once these six values are in `backend/.env`, the project is fully working.
No code edits are required.
