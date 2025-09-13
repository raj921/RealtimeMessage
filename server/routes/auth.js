const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');


router.post(
  '/register',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('role', 'Role is required').isIn(['doctor', 'nurse', 'patient', 'admin'])
  ],
  authController.register
);


router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  authController.login
);


router.post('/refresh-token', authController.refreshToken);


router.post('/logout', auth, authController.logout);

module.exports = router;
