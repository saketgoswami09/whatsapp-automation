const Lead = require('../models/Lead');
const AppError = require('../utils/AppError');
const { updateLeadStatus, generatePaymentLink, addLeadNote } = require('../services/leadService');
const { scheduleFollowUp } = require('../queues/followUpQueue');

// GET /api/leads
exports.getLeads = async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { phone: { $regex: search, $options: 'i' } },
  ];
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [leads, total] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Lead.countDocuments(query),
  ]);
  res.json({ status: 'success', data: { leads, total, page: parseInt(page) } });
};

// GET /api/leads/:id
exports.getLead = async (req, res, next) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return next(new AppError('Lead not found', 404));
  res.json({ status: 'success', data: { lead } });
};

// PATCH /api/leads/:id/status
exports.updateStatus = async (req, res, next) => {
  const lead = await updateLeadStatus(req.params.id, req.body.status);
  if (!lead) return next(new AppError('Lead not found', 404));
  res.json({ status: 'success', data: { lead } });
};

// POST /api/leads/:id/notes
exports.addNote = async (req, res, next) => {
  const lead = await addLeadNote(req.params.id, req.body.content, req.admin._id);
  if (!lead) return next(new AppError('Lead not found', 404));
  res.json({ status: 'success', data: { lead } });
};

// POST /api/leads/:id/payment-link
exports.paymentLink = async (req, res, next) => {
  const { amount, description } = req.body;
  const result = await generatePaymentLink(req.params.id, amount, description);
  res.json({ status: 'success', data: result });
};

// POST /api/leads/:id/follow-up
exports.manualFollowUp = async (req, res, next) => {
  const { message, delayHours = 1 } = req.body;
  const lead = await Lead.findById(req.params.id);
  if (!lead) return next(new AppError('Lead not found', 404));
  const jobId = await scheduleFollowUp(lead._id, lead.phone, message, delayHours * 3600000);
  res.json({ status: 'success', data: { jobId, scheduledIn: `${delayHours}h` } });
};
