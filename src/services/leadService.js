const Lead = require('../models/Lead');
const User = require('../models/User');
const { sendTemplate, sendText } = require('../utils/whatsapp');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Valid status transitions (state machine)
const STATUS_TRANSITIONS = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['converted', 'lost'],
  converted: ['paid', 'lost'],
  paid: [],
  lost: ['new'],
};

/**
 * Create or upgrade a lead from a user interaction
 */
const getOrCreateLead = async (userId, phone, name, source = 'whatsapp') => {
  let lead = await Lead.findOne({ userId });
  if (!lead) {
    lead = await Lead.create({ userId, phone, name, source, status: 'new' });
    // Update User's leadStatus
    await User.findByIdAndUpdate(userId, { leadStatus: 'new' });
    logger.info(`New lead created: ${phone}`);
  }
  return lead;
};

/**
 * Update lead status with state machine validation
 */
const updateLeadStatus = async (leadId, newStatus, adminId) => {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new AppError('Lead not found', 404);

  const allowed = STATUS_TRANSITIONS[lead.status];
  if (!allowed.includes(newStatus)) {
    throw new AppError(`Invalid status transition: ${lead.status} → ${newStatus}. Allowed: ${allowed.join(', ')}`, 400);
  }

  lead.status = newStatus;
  if (newStatus === 'converted') lead.convertedAt = new Date();

  await lead.save();
  await User.findByIdAndUpdate(lead.userId, { leadStatus: newStatus });

  return lead;
};

/**
 * Generate a payment link (stub — plug in Razorpay/Stripe)
 */
const generatePaymentLink = async (leadId, amount, description = 'Payment') => {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new AppError('Lead not found', 404);

  // Razorpay stub — replace with actual SDK call
  const paymentLink = `https://rzp.io/l/demo_${leadId.toString().slice(-8)}?amount=${amount}`;

  lead.paymentLink = paymentLink;
  lead.amount = amount;
  await lead.save();

  logger.info(`Payment link generated for lead ${leadId}: ${paymentLink}`);
  return paymentLink;
};

/**
 * Add a note to a lead
 */
const addLeadNote = async (leadId, note, adminId) => {
  const lead = await Lead.findByIdAndUpdate(
    leadId,
    { $push: { notes: { note, addedBy: adminId } } },
    { new: true },
  );
  if (!lead) throw new AppError('Lead not found', 404);
  return lead;
};

/**
 * Send a follow-up WhatsApp message to a lead
 */
const sendFollowUp = async (lead, messageText) => {
  await sendText(lead.phone, messageText);
  lead.followUpCount += 1;
  lead.followUpAt = null;
  await lead.save();
  logger.info(`Follow-up sent to ${lead.phone}`);
};

/**
 * Get leads with pagination, filter, sort
 */
const getLeads = async ({ page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = {}) => {
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const [leads, total] = await Promise.all([
    Lead.find(query).populate('userId', 'phone name').populate('assignedTo', 'name email').sort(sort).skip(skip).limit(limit).lean(),
    Lead.countDocuments(query),
  ]);

  return { leads, total, page, pages: Math.ceil(total / limit) };
};

module.exports = {
  getOrCreateLead,
  updateLeadStatus,
  generatePaymentLink,
  addLeadNote,
  sendFollowUp,
  getLeads,
};
