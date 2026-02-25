const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const leadController = require('../controllers/leadController');

router.get ('/',                  authenticate, leadController.getLeads);
router.get ('/:id',               authenticate, leadController.getLead);
router.patch('/:id/status',       authenticate, leadController.updateStatus);
router.post ('/:id/notes',        authenticate, leadController.addNote);
router.post ('/:id/payment-link', authenticate, leadController.paymentLink);
router.post ('/:id/follow-up',    authenticate, leadController.manualFollowUp);

module.exports = router;
