const express = require("express");
const router = express.Router();
const {
  verifyWebhookSignature,
  parseWebhookPayload,
  sendText,
  markMessageRead,
} = require("../utils/whatsapp");
const {
  getOrCreateUser,
  getOrCreateConversation,
  saveMessage,
} = require("../services/conversationService");
const { generateResponse } = require("../services/aiService");
const { getOrCreateLead } = require("../services/leadService");
const { scheduleLeadFollowUps } = require("../queues/followUpQueue");
const { webhookLimiter } = require("../middleware/rateLimiter");
const env = require("../config/env");
const logger = require("../utils/logger");

// ─── Helper for Signature Verification ────────────────────────────────────────
// Define this BEFORE it is used in the middleware
const verifyRawBody = (req, res, buf) => {
  req.rawBody = buf;
};

/**
 * GET /webhook — Meta verification challenge
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info("Webhook verified successfully");
    return res.status(200).send(challenge);
  }
  return res
    .status(403)
    .json({ status: "fail", message: "Webhook verification failed" });
});

/**
 * POST /webhook — Receive incoming messages from Meta
 */
router.post(
  "/",
  webhookLimiter,
  express.json({ verify: verifyRawBody }), // Captures rawBody for security checks
  async (req, res) => {
    // 1. Immediate acknowledgment to Meta
    res.status(200).send("EVENT_RECEIVED");

    try {
      // 2. Signature verification (Skip in Dev if preferred, but recommended)
      const signature = req.headers["x-hub-signature-256"];
      if (
        env.NODE_ENV === "production" &&
        !verifyWebhookSignature(req.rawBody, signature)
      ) {
        logger.warn("Invalid webhook signature rejected");
        return;
      }

      // 3. Payload parsing
      const messages = parseWebhookPayload(req.body);
      if (!messages || !messages.length) return;

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text) continue;

        const userText = typeof msg.text === "string" 
            ? msg.text.trim() 
            : msg.text?.body?.trim();
            
        const { from: phone, name, messageId, timestamp } = msg;

        // 4. Processing logic
        const user = await getOrCreateUser(phone, name);
        const conversation = await getOrCreateConversation(user._id, phone);

        await saveMessage({
          conversationId: conversation._id,
          userId: user._id,
          direction: "inbound",
          type: "text",
          content: userText,
          whatsappMessageId: messageId,
          timestamp,
        });

        await markMessageRead(messageId).catch(() => {});

        const lead = await getOrCreateLead(user._id, phone, name);

        const { text: replyText, tokensUsed, source } = await generateResponse({
          sessionId: conversation.sessionId,
          userId: user._id.toString(),
          message: userText,
        });

        await sendText(phone, replyText);

        await saveMessage({
          conversationId: conversation._id,
          userId: user._id,
          direction: "outbound",
          type: "text",
          content: replyText,
          generatedByAI: source === "ai",
          tokensUsed,
        });

        if (lead.followUpCount === 0 && lead.status === "new") {
          scheduleLeadFollowUps(lead).catch((e) => logger.error(`Follow-up error: ${e.message}`));
        }

        logger.info(`Successfully processed message from ${phone}`);
      }
    } catch (err) {
      logger.error(`Webhook processing error: ${err.message}`, { stack: err.stack });
    }
  }
);

module.exports = router;