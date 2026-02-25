const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/overview
router.get('/overview', authenticate, analyticsController.overview);

// GET /api/analytics/messages-over-time?days=7
router.get('/messages-over-time', authenticate, analyticsController.messagesOverTime);

// GET /api/analytics/lead-funnel
router.get('/lead-funnel', authenticate, analyticsController.leadFunnel);

module.exports = router;
