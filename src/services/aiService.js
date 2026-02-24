const axios = require('axios');
const { redisClient } = require('../config/redis');
const env = require('../config/env');
const logger = require('../utils/logger');

const AI_BASE_URL = env.AI_BASE_URL;
const AI_MODEL = env.AI_MODEL;
const DAILY_TOKEN_BUDGET = env.AI_DAILY_TOKEN_BUDGET; // already a number (Joi coerced)
const MAX_CALLS_PER_USER_PER_HOUR = env.AI_MAX_CALLS_PER_USER_PER_HOUR; // already a number

// ─── Rule-Based Intent Detection ─────────────────────────────────────────────
const INTENT_PATTERNS = [
  { intent: 'greeting', patterns: [/^(hi|hello|hey|hola|namaste|good morning|good evening|yo)\b/i] },
  { intent: 'pricing', patterns: [/\b(price|cost|rate|fee|charges?|how much|quote|plan)\b/i] },
  { intent: 'demo', patterns: [/\b(demo|trial|test|try|sample|show me)\b/i] },
  { intent: 'support', patterns: [/\b(help|support|issue|problem|bug|error|broken|not working)\b/i] },
  { intent: 'contact', patterns: [/\b(call me|contact|reach|talk to (someone|human|agent)|connect me)\b/i] },
  { intent: 'status', patterns: [/\b(status|track|order|where is|my (order|delivery))\b/i] },
  { intent: 'bye', patterns: [/^(bye|goodbye|see you|thanks|thank you|ok|done)\s*\.?$/i] },
  { intent: 'opt_out', patterns: [/^(stop|unsubscribe|cancel|quit|opt.?out)\s*$/i] },
];

const RULE_RESPONSES = {
  greeting: "Hi there! 👋 Welcome! I'm here to help you. What can I assist you with today?\n\n1️⃣ Pricing\n2️⃣ Demo/Trial\n3️⃣ Support\n4️⃣ Talk to agent",
  pricing: "Here are our plans:\n\n💎 *Starter* - ₹999/mo\n🚀 *Pro* - ₹2499/mo\n🏢 *Enterprise* - Custom\n\nWould you like a demo? Reply *demo*",
  demo: "Great! I'll set you up with a free demo 🎯\n\nPlease share your email address and we'll get started!",
  support: "I'll help you right away! 🛠️\n\nPlease describe your issue in detail, or reply *agent* to connect with our support team.",
  contact: "Connecting you to a human agent... 🙋\n\nOur team will reach out within a few minutes. What's the best time to call you?",
  status: "Please share your order ID or registered phone number and I'll check the status for you! 📦",
  bye: "Goodbye! 👋 Thanks for reaching out. Feel free to message anytime!",
  opt_out: "You've been unsubscribed from our messages. Reply *START* anytime to opt back in.",
};

/**
 * Detect intent from text using rule-based patterns
 * @returns {string|null} intent name or null
 */
const detectIntent = (text) => {
  const trimmed = text?.trim() || '';
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return intent;
    }
  }
  return null;
};

/**
 * Get rule-based response for an intent
 */
const getRuleResponse = (intent) => RULE_RESPONSES[intent] || null;

// ─── Cost Control ─────────────────────────────────────────────────────────────

/**
 * Check if global daily token budget is exceeded
 */
const isDailyBudgetExceeded = async () => {
  try {
    const used = parseInt((await redisClient.get('ai:daily_tokens')) || '0');
    return used >= DAILY_TOKEN_BUDGET;
  } catch {
    return false; // if Redis is down, allow the call
  }
};

/**
 * Check if per-user hourly rate limit is exceeded
 */
const isUserRateLimited = async (userId) => {
  try {
    const key = `ai:user:${userId}:hourly`;
    const count = parseInt((await redisClient.get(key)) || '0');
    return count >= MAX_CALLS_PER_USER_PER_HOUR;
  } catch {
    return false;
  }
};

/**
 * Record a completed AI call for tracking
 */
const recordAIUsage = async (userId, tokensUsed) => {
  try {
    const pipeline = redisClient.pipeline();

    // Global daily budget
    const dailyKey = 'ai:daily_tokens';
    const secondsUntilMidnight = getSecondsUntilMidnight();
    pipeline.incrby(dailyKey, tokensUsed);
    pipeline.expire(dailyKey, secondsUntilMidnight);

    // Per-user hourly counter
    const userKey = `ai:user:${userId}:hourly`;
    pipeline.incr(userKey);
    pipeline.expire(userKey, 3600);

    await pipeline.exec();
  } catch (err) {
    logger.warn(`Failed to record AI usage: ${err.message}`);
  }
};

const getSecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
};

// ─── Conversation Memory ──────────────────────────────────────────────────────
const MEMORY_TTL = 60 * 30; // 30 minutes
const MAX_HISTORY = 10;

const getConversationMemory = async (sessionId) => {
  try {
    const data = await redisClient.get(`memory:${sessionId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveConversationMemory = async (sessionId, messages) => {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    await redisClient.setex(`memory:${sessionId}`, MEMORY_TTL, JSON.stringify(trimmed));
  } catch (err) {
    logger.warn(`Failed to save conversation memory: ${err.message}`);
  }
};

// ─── AI Fallback ──────────────────────────────────────────────────────────────

/**
 * Call AI model (OpenAI-compatible) with cost control
 */
const callAI = async ({ sessionId, userId, userMessage, systemPrompt }) => {
  // Gate 1: global budget
  if (await isDailyBudgetExceeded()) {
    logger.warn('AI daily token budget exceeded — using fallback response');
    return { text: "I'm having trouble understanding that. Could you please rephrase, or type *agent* to speak with a human?", tokensUsed: 0, fromCache: false };
  }

  // Gate 2: per-user hourly limit
  if (await isUserRateLimited(userId)) {
    return { text: "You've reached the message limit for this hour. Please try again later or type *agent* for human support.", tokensUsed: 0, fromCache: false };
  }

  const history = await getConversationMemory(sessionId);
  const messages = [
    {
      role: 'system',
      content: systemPrompt || `You are a helpful WhatsApp customer support assistant. Be concise, friendly, and professional. 
      Use simple language. Keep responses under 200 words. 
      If you cannot help, suggest typing "agent" to reach a human.`,
    },
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const { data } = await axios.post(
      `${AI_BASE_URL}/chat/completions`,
      {
        model: AI_MODEL,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    const reply = data.choices?.[0]?.message?.content || 'I could not generate a response.';
    const tokensUsed = data.usage?.total_tokens || 0;

    // Save updated memory
    const updatedHistory = [
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: reply },
    ];
    await saveConversationMemory(sessionId, updatedHistory);
    await recordAIUsage(userId, tokensUsed);

    return { text: reply, tokensUsed, fromCache: false };
  } catch (err) {
    logger.error(`AI API call failed: ${err.message}`);
    return {
      text: "I'm unable to process your request right now. Type *agent* to speak with a human.",
      tokensUsed: 0,
      fromCache: false,
    };
  }
};

/**
 * Main AI service entry point:
 * 1. Try rule-based intent detection
 * 2. Fall back to AI if no rule matches
 */
const generateResponse = async ({ sessionId, userId, message, systemPrompt }) => {
  const intent = detectIntent(message);
  if (intent) {
    const ruleResponse = getRuleResponse(intent);
    if (ruleResponse) {
      return { text: ruleResponse, intent, tokensUsed: 0, source: 'rule' };
    }
  }

  const aiResult = await callAI({ sessionId, userId, userMessage: message, systemPrompt });
  return { ...aiResult, intent: 'ai_fallback', source: 'ai' };
};

module.exports = {
  generateResponse,
  detectIntent,
  getConversationMemory,
  saveConversationMemory,
  recordAIUsage,
};
