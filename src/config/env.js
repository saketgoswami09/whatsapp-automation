require("dotenv").config();
const Joi = require("joi");

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(5000),

  // MongoDB
  MONGO_URI: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().default("redis://localhost:6379"),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRY: Joi.string().default("7d"),

  // WhatsApp Cloud API (Meta)
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().required(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().required(),
  WHATSAPP_ACCESS_TOKEN: Joi.string().required(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: Joi.string().required(),
  WHATSAPP_APP_SECRET: Joi.string().required(),

  // AI (OpenAI-compatible — use Groq free tier)
  AI_BASE_URL: Joi.string().default("https://api.groq.com/openai/v1"),
  AI_API_KEY: Joi.string().required(),
  AI_MODEL: Joi.string().default("llama3-8b-8192"),

  // Cost Control — AI Budget
  AI_DAILY_TOKEN_BUDGET: Joi.number().default(50000),
  AI_MAX_CALLS_PER_USER_PER_HOUR: Joi.number().default(10),

  // Cloudinary (free tier)
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // Frontend
  FRONTEND_URL: Joi.string().default("http://localhost:5173"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().default(200),
}).unknown(true);

const { error, value: env } = envSchema.validate(process.env);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}
module.exports = env;
