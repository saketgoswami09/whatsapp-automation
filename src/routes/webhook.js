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
  express.json({ verify: verifyRawBody }),
  async (req, res) => {
    // Always reply 200 immediately to Meta to prevent retries
    res.status(200).send("EVENT_RECEIVED");

    try {
      const signature = req.headers["x-hub-signature-256"];
      if (
        env.NODE_ENV === "production" &&
        !verifyWebhookSignature(req.rawBody, signature)
      ) {
        logger.warn("Invalid webhook signature");
        return;
      }

      const messages = parseWebhookPayload(req.body);
      if (!messages.length) return;

      for (const msg of messages) {
        // Handle only text messages for now (extend for media)
        if (msg.type !== "text" || !msg.text) continue;

        const userText =
          typeof msg.text === "string"
            ? msg.text.trim()
            : msg.text?.body?.trim();
        const { from: phone, name, messageId, timestamp } = msg;
        logger.info({ phone, userText });
        // 1. Get/create user and conversation
        const user = await getOrCreateUser(phone, name);
        const conversation = await getOrCreateConversation(user._id, phone);

        // 2. Save inbound message
        await saveMessage({
          conversationId: conversation._id,
          userId: user._id,
          direction: "inbound",
          type: "text",
          content: userText,
          whatsappMessageId: messageId,
          timestamp,
        });

        // 3. Mark as read
        await markMessageRead(messageId).catch(() => {});

        // 4. Get/create lead
        const lead = await getOrCreateLead(user._id, phone, name);

        // 5. Generate AI/rule-based response
        const {
          text: replyText,
          tokensUsed,
          source,
        } = await generateResponse({
          sessionId: conversation.sessionId,
          userId: user._id.toString(),
          message: userText,
        });

        logger.info({ replyText, source, tokensUsed });

        // 6. Send WhatsApp reply (DISABLED FOR POSTMAN TESTING)
        // await sendText(phone, replyText);
        // 6. Send WhatsApp reply
        await sendText(phone, replyText);

        // 7. Save outbound message
        await saveMessage({
          conversationId: conversation._id,
          userId: user._id,
          direction: "outbound",
          type: "text",
          content: replyText,
          generatedByAI: source === "ai",
          tokensUsed,
        });

        // 8. Schedule follow-up for new leads
        if (lead.followUpCount === 0 && lead.status === "new") {
          scheduleLeadFollowUps(lead).catch(() => {});
        }

        logger.info(`Processed message from ${phone} [${source}]`);
      }
    } catch (err) {
      logger.error(`Webhook processing error: ${err.message}`, {
        stack: err.stack,
      });
    }
  },
);

// Store rawBody for signature verification
function verifyRawBody(req, res, buf) {
  req.rawBody = buf;
}

module.exports = router;
