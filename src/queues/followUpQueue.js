const Bull = require('bull');
const Lead = require('../models/Lead');
const { sendText } = require('../utils/whatsapp');
const env = require('../config/env');
const logger = require('../utils/logger');

// ─── Gracefully handle Redis being unavailable ───────────────────────────────
let followUpQueue = null;

const getQueue = () => {
  if (followUpQueue) return followUpQueue;
  try {
    followUpQueue = new Bull('followUp', {
      redis: env.REDIS_URL,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    followUpQueue.on('error', (err) => logger.error(`Bull queue error: ${err.message}`));
    followUpQueue.on('completed', (job) => logger.info(`Follow-up job ${job.id} completed`));
    followUpQueue.on('failed', (job, err) => logger.error(`Follow-up job ${job.id} failed: ${err.message}`));
    followUpQueue.on('stalled', (job) => logger.warn(`Follow-up job ${job.id} stalled`));

    // ─── Processor ───────────────────────────────────────────────────────────
    followUpQueue.process(async (job) => {
      const { leadId, message, phone } = job.data;
      const lead = await Lead.findById(leadId);
      if (!lead || lead.status === 'paid' || lead.status === 'lost') {
        logger.info(`Follow-up skipped for lead ${leadId} — status: ${lead?.status}`);
        return;
      }
      await sendText(phone, message);
      await Lead.findByIdAndUpdate(leadId, { $inc: { followUpCount: 1 }, followUpAt: null });
      logger.info(`Follow-up sent to ${phone} for lead ${leadId}`);
    });

    logger.info('Bull follow-up queue initialized');
  } catch (err) {
    logger.warn(`Bull queue unavailable (Redis not connected): ${err.message}`);
    followUpQueue = null;
  }
  return followUpQueue;
};

/**
 * Schedule a follow-up message for a lead
 */
const scheduleFollowUp = async (leadId, phone, message, delayMs = 24 * 60 * 60 * 1000) => {
  const queue = getQueue();
  if (!queue) {
    logger.warn('Follow-up skipped — Bull queue not available (Redis required)');
    return null;
  }
  const job = await queue.add({ leadId, phone, message }, { delay: delayMs });
  await Lead.findByIdAndUpdate(leadId, { followUpAt: new Date(Date.now() + delayMs) });
  logger.info(`Follow-up scheduled: job ${job.id}, delay ${delayMs}ms for ${phone}`);
  return job.id;
};

/**
 * Schedule automated follow-up sequences based on lead status
 */
const scheduleLeadFollowUps = async (lead) => {
  const messages = {
    new: "Hi! 👋 Just checking in — have you had a chance to look at our offer? Reply *YES* to know more or *STOP* to unsubscribe.",
    contacted: "Hey! 🌟 We wanted to make sure you got all the info you need. Any questions? Our team is ready to help!",
    qualified: "Great news! 🎉 We have a special offer ready for you. Reply *OFFER* to see details or *agent* to speak with our team.",
  };
  const message = messages[lead.status];
  if (message) {
    await scheduleFollowUp(lead._id, lead.phone, message, 24 * 60 * 60 * 1000);
  }
};

module.exports = { getQueue, scheduleFollowUp, scheduleLeadFollowUps };
