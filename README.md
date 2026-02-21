# 🤖 WhatsApp AI Automation Platform

A **production-ready**, full-stack WhatsApp Conversational AI system. Businesses can connect their WhatsApp Business number, let an AI handle customer conversations, auto-capture leads, store documents, and view live analytics — all from a React dashboard.

---

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack & Why](#tech-stack--why)
3. [Project Structure — File by File](#project-structure--file-by-file)
4. [Build From Scratch — Step by Step](#build-from-scratch--step-by-step)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Running the Project](#running-the-project)
7. [API Routes Reference](#api-routes-reference)
8. [Tips & Common Gotchas](#tips--common-gotchas)

---

## Architecture Overview

```
WhatsApp User
      │
      ▼ (HTTPS webhook POST)
 Meta Cloud API
      │
      ▼
 ┌────────────┐     ┌──────────┐     ┌────────────┐
 │  Express   │────▶│ Bull     │────▶│  AI        │
 │  Backend   │     │ Queue    │     │  Service   │
 │  (Node.js) │     │ (Redis)  │     │  (Groq/    │
 └────────────┘     └──────────┘     │  OpenAI)   │
       │                             └────────────┘
       │
       ▼
 ┌────────────┐   ┌──────────────┐   ┌──────────────┐
 │  MongoDB   │   │  Cloudinary  │   │  React       │
 │  (Data)    │   │  (Files)     │   │  Dashboard   │
 └────────────┘   └──────────────┘   └──────────────┘
```

**Flow:** A customer sends a WhatsApp message → Meta forwards it to your webhook → backend queues it in Redis via Bull → AI service replies → response is sent back via WhatsApp Cloud API. Meanwhile, the React dashboard lets you monitor conversations, leads, and analytics in real time.

---

## Tech Stack & Why

| Layer | Technology | Why |
|---|---|---|
| **Backend framework** | Express.js | Minimal, unopinionated, huge ecosystem |
| **Database** | MongoDB + Mongoose | Flexible schema — conversations vary in shape |
| **Cache / Queue** | Redis + Bull | Async job queue prevents webhook timeouts; caching speeds things up |
| **AI** | Groq / OpenAI compatible | OpenAI-compatible API keeps you provider-agnostic |
| **File Storage** | Cloudinary | Free 25 GB tier, great for documents/images received via WhatsApp |
| **OCR** | Tesseract.js | Extract text from images sent by users (pure JS, no server binary needed) |
| **Auth** | JWT (access + refresh tokens) | Stateless, scales horizontally |
| **Frontend** | React 19 + Vite | Fast HMR, modern React features |
| **Charts** | Recharts | Lightweight chart library for analytics |
| **HTTP Client** | Axios | Used on both frontend (dashboard API calls) and backend (calling Meta & AI APIs) |
| **Logging** | Winston + morgan | Structured JSON logs with daily rotation |
| **Security** | Helmet, CORS, mongoSanitize, rate-limit | Standard production hardening |
| **Containerisation** | Docker + docker-compose | One-command local spin-up with all services |

---

## Project Structure — File by File

```
whatsappAutomation/
├── docker-compose.yml          ← spins up MongoDB + Redis + backend + frontend
├── backend/
│   ├── .env.example            ← template — copy to .env and fill in
│   ├── Dockerfile              ← builds the Node.js backend image
│   ├── seed.js                 ← creates a default admin user in MongoDB
│   ├── package.json
│   └── src/
│       ├── app.js              ← ★ ENTRY POINT — Express app wired here
│       ├── config/
│       │   ├── db.js           ← connects to MongoDB via Mongoose
│       │   ├── redis.js        ← connects ioredis client, used by Bull & rate-limiter
│       │   └── env.js          ← validates required env vars on startup
│       ├── routes/
│       │   ├── webhook.js      ← GET (verify) + POST (receive messages) from Meta
│       │   ├── auth.js         ← /api/auth — login, refresh, logout
│       │   ├── users.js        ← /api/users — admin user management
│       │   ├── conversations.js← /api/conversations — list, get, reply
│       │   ├── leads.js        ← /api/leads — CRM-lite: list, update, export
│       │   ├── documents.js    ← /api/documents — upload, list, get
│       │   ├── analytics.js    ← /api/analytics — stats for the dashboard
│       │   └── settings.js     ← /api/settings — AI persona, prompts, toggles
│       ├── controllers/
│       │   ├── authController.js         ← login/register/refresh logic
│       │   ├── conversationController.js ← fetch & send manual replies
│       │   ├── leadController.js         ← lead CRUD + CSV export
│       │   ├── documentController.js     ← upload to Cloudinary + OCR
│       │   ├── analyticsController.js    ← aggregate queries for charts
│       │   ├── settingsController.js     ← read/write AI settings doc
│       │   └── userController.js         ← profile, password change
│       ├── services/
│       │   ├── aiService.js      ← ★ calls Groq/OpenAI to generate replies; manages token budget
│       │   ├── conversationService.js ← conversation history helpers, auto-lead detection
│       │   ├── documentService.js     ← Cloudinary upload + Tesseract OCR pipeline
│       │   └── leadService.js         ← upsert leads, tag, score
│       ├── models/
│       │   ├── Admin.js          ← admin user schema (bcrypt hashed password)
│       │   ├── Conversation.js   ← phone number + status + assignedTo
│       │   ├── Message.js        ← each individual message (role, content, tokens)
│       │   ├── Lead.js           ← captured name/email/phone + stage + notes
│       │   ├── Document.js       ← Cloudinary URL + OCR text + conversation ref
│       │   └── User.js           ← (customer-side) WhatsApp profile info
│       ├── queues/
│       │   └── messageQueue.js   ← Bull queue — processes incoming WhatsApp messages async
│       ├── middleware/
│       │   ├── auth.js           ← verifyToken middleware (JWT)
│       │   ├── errorHandler.js   ← global Express error handler
│       │   ├── rateLimiter.js    ← express-rate-limit + redis store
│       │   └── validate.js       ← wraps express-validator for clean route validation
│       └── utils/
│           ├── AppError.js       ← custom Error subclass with statusCode
│           ├── logger.js         ← Winston logger (console + daily rotating files)
│           ├── catchAsync.js     ← wraps async controllers (not needed with express-async-errors)
│           └── (other helpers)
└── frontend/
    /////////////////
```


## 🚧 Future Enhancements

- Multi-tenant support
- Role-based access control (RBAC)
- Horizontal queue scaling
- WebSocket live updates
- Kubernetes deployment support


## 👨‍💻 Author

Saket Giri  
Full-stack developer focused on scalable backend architecture.
