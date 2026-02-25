const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

const loginRules = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerRules = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').notEmpty().withMessage('Name is required'),
];

router.post('/login',    authLimiter, loginRules,    validate, authController.login);
router.post('/refresh',                                         authController.refresh);
router.post('/logout',  authenticate,                           authController.logout);
router.get ('/me',      authenticate,                           authController.me);
router.post('/register',             registerRules,  validate, authController.register);

module.exports = router;
