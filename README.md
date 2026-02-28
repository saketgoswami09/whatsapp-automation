# 🤖 WhatsApp Automation Backend

> An intelligent WhatsApp business automation system powered by AI — built to help small businesses handle customer conversations, qualify leads, and process documents automatically, all through WhatsApp.

---

## 📌 What This Project Does

This is the **backend server** for a WhatsApp Automation SaaS platform. When a customer sends a WhatsApp message to a business, this system:

1. **Receives the message** via a Meta (WhatsApp Business API) webhook
2. **Understands the intent** using rule-based detection (greetings, pricing, support, etc.)
3. **Responds automatically** using an AI model (OpenAI-compatible) if no rule matches
4. **Tracks the conversation** and qualifies the contact as a lead
5. **Lets a human agent take over** if the conversation needs personal attention
6. **Processes documents** (invoices, ID cards, etc.) sent by the customer using OCR
7. **Provides analytics** to the business owner via a dashboard API

---

## 🏗️ System Architecture

```
WhatsApp User
      │
      ▼
Meta Webhook (POST /webhook)
      │
      ├──► Rule-Based Intent Engine  ──► Instant response (no AI cost)
      │
      └──► AI Service (OpenAI API)   ──► Smart contextual response
                  │
                  ├── Redis  → Conversation memory (30-min TTL)
                  ├── Redis  → Daily token budget tracking
                  └── Redis  → Per-user hourly rate limiting
                  
All data → MongoDB (Users, Conversations, Messages, Leads, Documents)
Background Jobs → Bull Queue + Redis (scheduled tasks, follow-ups)
File Uploads → Cloudinary (images, PDFs)
OCR → Tesseract.js (extract text from uploaded images/documents)
```

---

## 🗂️ Folder Structure

```
src/
├── app.js                  # Express app setup, middleware, route registration
├── config/
│   ├── db.js               # MongoDB connection
│   ├── redis.js            # Redis (ioredis) connection
│   └── env.js              # Environment variable validation (Joi)
│
├── routes/                 # API route definitions
│   ├── webhook.js          # /webhook  — Meta WhatsApp webhook handler
│   ├── auth.js             # /api/auth — Login, register
│   ├── users.js            # /api/users
│   ├── conversations.js    # /api/conversations
│   ├── leads.js            # /api/leads
│   ├── documents.js        # /api/documents (upload + OCR)
│   ├── analytics.js        # /api/analytics
│   └── settings.js         # /api/settings
│
├── controllers/            # Request handlers (thin layer, calls services)
│   ├── authController.js
│   ├── conversationController.js
│   ├── leadController.js
│   ├── documentController.js
│   ├── analyticsController.js
│   ├── settingsController.js
│   └── userController.js
│
├── services/               # Core business logic
│   ├── aiService.js        # 🧠 AI response engine (rule-based + LLM fallback)
│   ├── conversationService.js
│   ├── leadService.js
│   └── documentService.js  # Cloudinary upload + Tesseract OCR pipeline
│
├── models/                 # Mongoose schemas
│   ├── Admin.js
│   ├── User.js
│   ├── Conversation.js
│   ├── Message.js
│   ├── Lead.js
│   └── Document.js
│
├── middleware/
│   ├── auth.js             # JWT authentication guard
│   ├── errorHandler.js     # Global error handler
│   ├── rateLimiter.js      # express-rate-limit + Redis store
│   └── validate.js         # Request body validation (Joi/express-validator)
│
├── queues/
│   └── messageQueue.js     # Bull queue for async/background jobs
│
└── utils/
    ├── AppError.js         # Custom operational error class
    ├── logger.js           # Winston logger with daily log rotation
    └── ...
```

---

## 🧠 How the AI Service Works

This is the most interesting part of the project. The `aiService.js` uses a **two-tier approach** to keep costs low and response times fast:

### Tier 1 — Rule-Based Intent Detection
Pattern-match the incoming message against known intents:

| Intent | Triggers | Example Response |
|--------|----------|-----------------|
| `greeting` | "hi", "hello", "namaste" | Welcome message with menu |
| `pricing` | "price", "cost", "how much" | Show product pricing |
| `demo` | "demo", "trial", "show me" | Ask for email to set up demo |
| `support` | "help", "issue", "broken" | Ask to describe the problem |
| `opt_out` | "stop", "unsubscribe" | Unsubscribe confirmation |
| `bye` | "bye", "thanks", "done" | Farewell message |

If an intent is matched → return an instant pre-written reply. **Zero AI cost.**

### Tier 2 — LLM Fallback
If no intent is matched, the message goes to an OpenAI-compatible API with:
- **Conversation memory** stored in Redis (last 10 messages, 30-min TTL)
- **Cost controls**: daily global token budget + per-user hourly call limit
- A **system prompt** customized for "Shuddh Dairy" (a sample business: ghee, paneer, milk)

---

## 📦 Data Models

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `User` | phone, name, businessName | Business owner account |
| `Admin` | email, role | Dashboard access |
| `Conversation` | phone, sessionId, status, aiCallCount | Track each chat thread |
| `Message` | conversationId, direction, content, aiSource | Individual messages |
| `Lead` | phone, status, productInterest, followUpAt | CRM — customer pipeline |
| `Document` | storageUrl, ocrText, extractedFields | Uploaded files + extracted data |

### Lead Pipeline
```
new → contacted → qualified → converted → paid
                                        ↘ lost
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| **Helmet** | Sets secure HTTP headers |
| **CORS** | Restricted to `FRONTEND_URL` env variable |
| **Rate Limiting** | `express-rate-limit` + Redis store for all `/api` routes |
| **JWT Auth** | All protected routes require a valid token |
| **Mongo Sanitize** | Prevents NoSQL injection attacks |
| **Request Size Limit** | `10kb` body limit to prevent payload attacks |
| **XSS Clean** | Sanitizes user input against cross-site scripting |
| **HPP** | HTTP Parameter Pollution protection |

---

## 📄 Document Processing Pipeline

When a customer sends an image or PDF through WhatsApp:

```
1. Received via webhook
2. multer → memory storage (no disk I/O)
3. Cloudinary → stores the file, returns a URL
4. Tesseract.js → OCR extracts text from image
5. Regex field extraction → finds email, phone, date, amount
6. MongoDB → saves Document record with extracted fields + validation status
```

This is useful for collecting KYC documents, invoices, receipts, etc. automatically.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- A Meta Developer account with WhatsApp Business API access

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd backend

# Install dependencies
npm install

# Copy the example environment file and fill in your values
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the root with the following:

```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/whatsapp-automation

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Meta / WhatsApp Business API
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_ACCESS_TOKEN=your_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# AI Service (OpenAI-compatible endpoint)
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_API_KEY=sk-...
AI_DAILY_TOKEN_BUDGET=100000
AI_MAX_CALLS_PER_USER_PER_HOUR=20

# File Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Running the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:5000`.

### Setting Up the Webhook

1. Use [ngrok](https://ngrok.com/) to expose your local server:
   ```bash
   ngrok http 5000
   ```
2. In your Meta Developer Console, set the webhook URL to:
   ```
   https://<your-ngrok-url>/webhook
   ```
3. Use the `WHATSAPP_VERIFY_TOKEN` from your `.env` for verification.

---

## 🛣️ API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | ❌ | Server health check |
| `GET/POST` | `/webhook` | ❌ | Meta WhatsApp webhook |
| `POST` | `/api/auth/register` | ❌ | Register a business account |
| `POST` | `/api/auth/login` | ❌ | Login and get JWT |
| `GET` | `/api/conversations` | ✅ | List all conversations |
| `GET` | `/api/leads` | ✅ | List leads (CRM) |
| `POST` | `/api/documents/upload` | ✅ | Upload a document |
| `GET` | `/api/analytics` | ✅ | Dashboard metrics |
| `GET/PUT` | `/api/settings` | ✅ | Business settings |

---

## 🧪 Testing

```bash
# Run unit tests with coverage
npm test
```

Tests use **Jest** + **Supertest** for HTTP integration testing.

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Cache / Queue | Redis (ioredis) + Bull |
| AI Integration | OpenAI-compatible API (Axios) |
| File Storage | Cloudinary |
| OCR | Tesseract.js |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Joi + express-validator |
| Logging | Winston + daily-rotate-file |
| Security | Helmet, CORS, HPP, XSS-Clean, Mongo-Sanitize |

---

## 📈 Key Design Decisions

- **Rule-based first, AI second** — avoids unnecessary API calls and reduces cost by up to 60-70% for common queries.
- **Redis for conversation memory** — lightweight, fast, and auto-expiring (no stale data).
- **Bull queue** — ensures message processing is non-blocking and can be retried on failure.
- **Webhook mounted before `express.json()`** — Meta webhooks require raw body verification; mounting the route early prevents body-parser from consuming it.
- **Async OCR with `setImmediate`** — document upload returns immediately to the user while OCR runs in the background.

---

## 👨‍💻 Author

Built by **Saket Goswami** as a full-stack learning project exploring WhatsApp Business API, LLM integration, and production-grade Node.js architecture.
