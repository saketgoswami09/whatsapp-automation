const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');
const logger = require('./logger');

const BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * Verify HMAC-SHA256 webhook signature from Meta
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

/**
 * Send a plain text message
 */
const sendText = async (to, text) => {
  return _send({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
};

/**
 * Send a template message
 */
const sendTemplate = async (to, templateName, languageCode = 'en_US', components = []) => {
  return _send({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  });
};

/**
 * Send a media message (image/document/audio/video)
 */
const sendMedia = async (to, mediaType, mediaUrl, caption = '') => {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: mediaType,
    [mediaType]: { link: mediaUrl, caption },
  };
  return _send(payload);
};

/**
 * Mark message as read
 */
const markMessageRead = async (messageId) => {
  return _send({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
};

const _send = async (payload) => {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );
    return data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    logger.error('WhatsApp API error', { errData, payload });
    throw new Error(`WhatsApp send failed: ${JSON.stringify(errData)}`);
  }
};

/**
 * Parse incoming webhook payload into structured message objects
 */
const parseWebhookPayload = (body) => {
  const messages = [];
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0]?.value;

  if (!changes?.messages) return messages;

  for (const msg of changes.messages) {
    const contact = changes.contacts?.[0];
    messages.push({
      messageId: msg.id,
      from: msg.from,
      name: contact?.profile?.name || 'Unknown',
      timestamp: new Date(parseInt(msg.timestamp) * 1000),
      type: msg.type,
      text: msg.text?.body || null,
      image: msg.image || null,
      document: msg.document || null,
      audio: msg.audio || null,
      video: msg.video || null,
      location: msg.location || null,
      interactive: msg.interactive || null,
      rawMessage: msg,
    });
  }

  return messages;
};

module.exports = {
  verifyWebhookSignature,
  sendText,
  sendTemplate,
  sendMedia,
  markMessageRead,
  parseWebhookPayload,
};
